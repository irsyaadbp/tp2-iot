import mqtt from 'mqtt';
import { randomBytes } from 'node:crypto';
import { ZERO_HASH, hashReading } from '../src/protocol.js';
if (process.env.CONFIRM_SYNTHETIC !== 'yes') throw new Error('Data ini sintetis, bukan Wokwi. Jalankan dengan CONFIRM_SYNTHETIC=yes hanya di lingkungan demo terpisah.');
const client = mqtt.connect(process.env.MQTT_URL, { username: process.env.MQTT_USERNAME || undefined, password: process.env.MQTT_PASSWORD || undefined });
const states = Object.fromEntries(['A','B','C'].map(device => [device,{session:randomBytes(8).toString('hex'),seq:0,hash:ZERO_HASH}]));
client.on('connect', () => console.log('Publisher data sintetis aktif (hentikan dengan Ctrl+C)'));
let busy = false;
setInterval(async () => {
  if (busy || !client.connected) return;
  busy = true;
  try {
    for (const device of ['A','B','C']) {
      const s = states[device];
      const r = {v:1,device,session:s.session,seq:s.seq+1,timestamp:Math.floor(Date.now()/1000),temp_centi:2500+Math.round(Math.random()*700),humidity_centi:5000+Math.round(Math.random()*2000),prev_hash:s.hash};
      r.hash = await hashReading(r);
      await new Promise((resolve,reject) => client.publish(process.env.MQTT_TOPIC.replace('+',device),JSON.stringify(r),{qos:1},error => error ? reject(error) : resolve()));
      s.seq = r.seq; s.hash = r.hash;
    }
  } finally { busy = false; }
},5000);
