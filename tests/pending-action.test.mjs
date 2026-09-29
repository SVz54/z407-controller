import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PendingAction} from '../docs/pending-action.mjs';
import {Speaker} from '../docs/ble.mjs';
test('forgotten browser permission ignores stale device and opens chooser',async()=>{
 let prompts=0;const selected={id:'new'};
 const speaker=new Speaker({getDevices:async()=>[],requestDevice:async()=>{prompts++;return selected;}});
 speaker.rememberedDevice={id:'old'};
 assert.equal(await speaker.selectDevice(true),selected);assert.equal(prompts,1);
});
test('no stored permission opens chooser immediately',async()=>{
 let prompts=0;const speaker=new Speaker({requestDevice:()=>{prompts++;return {};}});
 const result=speaker.selectDevice(true);assert.equal(prompts,1);await result;
});
test('saved permitted speaker needs no chooser',async()=>{
 const saved={id:'saved'};const speaker=new Speaker({getDevices:async()=>[saved],requestDevice:()=>assert.fail('unexpected chooser')});
 speaker.rememberedDevice=saved;assert.equal(await speaker.selectDevice(true),saved);
});
for(const direction of ['up','down'])test(`pending ${direction} survives failed connection and sends once after manual selection`,async()=>{
 const pending=new PendingAction();pending.set(direction,direction==='up'?12:13);
 const writes=[];const speaker={ready:false,busy:false,send:async(...args)=>writes.push(args)};
 assert.equal(await pending.resume(speaker),false);assert.ok(pending.request);
 speaker.ready=true;await Promise.all([pending.resume(speaker),pending.resume(speaker)]);
 assert.deepEqual(writes,[[direction,direction==='up'?12:13]]);assert.equal(pending.request,null);
});
test('release cancels waiting NFC request',async()=>{
 const pending=new PendingAction();pending.set('up',12);pending.cancel();
 assert.equal(await pending.resume({ready:true,send:()=>assert.fail('cancelled')}),false);
});
test('failed or partially sent batch is never replayed',async()=>{
 const pending=new PendingAction();pending.set('down',13);let calls=0;
 const speaker={ready:true,send:async()=>{calls++;throw Error('Disconnected');}};
 await assert.rejects(pending.resume(speaker));assert.equal(await pending.resume(speaker),false);assert.equal(calls,1);
});
test('unresponsive saved-device lookup falls back to chooser',async()=>{
 let prompts=0;const selected={id:'selected'};
 const speaker=new Speaker({getDevices:()=>new Promise(()=>{}),requestDevice:()=>{prompts++;return selected;}});
 speaker.rememberedDevice={id:'forgotten'};
 assert.equal(await speaker.selectDevice(true),selected);assert.equal(prompts,1);
});
test('rejected saved connection opens chooser and completes handshake',async()=>{
 let listener,prompts=0;
 const rx={addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>{},startNotifications:async()=>{}};
 const tx={properties:{writeWithoutResponse:true},writeValueWithoutResponse:async b=>listener({target:{value:new DataView(Uint8Array.from([212,b[1],1]).buffer)}})};
 const selected={id:'selected',addEventListener:()=>{},gatt:{connect:async()=>({getPrimaryService:async()=>({getCharacteristic:async id=>id.startsWith('c2e')?tx:rx})}),disconnect:()=>{}}};
 const stale={id:'stale',addEventListener:()=>{},gatt:{connect:async()=>{throw Error('Permission revoked');},disconnect:()=>{}}};
 const speaker=new Speaker({getDevices:async()=>[stale],requestDevice:()=>{prompts++;return selected;}});
 speaker.rememberedDevice=stale;assert.equal(await speaker.connect(),true);assert.equal(prompts,1);speaker.release();
});
test('retry chooser is invoked directly without awaiting saved-device lookup',async()=>{
 let prompts=0;const speaker=new Speaker({getDevices:()=>assert.fail('lookup loses activation'),requestDevice:()=>{prompts++;return {};}});
 speaker.needsChooser=true;const result=speaker.selectDevice(true);assert.equal(prompts,1);await result;
});
