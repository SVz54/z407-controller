async function bounded(promise,ms,message){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}
}
export const UUID = {service:'0000fdc2-0000-1000-8000-00805f9b34fb',command:'c2e758b9-0e78-41e0-b0cb-98a593193fc5',response:'b84ac9c6-29c5-46d4-bba1-9d534784330f'};
export const COMMANDS = {up:[128,0],down:[128,1],play:[128,4],next:[128,5],previous:[128,6],bluetooth:[129,1],aux:[129,2],usb:[129,3],pairing:[130,0]};
export class Speaker {
 constructor(bluetooth, onChange=()=>{}, timeout=4000) { this.bluetooth=bluetooth;this.onChange=onChange;this.timeout=timeout;this.ready=false;this.busy=false;this.connecting=false;this.status='Disconnected';this.input='Unknown';this.message='';this.epoch=0; }
 changed(){this.onChange(this);}
 notify(event){const bytes=Array.from(new Uint8Array(event.target.value.buffer,event.target.value.byteOffset,event.target.value.byteLength));if(bytes[0]===207){this.input=({4:'Bluetooth',5:'AUX',6:'USB'})[bytes[1]]||this.input;this.changed();}if(this.pending?.match(bytes))this.pending.resolve();}
 async exchange(bytes,match){
  if(this.pending)throw Error('Another command is still pending.');
  let resolve,reject;const confirmation=new Promise((a,b)=>{resolve=a;reject=b;});
  const timer=setTimeout(()=>reject(Error('No speaker confirmation. Remaining commands cancelled.')),this.timeout);
  this.pending={match,resolve,reject};
  try {
   const write=this.tx.properties.writeWithoutResponse ? this.tx.writeValueWithoutResponse.bind(this.tx) : (this.tx.writeValueWithResponse?.bind(this.tx)||this.tx.writeValue.bind(this.tx));
   await Promise.all([write(Uint8Array.from(bytes)),confirmation]);
  } finally {clearTimeout(timer);this.pending=null;}
 }
 remember(device){
  this.rememberedDevice=device;
  try{if(device.id)localStorage.setItem('z407-speaker-id',device.id);}catch{}
 }
 forget(){this.release();this.rememberedDevice=null;try{localStorage.removeItem('z407-speaker-id');}catch{} this.message='Speaker forgotten. Press Connect to select it again.';this.changed();}
 async selectDevice(allowPrompt,forceChooser=false){
  if(forceChooser||this.needsChooser){this.needsChooser=true;return this.bluetooth.requestDevice({filters:[{services:[UUID.service]}],optionalServices:[UUID.service]});}
  let id=this.rememberedDevice?.id;try{id=id||localStorage.getItem('z407-speaker-id');}catch{}
  if(id && this.bluetooth.getDevices){
   let devices;try{devices=await bounded(this.bluetooth.getDevices(),1500,'Saved speaker lookup timed out.');}catch{}
   if(devices){
    const match=devices.find(d=>d.id===id);if(match)return match;
    this.rememberedDevice=null;
    try{localStorage.removeItem('z407-speaker-id');}catch{}
   }else {this.rememberedDevice=null;}
  }else if(this.rememberedDevice)return this.rememberedDevice;
  if(!allowPrompt)throw Error('Select your speaker once on this new site using Connect. Bluefy must remember permission before NFC can connect automatically.');
  this.needsChooser=true;
  return this.bluetooth.requestDevice({filters:[{services:[UUID.service]}],optionalServices:[UUID.service]});
 }
 async connect({allowPrompt=true,forceChooser=false}={}){
  if(this.ready)return true;
  if(this.connecting||this.busy||this.pending)return false;
  if(!this.bluetooth)throw Error('Open this page in Bluefy on iPhone. Safari does not support this Bluetooth connection.');
  this.connecting=true;const epoch=++this.epoch;this.status='Connecting to your Z407';this.message='Release the Mac app and remove the puck batteries first.';this.changed();
  let device;
  const check=()=>{if(epoch!==this.epoch){device?.gatt.disconnect();throw Error('Connection cancelled.');}};
  try{
   device=await this.selectDevice(allowPrompt,forceChooser);check();this.device=device;this.rememberedDevice=device;
   device.addEventListener('gattserverdisconnected',()=>{if(this.device===device){this.ready=false;this.input='Unknown';this.pending?.reject(Error('Speaker disconnected. Remaining commands cancelled.'));this.status='Disconnected';this.changed();}});
   this.status='Connecting…';this.changed();let server;
   try {server=await bounded(device.gatt.connect(),8000,'Saved speaker did not respond.');check();}
   catch(error){
    check();
    if(this.needsChooser||!allowPrompt)throw error;
    this.device=null;device.gatt.disconnect();this.rememberedDevice=null;
    try{localStorage.removeItem('z407-speaker-id');}catch{}
    this.needsChooser=true;this.status='Choose your speaker';this.message='Saved connection unavailable. Select your speaker again.';this.changed();
    device=await this.selectDevice(true,true);check();this.device=device;
    device.addEventListener('gattserverdisconnected',()=>{if(this.device===device){this.ready=false;this.pending?.reject(Error('Speaker disconnected.'));this.status='Disconnected';this.changed();}});
    server=await bounded(device.gatt.connect(),8000,'Speaker did not respond. Release other controllers and try again.');check();
   }
   const service=await server.getPrimaryService(UUID.service);check();
   this.tx=await service.getCharacteristic(UUID.command);check();const rx=await service.getCharacteristic(UUID.response);check();
   this.rx=rx;this.listener=this.notify.bind(this);rx.addEventListener('characteristicvaluechanged',this.listener);await rx.startNotifications();check();
   await this.exchange([132,5],b=>b.join(',')==='212,5,1');check();
   await this.exchange([132,0],b=>b.join(',')==='212,0,1'||b.join(',')==='212,0,3');check();
   this.needsChooser=false;this.remember(device);this.ready=true;this.status='Connected';this.message='Ready. This speaker will be used next time.';
  }catch(error){if(epoch===this.epoch){this.release(false);this.status='Not connected';this.message=error.name==='NotFoundError'?'No speaker selected. Release other controllers, then try Connect again.':error.message;}}
  finally{if(epoch===this.epoch||!this.connecting){this.connecting=false;this.changed();}}
  return this.ready;
 }
 release(show=true){this.epoch++;this.stopRequested=true;this.ready=false;this.connecting=false;this.input='Unknown';this.pending?.reject(Error('Released for puck. Remaining commands cancelled.'));if(this.rx&&this.listener)this.rx.removeEventListener('characteristicvaluechanged',this.listener);const device=this.device;this.device=null;device?.gatt.disconnect();this.status='Released for puck';if(show)this.message='Control released. Press Connect to take control again.';this.changed();}
 stop(){this.stopRequested=true;this.message='Stopping after the command already in flight.';this.changed();}
 async send(name,count=1){
  if(!this.ready||this.busy)return;
  if(!COMMANDS[name]||!Number.isInteger(count)||count<1||count>1000)throw Error('Enter a whole number from 1 to 1000.');
  if(name!=='up'&&name!=='down')count=1;
  this.busy=true;this.stopRequested=false;let confirmed=0;const bytes=COMMANDS[name];this.changed();
  try{for(let i=0;i<count&&!this.stopRequested;i++){
   if(!this.ready)throw Error('Disconnected. Remaining commands cancelled.');
   this.message=`Sending ${name}: ${confirmed} / ${count} confirmed`;this.changed();
   await this.exchange(bytes,b=>b.length===2&&b[0]===bytes[0]+64&&b[1]===bytes[1]);confirmed++;
   this.message=`${this.stopRequested?'Stopped. ':''}${confirmed} / ${count} confirmed`;this.changed();
   if(i+1<count&&!this.stopRequested)await new Promise(r=>setTimeout(r,80));
  }
  if(name==='pairing'&&confirmed)this.message='Pairing request confirmed. Select Logi Z407 in your audio device’s Bluetooth settings.';
  }catch(error){this.release(false);this.message=error.message;}
  finally{this.busy=false;this.changed();}
 }
}
