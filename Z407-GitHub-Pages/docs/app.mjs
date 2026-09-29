import {Speaker} from './ble.mjs?v=4';
import {PendingAction} from './pending-action.mjs';
const pendingAction=new PendingAction();
import {actionFromPath} from './actions.mjs';
const $=id=>document.getElementById(id);
const counts=()=>{const up=Number($('up').value),down=Number($('down').value);if(![up,down].every(n=>Number.isInteger(n)&&n>=1&&n<=1000))throw Error('Enter whole numbers from 1 to 1000 in both boxes.');return {up,down};};
try{const saved=JSON.parse(localStorage.getItem('z407-counts'));for(const key of ['up','down'])if(Number.isInteger(saved?.[key])&&saved[key]>=1&&saved[key]<=1000)$(key).value=saved[key];}catch{}
const speaker=new Speaker(navigator.bluetooth,s=>{
 if(!$('actionPanel').hidden)$('actionMessage').textContent=s.message||s.status;
 $('status').textContent=s.status;$('dot').classList.toggle('connected',s.ready);$('message').textContent=s.message;
 $('connect').textContent=s.needsChooser?'Choose speaker':'Connect';
 $('connect').disabled=s.ready||s.connecting||s.busy||!navigator.bluetooth;$('release').disabled=!s.ready&&!s.connecting&&!pendingAction.request;
 $('retryAction').disabled=s.connecting||s.busy;
 $('forget').disabled=s.connecting||s.busy;
 document.querySelectorAll('[data-ready]').forEach(b=>b.disabled=!s.ready||s.busy);
 $('slider').disabled=!s.ready||s.busy;$('stop').hidden=!s.busy;$('input').textContent=`INPUT ${s.input.toUpperCase()}`;
 document.querySelectorAll('.inputs button').forEach(b=>b.classList.toggle('selected',b.textContent===s.input));
});
function run(fn){Promise.resolve().then(fn).catch(e=>{$('message').textContent=e.message;});}
function labels(){$('sendDown').textContent=`Send −${$('down').value}`;$('sendUp').textContent=`Send +${$('up').value}`;}
$('connect').onclick=()=>connectAndContinue();
$('forget').onclick=()=>{speaker.forget();connectAndContinue(true);};
$('release').onclick=()=>{pendingAction.cancel();$('retryAction').hidden=true;speaker.release();};
$('stop').onclick=()=>{pendingAction.cancel();speaker.stop();};
$('save').onclick=()=>run(()=>{localStorage.setItem('z407-counts',JSON.stringify(counts()));$('message').textContent='Counts saved on this device. No commands sent.';});
for(const key of ['up','down']){$(key).oninput=labels;$(key).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run(()=>speaker.send(key,counts()[key]));}};}
$('sendUp').onclick=()=>run(()=>speaker.send('up',counts().up));$('sendDown').onclick=()=>run(()=>speaker.send('down',counts().down));
$('slider').onchange=()=>{const value=Number($('slider').value);$('slider').value=0;if(Math.abs(value)>5)run(()=>{const key=value>0?'up':'down';return speaker.send(key,counts()[key]);});};
$('slider').addEventListener('pointercancel',()=>{$('slider').value=0;});
document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>run(()=>speaker.send(b.dataset.command)));
if(!navigator.bluetooth){$('support').textContent='Open this address in Bluefy on your iPhone. Safari cannot connect to the speaker.';speaker.message='Bluetooth browser needed: use Bluefy.';}
labels();speaker.changed();

// A dedicated action path carries a single request; ordinary opening never sends bass.
const action = actionFromPath(location.pathname);
if(action)history.replaceState(null,'',new URL('./',location.href).pathname);
function savedCounts(){
 let saved;try{saved=JSON.parse(localStorage.getItem('z407-counts'));}catch{}
 return {up:Number.isInteger(saved?.up)&&saved.up>=1&&saved.up<=1000?saved.up:12,
 down:Number.isInteger(saved?.down)&&saved.down>=1&&saved.down<=1000?saved.down:13};
}
async function connectAndContinue(forceChooser=false){
 if(speaker.connecting||speaker.busy)return;
 $('retryAction').hidden=true;
 try {
  const connected=await speaker.connect({allowPrompt:true,forceChooser});
  if(!connected)throw Error(speaker.message||'Could not connect to your speaker.');
  const sent=await pendingAction.resume(speaker);
  if(sent&&speaker.ready){const result=speaker.message;speaker.release(false);speaker.message=result+' · Connection released.';speaker.changed();}
 } catch(error) {
  $('message').textContent=error.message;
  if(pendingAction.request){
   const {direction,count}=pendingAction.request;
   $('actionMessage').textContent=`Waiting to send ${count} bass ${direction} commands. Tap below to select your speaker and continue. ${error.message}`;
   $('retryAction').textContent='Choose speaker and continue';
   $('retryAction').hidden=!navigator.bluetooth;
  }
 } finally { $('release').disabled=!speaker.ready&&!speaker.connecting&&!pendingAction.request; }
}
$('retryAction').onclick=()=>connectAndContinue(true);
function executeAction(direction){
 const count=savedCounts()[direction];
 pendingAction.set(direction,count);
 $('actionPanel').hidden=false;
 $('actionTitle').textContent=`NFC: bass ${direction} × ${count}`;
 $('actionMessage').textContent='NFC request received. Connecting to your speaker…';
 $('nfcNote').textContent=`NFC request: ${count} bass ${direction} commands.`;
 return connectAndContinue();
}
function shortcutURL(direction){
 // Bluefy's documented URL scheme takes the destination host/path in its url parameter.
 const path=new URL(`./bass-${direction}.html`,location.href);
 return `bluefy://open?url=${path.host}${path.pathname}`;
}
async function copyShortcut(direction){
 const value=shortcutURL(direction);$('shortcutLink').hidden=false;$('shortcutLink').value=value;
 try{await navigator.clipboard.writeText(value);$('nfcNote').textContent='Link copied. Paste it into the Open URLs action for your NFC automation.';}
 catch{$('shortcutLink').select();$('nfcNote').textContent='Select and copy the link below, then paste it into Shortcuts.';}
}
$('copyUp').onclick=()=>copyShortcut('up');$('copyDown').onclick=()=>copyShortcut('down');
if(action)run(()=>executeAction(action));
