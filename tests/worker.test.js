import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { neonConfig } from '@neondatabase/serverless';
import worker,{writePrimary,snapshot} from '../src/worker.js';
import {ZERO_HASH,normalize,hashReading} from '../src/protocol.js';
const token='unit-test-secret-12345678901234567890';
async function reading(){const r={v:1,device:'A',session:'1234567890abcdef',seq:1,timestamp:1791561000,temp_centi:2500,humidity_centi:6000,prev_hash:ZERO_HASH};r.hash=await hashReading(r);return normalize(r);}
async function database(){
  const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../migrations/0001_readings.sql',import.meta.url),'utf8'));
  const adapter={prepare(sql){let params=[];return{bind(...p){params=p;return this;},async run(){return db.prepare(sql).run(...params);},async first(){return db.prepare(sql).get(...params);},async all(){return{results:db.prepare(sql).all(...params)};}};}};
  return{db,adapter};
}
test('ingest rejects anonymous, malformed, and altered data before enqueue',async()=>{
  const messages=[],env={INGEST_TOKEN:token,NEON_DATABASE_URL:'postgresql://test:test@fake.neon.tech/test',READINGS:{async send(r){messages.push(r);}}},r=await reading();
  const request=(body,auth=token)=>new Request('https://example.com/api/ingest',{method:'POST',headers:{Authorization:`Bearer ${auth}`},body:typeof body==='string'?body:JSON.stringify(body)});
  assert.equal((await worker.fetch(request(r,'wrong'),env)).status,401);
  assert.equal((await worker.fetch(request('{'),env)).status,400);
  assert.equal((await worker.fetch(request({...r,temp_centi:3100}),env)).status,422);
  assert.equal(messages.length,0);
  assert.equal((await worker.fetch(request(r),env)).status,202);assert.equal(messages[0].id,r.id);
  assert.equal((await worker.fetch(request(r),{...env,NEON_DATABASE_URL:undefined})).status,503);
  assert.equal(messages.length,1,'No enqueue until Neon is configured');
});
test('D1 duplicate is idempotent and conflicting ID is refused',async()=>{
  const{db,adapter}=await database(),r=await reading();await writePrimary(adapter,r);await writePrimary(adapter,r);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM readings').get().n,1);
  await assert.rejects(()=>writePrimary(adapter,{...r,hash:'f'.repeat(64)}));db.close();
});
test('replication failure keeps D1 copy and retries without acknowledging',async()=>{
  const{db,adapter}=await database(),r=await reading();let ack=0,retry=0;
  await worker.queue({messages:[{body:r,ack(){ack++;},retry(){retry++;}}]},{DB:adapter});
  assert.equal(ack,0);assert.equal(retry,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM readings').get().n,1);db.close();
});
test('Neon driver success lets queue acknowledge after both copies exist',async()=>{
  const{db,adapter}=await database(),r=await reading();let ack=0,requests=0;
  neonConfig.fetchFunction=async(_url,options)=>{
    requests++;const body=JSON.parse(options.body),select=body.query.startsWith('SELECT');
    return Response.json({fields:select?[{name:'hash',dataTypeID:25}]:[],rows:select?[[r.hash]]:[],rowCount:1,command:select?'SELECT':'INSERT'});
  };
  try{
    await worker.queue({messages:[{body:r,ack(){ack++;},retry(){assert.fail('Must not retry');}}]},{DB:adapter,NEON_DATABASE_URL:'postgresql://test:test@fake.neon.tech/test'});
    assert.equal(ack,1);assert.equal(requests,2);
  }finally{neonConfig.fetchFunction=undefined;db.close();}
});
test('dashboard fallback uses Neon if D1 cannot be read',async()=>{
  const r=await reading(),fields=Object.keys(r).filter(k=>k!=='v');
  neonConfig.fetchFunction=async()=>Response.json({fields:fields.map(name=>({name,dataTypeID:['seq','timestamp','temp_centi','humidity_centi'].includes(name)?23:25})),rows:[fields.map(k=>String(r[k]))],rowCount:1,command:'SELECT'});
  try{
    const result=await snapshot({DB:{prepare(){throw new Error('D1 unavailable');}},NEON_DATABASE_URL:'postgresql://test:test@fake.neon.tech/test'});
    assert.equal(result.source,'Neon');assert.equal(result.records[0].integrity,'unavailable');assert.equal(result.clouds.primary,'unavailable');
  }finally{neonConfig.fetchFunction=undefined;}
});
