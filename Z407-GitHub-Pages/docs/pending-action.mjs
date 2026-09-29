// Keep an unstarted NFC request across chooser dismissal and connection failures.
// Claim it before sending: a partial batch must never be replayed.
export class PendingAction {
 constructor(){this.request=null;}
 set(direction,count){this.request={direction,count};}
 cancel(){this.request=null;}
 async resume(speaker){
  if(!this.request||!speaker.ready||speaker.busy)return false;
  const {direction,count}=this.request;this.request=null;
  await speaker.send(direction,count);
  return true;
 }
}
