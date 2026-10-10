import { neon } from '@neondatabase/serverless';
import { normalize, hashReading, compareClouds } from './protocol.js';

const columns = 'id, device, session, seq, timestamp, temp_centi, humidity_centi, prev_hash, hash';
const historySQL = `WITH a AS (SELECT ${columns} FROM readings WHERE device='A' ORDER BY timestamp DESC, seq DESC LIMIT 60), b AS (SELECT ${columns} FROM readings WHERE device='B' ORDER BY timestamp DESC, seq DESC LIMIT 60), c AS (SELECT ${columns} FROM readings WHERE device='C' ORDER BY timestamp DESC, seq DESC LIMIT 60) SELECT * FROM a UNION ALL SELECT * FROM b UNION ALL SELECT * FROM c ORDER BY timestamp DESC, seq DESC`;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
function values(r) { return [r.id,r.device,r.session,r.seq,r.timestamp,r.temp_centi,r.humidity_centi,r.prev_hash,r.hash]; }
export async function writePrimary(db, r) {
  await db.prepare(`INSERT INTO readings (${columns}) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(...values(r)).run();
  const stored = await db.prepare('SELECT hash FROM readings WHERE id = ?').bind(r.id).first();
  if (stored?.hash !== r.hash) throw new Error('Conflicting reading ID in D1');
}
export async function writeBackup(url, r) {
  if (!url) throw new Error('Neon is not configured');
  const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(10000) } });
  await sql.query(`INSERT INTO readings (${columns}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`, values(r));
  const rows = await sql.query('SELECT hash FROM readings WHERE id = $1', [r.id]);
  if (rows[0]?.hash !== r.hash) throw new Error('Conflicting reading ID in Neon');
}
export async function snapshot(env) {
  const [a,b] = await Promise.allSettled([
    Promise.resolve().then(() => env.DB.prepare(historySQL).all()).then(x => x.results),
    env.NEON_DATABASE_URL ? neon(env.NEON_DATABASE_URL, { fetchOptions: { signal: AbortSignal.timeout(8000) } }).query(historySQL) : Promise.reject(new Error('Not configured'))
  ]);
  const primary = a.status === 'fulfilled', backup = b.status === 'fulfilled';
  const records = await compareClouds(primary ? a.value : [], backup ? b.value : [], { primary, backup });
  return { generated_at: new Date().toISOString(), source: primary ? 'D1' : backup ? 'Neon' : null,
    clouds: { primary: primary ? 'online' : 'unavailable', backup: backup ? 'online' : env.NEON_DATABASE_URL ? 'unavailable' : 'not-configured' },
    records, window_per_device: 60, verification_scope: 'Window of up to 60 readings per device; missing predecessors are not verified. Hashes are not independent blockchain anchors.' };
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/ingest' && request.method === 'POST') {
        if (!env.INGEST_TOKEN || env.INGEST_TOKEN.length < 32) return json({ error: 'Ingest belum dikonfigurasi' }, 503);
        if (request.headers.get('Authorization') !== `Bearer ${env.INGEST_TOKEN}`) return json({ error: 'Unauthorized' }, 401);
        if (!env.NEON_DATABASE_URL && env.LOCAL_PRIMARY_ONLY !== 'true') return json({ error: 'Neon belum dikonfigurasi; bridge akan menyimpan pesan untuk retry' }, 503);
        if (!env.READINGS) return json({ error: 'Antrean belum dikonfigurasi' }, 503);
        const text = await request.text();
        if (text.length > 4096) return json({ error: 'Payload terlalu besar' }, 413);
        let r;
        try { r = normalize(JSON.parse(text)); } catch { return json({ error: 'Payload sensor tidak valid' }, 400); }
        if (await hashReading(r) !== r.hash) return json({ error: 'Hash sensor tidak cocok' }, 422);
        await env.READINGS.send(r);
        return json({ accepted: true, id: r.id, status: 'queued' }, 202);
      }
      if (path === '/api/snapshot' && request.method === 'GET') return json(await snapshot(env));
      if (path === '/api/health' && request.method === 'GET') return json({ service: 'tp2-iot', ingest_configured: !!env.INGEST_TOKEN && env.INGEST_TOKEN.length >= 32, neon_configured: !!env.NEON_DATABASE_URL });
      if (path.startsWith('/api/')) return json({ error: 'Endpoint tidak tersedia' }, 404);
      return env.ASSETS.fetch(request);
    } catch { return json({ error: 'Layanan sementara tidak tersedia' }, 503); }
  },
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const result = await Promise.allSettled([writePrimary(env.DB, msg.body), writeBackup(env.NEON_DATABASE_URL, msg.body)]);
      if (result.every(r => r.status === 'fulfilled')) msg.ack();
      else { console.warn('Replication retry', msg.body.id, result.map(r => r.status)); msg.retry({ delaySeconds: 30 }); }
    }
  }
};
