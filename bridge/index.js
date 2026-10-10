import mqtt from 'mqtt';
import { DatabaseSync } from 'node:sqlite';
import { normalize, hashReading } from '../src/protocol.js';

const { MQTT_URL, MQTT_TOPIC, API_URL, INGEST_TOKEN } = process.env;
if (!MQTT_URL || !MQTT_TOPIC || !API_URL || !INGEST_TOKEN || INGEST_TOKEN.length < 32) throw new Error('Lengkapi bridge/.env');
const endpoint = new URL(API_URL);
if (endpoint.protocol !== 'https:' && !['127.0.0.1','localhost'].includes(endpoint.hostname)) throw new Error('Gunakan HTTPS untuk API remote');
const db = new DatabaseSync(process.env.SPOOL_PATH || 'bridge/spool.sqlite');
db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS spool (id TEXT PRIMARY KEY, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS rejected (id TEXT PRIMARY KEY, payload TEXT NOT NULL, reason TEXT NOT NULL);`);
const insert = db.prepare('INSERT INTO spool(id,payload) VALUES (?,?) ON CONFLICT(id) DO NOTHING');
const client = mqtt.connect(MQTT_URL, { clientId: process.env.MQTT_CLIENT_ID || 'tp2-irsyaad-bridge-7fa913c2', clean: false,
  username: process.env.MQTT_USERNAME || undefined, password: process.env.MQTT_PASSWORD || undefined, reconnectPeriod: 3000 });
client.on('connect', () => client.subscribe(MQTT_TOPIC, { qos: 1 }, error => {
  if (error) console.error('Subscribe gagal'); else console.log('Bridge MQTT terhubung');
}));
client.on('error', () => console.error('Koneksi MQTT bermasalah; akan mencoba ulang'));
client.handleMessage = async (packet, done) => {
  let r;
  try {
    r = normalize(JSON.parse(packet.payload.toString()));
    if (packet.topic !== MQTT_TOPIC.replace('+', r.device)) throw new Error('Topic mismatch');
    if (await hashReading(r) !== r.hash) throw new Error('Hash mismatch');
  } catch (error) {
    console.warn('Pesan ditolak:', error.message);
    done(); return;
  }
  try {
    const existing = db.prepare('SELECT payload FROM spool WHERE id=?').get(r.id);
    if (existing && JSON.parse(existing.payload).hash !== r.hash) throw new Error('ID conflict');
    insert.run(r.id, JSON.stringify(r));
    done();
  } catch (error) {
    console.error('Penyimpanan spool gagal; MQTT belum diakui');
    done(error);
  }
};
let busy = false;
async function flush() {
  if (busy) return;
  busy = true;
  try {
    for (const row of db.prepare('SELECT * FROM spool WHERE next_at <= ? ORDER BY rowid LIMIT 20').all(Date.now())) {
      try {
        const response = await fetch(API_URL, { method: 'POST', headers: { Authorization: `Bearer ${INGEST_TOKEN}`, 'Content-Type': 'application/json' }, body: row.payload, signal: AbortSignal.timeout(15000) });
        if (response.status === 202) { db.prepare('DELETE FROM spool WHERE id=?').run(row.id); console.log('Antrean cloud menerima', row.id); }
        else if ([400,413,422].includes(response.status)) {
          db.prepare('INSERT OR REPLACE INTO rejected VALUES (?,?,?)').run(row.id,row.payload,`HTTP ${response.status}`);
          db.prepare('DELETE FROM spool WHERE id=?').run(row.id);
          console.warn('Payload perlu diperiksa',row.id,response.status);
        } else throw new Error(`HTTP ${response.status}`);
      } catch {
        const delay = Math.min(300000, 1000 * 2 ** Math.min(row.attempts,8));
        db.prepare('UPDATE spool SET attempts=attempts+1,next_at=? WHERE id=?').run(Date.now()+delay,row.id);
        console.warn('Pengiriman tertunda',row.id);
      }
    }
  } finally { busy = false; }
}
const timer = setInterval(flush,1000);
process.on('SIGINT', () => { clearInterval(timer); client.end(false, {}, () => process.exit(0)); });
