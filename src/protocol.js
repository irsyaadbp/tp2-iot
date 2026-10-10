export const ZERO_HASH = '0'.repeat(64);
export function canonical(r) {
  return JSON.stringify({ v: 1, device: r.device, session: r.session, seq: r.seq,
    timestamp: r.timestamp, temp_centi: r.temp_centi,
    humidity_centi: r.humidity_centi, prev_hash: r.prev_hash });
}
export async function hashReading(r) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(r)));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function normalize(r) {
  if (!r || r.v !== 1 || !['A','B','C'].includes(r.device) ||
      !/^[a-f0-9]{16}$/.test(r.session) || !Number.isSafeInteger(r.seq) || r.seq < 1 ||
      !Number.isSafeInteger(r.timestamp) || r.timestamp < 1700000000 || r.timestamp > 4102444800 ||
      !Number.isInteger(r.temp_centi) || r.temp_centi < -4000 || r.temp_centi > 8000 ||
      !Number.isInteger(r.humidity_centi) || r.humidity_centi < 0 || r.humidity_centi > 10000 ||
      !/^[a-f0-9]{64}$/.test(r.prev_hash) || !/^[a-f0-9]{64}$/.test(r.hash) ||
      (r.seq === 1 && r.prev_hash !== ZERO_HASH)) throw new Error('Payload sensor tidak valid');
  const id = `${r.device}:${r.session}:${r.seq}`;
  if (r.id && r.id !== id) throw new Error('ID pembacaan tidak cocok');
  return { id, v: 1, device: r.device, session: r.session, seq: r.seq,
    timestamp: r.timestamp, temp_centi: r.temp_centi, humidity_centi: r.humidity_centi,
    prev_hash: r.prev_hash, hash: r.hash };
}
export async function inspectCloud(rows) {
  const index = new Map(rows.map(r => [r.id, r]));
  const minimum = new Map();
  for (const r of rows) {
    const key = `${r.device}:${r.session}`;
    minimum.set(key, Math.min(minimum.get(key) ?? Infinity, r.seq));
  }
  return Promise.all(rows.map(async r => {
    const validHash = await hashReading(r) === r.hash;
    const previous = index.get(`${r.device}:${r.session}:${r.seq - 1}`);
    const chain = r.seq === 1 ? (r.prev_hash === ZERO_HASH ? 'genesis' : 'broken') :
      previous ? (previous.hash === r.prev_hash ? 'linked' : 'broken') :
      minimum.get(`${r.device}:${r.session}`) < r.seq ? 'missing' : 'outside-window';
    return { ...r, valid_hash: validHash, chain };
  }));
}
export async function compareClouds(primary, backup, available) {
  const [a, b] = await Promise.all([inspectCloud(primary), inspectCloud(backup)]);
  const ai = new Map(a.map(r => [r.id, r])), bi = new Map(b.map(r => [r.id, r]));
  return [...new Set([...ai.keys(), ...bi.keys()])].map(id => {
    const x = ai.get(id), y = bi.get(id), r = x || y;
    let integrity = 'unavailable';
    if ((x && (!x.valid_hash || x.chain === 'broken')) || (y && (!y.valid_hash || y.chain === 'broken'))) integrity = 'tampered';
    else if (available.primary && available.backup) {
      if (!x || !y) integrity = 'pending';
      else if (canonical(x) !== canonical(y) || x.hash !== y.hash) integrity = 'mismatch';
      else integrity = x.chain === 'missing' || y.chain === 'missing' ? 'incomplete' : 'matched';
    }
    return { ...r, integrity, primary_present: !!x, backup_present: !!y,
      primary_chain: x?.chain ?? null, backup_chain: y?.chain ?? null };
  }).sort((x,y) => y.timestamp - x.timestamp || y.seq - x.seq);
}
