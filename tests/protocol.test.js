import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonical, ZERO_HASH, hashReading, normalize, compareClouds } from '../src/protocol.js';
async function reading(seq=1,prev_hash=ZERO_HASH){
  const r={v:1,device:'A',session:'1234567890abcdef',seq,timestamp:1791561000+seq,temp_centi:2750,humidity_centi:6025,prev_hash};
  r.hash=await hashReading(r);return normalize(r);
}
test('canonical bytes match ESP32 fixed-order JSON and Node SHA-256',async()=>{
  const r=await reading();
  const expected=`{"v":1,"device":"A","session":"1234567890abcdef","seq":1,"timestamp":1791561001,"temp_centi":2750,"humidity_centi":6025,"prev_hash":"${ZERO_HASH}"}`;
  assert.equal(canonical(r),expected);assert.equal(r.hash,createHash('sha256').update(expected).digest('hex'));
});
test('invalid devices, IDs, ranges, and nonzero genesis are rejected',async()=>{
  const r=await reading();for(const change of [{device:'D'},{seq:0},{timestamp:0},{temp_centi:9000},{humidity_centi:-1},{id:'spoofed'},{prev_hash:'a'.repeat(64)}])assert.throws(()=>normalize({...r,...change}));
});
test('both clouds matching does not hide tampered payload',async()=>{
  const r=await reading(),changed={...r,temp_centi:3300};
  assert.equal((await compareClouds([changed],[changed],{primary:true,backup:true}))[0].integrity,'tampered');
});
test('missing replica and unavailable cloud are distinct',async()=>{
  const r=await reading();assert.equal((await compareClouds([r],[],{primary:true,backup:true}))[0].integrity,'pending');
  assert.equal((await compareClouds([r],[],{primary:true,backup:false}))[0].integrity,'unavailable');
});
test('different valid payloads across clouds are a mismatch',async()=>{
  const a=await reading(),b={...a,temp_centi:3000};b.hash=await hashReading(b);
  assert.equal((await compareClouds([a],[b],{primary:true,backup:true}))[0].integrity,'mismatch');
});
test('hash chain links, detects breaks, and reports window boundary honestly',async()=>{
  const a=await reading(),b=await reading(2,a.hash),c=await reading(3,b.hash);
  const matched=await compareClouds([a,b,c],[a,b,c],{primary:true,backup:true});
  assert.ok(matched.every(r=>r.integrity==='matched'));assert.equal(matched[0].chain,'linked');
  const broken=await reading(2,'f'.repeat(64));
  assert.equal((await compareClouds([a,broken],[a,broken],{primary:true,backup:true}))[0].integrity,'tampered');
  const boundary=await compareClouds([c],[c],{primary:true,backup:true});assert.equal(boundary[0].chain,'outside-window');
  const gap=await compareClouds([a,c],[a,c],{primary:true,backup:true});assert.equal(gap[0].chain,'missing');assert.equal(gap[0].integrity,'incomplete');
});
