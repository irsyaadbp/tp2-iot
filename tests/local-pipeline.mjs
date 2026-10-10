import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { Aedes } from 'aedes';
import mqtt from 'mqtt';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { ZERO_HASH, hashReading } from '../src/protocol.js';

const API='http://127.0.0.1:8787';
const key=(await readFile(new URL('../.dev.vars',import.meta.url),'utf8')).match(/^INGEST_TOKEN=(.+)$/m)?.[1];
assert.ok(key,'Siapkan .dev.vars dan jalankan npm run dev');
const broker=await Aedes.createBroker({maxClientsIdLength:100});
const server=createServer(broker.handle);
await new Promise(resolve=>server.listen(1884,'127.0.0.1',resolve));
const work=new URL('../../../work/pipeline/',import.meta.url);await mkdir(work,{recursive:true});
const child=spawn(process.execPath,['bridge/index.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,MQTT_URL:'mqtt://127.0.0.1:1884',MQTT_TOPIC:'qa/tp2/+/telemetry',MQTT_CLIENT_ID:'tp2-qa-bridge',API_URL:API+'/api/ingest',INGEST_TOKEN:key,SPOOL_PATH:new URL('spool.sqlite',work).pathname},stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',b=>{log+=b;});child.stderr.on('data',b=>{log+=b;});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let publisher;
try{
  for(let n=0;n<30&&!log.includes('terhubung');n++)await wait(200);
  assert.ok(log.includes('terhubung'),'Bridge harus terhubung ke broker lokal');
  publisher=mqtt.connect('mqtt://127.0.0.1:1884',{clientId:'qa-publisher'});
  await new Promise((resolve,reject)=>{publisher.once('connect',resolve);publisher.once('error',reject);});
  const ids=[];
  for(const device of ['A','B','C']) {
    const session=randomBytes(8).toString('hex');let previous=ZERO_HASH;
    for(let seq=1;seq<=3;seq++) {
      const r={v:1,device,session,seq,timestamp:Math.floor(Date.now()/1000)-15+seq*5,temp_centi:2600+(device.charCodeAt(0)-65)*100+seq*20,humidity_centi:6000+seq*50,prev_hash:previous};
      r.hash=await hashReading(r);previous=r.hash;ids.push(`${device}:${session}:${seq}`);
      for(let duplicate=0;duplicate<2;duplicate++)await new Promise((resolve,reject)=>publisher.publish(`qa/tp2/${device}/telemetry`,JSON.stringify(r),{qos:1},error=>error?reject(error):resolve()));
    }
  }
  let snapshot;
  for(let n=0;n<30;n++){
    await wait(500);snapshot=await(await fetch(API+'/api/snapshot')).json();
    if(ids.every(id=>snapshot.records.some(r=>r.id===id)))break;
  }
  assert.ok(ids.every(id=>snapshot.records.some(r=>r.id===id)),'Sembilan pembacaan harus tersimpan');
  assert.equal(snapshot.records.filter(r=>ids.includes(r.id)).length,9,'Pesan duplikat tidak membuat baris ganda');
  console.log('PASS: MQTT QoS1 → spool SQLite → HTTP ingest → Cloudflare Queue lokal → D1; 9 pembacaan, 18 publikasi, tanpa duplikasi. Data uji hanya di D1 lokal.');
}finally{
  if(publisher)await new Promise(resolve=>publisher.end(true,{},resolve));
  child.kill('SIGINT');await new Promise(resolve=>child.once('exit',resolve));
  await new Promise(resolve=>broker.close(resolve));await new Promise(resolve=>server.close(resolve));
}
