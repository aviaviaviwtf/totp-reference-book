import type {Slot} from './totp.ts';
export function transitionLabel(rows:Slot[],clock:'12'|'24'){
 const time=(seconds:number)=>{
  const hour=Math.floor(seconds/3600)%24,minute=Math.floor(seconds/60)%60;
  return `${String(clock==='12'?(hour%12||12):hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}${clock==='12'?(hour<12?' AM':' PM'):''}`;
 };
 for(let i=1;i<rows.length;i++){
  const prev=rows[i-1],next=rows[i];
  if(prev.offset===next.offset)continue;
  const before=prev.hour*3600+prev.minute*60+prev.second+30,after=next.hour*3600+next.minute*60+next.second;
  const minutes=(after-before)/60;
  return `DST ${minutes>0?'FORWARD':'BACK'} / ${time(before)} -> ${time(after)} / ${Math.abs(minutes)} minutes ${minutes>0?'skipped':'repeated; columns marked first / second'}`;
 }
 return '';
}
