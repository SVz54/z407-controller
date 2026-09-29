import {test} from 'node:test';import assert from 'node:assert/strict';import {Speaker,COMMANDS} from '../docs/ble.mjs';
function fake(){const s=new Speaker(null,()=>{},30);s.ready=true;const writes=[];s.tx={properties:{writeWithoutResponse:true},writeValueWithoutResponse:async bytes=>{writes.push([...bytes]);}};return {s,writes,ack:(bytes)=>s.notify({target:{value:new DataView(Uint8Array.from(bytes).buffer)}})};}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('commands match documented protocol',()=>{assert.deepEqual(COMMANDS,{up:[128,0],down:[128,1],play:[128,4],next:[128,5],previous:[128,6],bluetooth:[129,1],aux:[129,2],usb:[129,3],pairing:[130,0]});});
test('12 individual up commands, matching ACK gate',async()=>{const {s,writes,ack}=fake();s.timeout=1000;const p=s.send('up',12);for(let i=1;i<=12;i++){while(writes.length<i)await delay(5);assert.equal(writes.length,i);ack([192,1]);assert.ok(s.pending);ack([192,0]);}await p;assert.equal(writes.length,12);assert.equal(s.busy,false);assert.match(s.message,/12 \/ 12/);});
test('stop cancels all unsent commands',async()=>{const {s,writes,ack}=fake();const p=s.send('down',13);s.stop();ack([192,1]);await p;assert.equal(writes.length,1);});
test('timeout disconnects, does not replay',async()=>{const {s,writes}=fake();await s.send('up',12);assert.equal(writes.length,1);assert.equal(s.ready,false);assert.equal(s.busy,false);assert.match(s.message,/No speaker confirmation/);});
test('release cancels in flight',async()=>{const {s,writes}=fake();const p=s.send('down',13);s.release();await p;assert.equal(writes.length,1);assert.equal(s.ready,false);});
test('invalid counts never write',async()=>{const {s,writes}=fake();for(const n of [0,-1,1.5,1001,NaN])await assert.rejects(s.send('up',n));assert.equal(writes.length,0);});
test('full handshake subscribes before writing',async()=>{let listener;const writes=[];const rx={addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>{},startNotifications:async()=>writes.push('subscribe')};const tx={properties:{writeWithoutResponse:true},writeValueWithoutResponse:async b=>{writes.push([...b]);const response=b[1]===5?[212,5,1]:[212,0,1];listener({target:{value:new DataView(Uint8Array.from(response).buffer)}});}};const service={getCharacteristic:async id=>id.startsWith('c2e')?tx:rx};const device={addEventListener:()=>{},gatt:{connect:async()=>({getPrimaryService:async()=>service}),disconnect:()=>{}}};const s=new Speaker({requestDevice:async()=>device});await s.connect();assert.equal(s.ready,true);assert.deepEqual(writes,['subscribe',[132,5],[132,0]]);s.release();});
test('remembered device reconnect avoids chooser, including after reload',async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const device={id:'only-speaker'};let prompts=0;
 const bluetooth={requestDevice:async()=>{prompts++;return device;},getDevices:async()=>[device]};
 const first=new Speaker(bluetooth);assert.equal(await first.selectDevice(true),device);first.remember(device);
 const reloaded=new Speaker(bluetooth);assert.equal(await reloaded.selectDevice(false),device);assert.equal(prompts,1);
 delete globalThis.localStorage;
});
test('automatic NFC connection cannot open chooser without permission',async()=>{
 let prompts=0;const s=new Speaker({requestDevice:async()=>{prompts++;}});
 assert.equal(await s.connect({allowPrompt:false}),false);assert.equal(prompts,0);assert.match(s.message,/Select your speaker once/);
});
test('saved device never silently switches to another remembered speaker',async()=>{
 globalThis.localStorage={getItem:()=> 'my-speaker'};let prompts=0;
 const s=new Speaker({getDevices:async()=>[{id:'someone-else'}],requestDevice:async()=>{prompts++;}});
 await assert.rejects(s.selectDevice(false));assert.equal(prompts,0);delete globalThis.localStorage;
});
