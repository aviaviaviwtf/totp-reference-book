import type {Slot} from './totp.ts';
/** Consecutive lines share PDF text state; break at every five-minute spacing gap. */
export function timetableRuns(slots:Slot[]){
 const runs:Array<{row:number;y:number;slots:Slot[]}>=[];
 for(const slot of slots){
  const row=slot.minute*2+slot.second/30,previous=runs.at(-1);
  if(previous&&row===previous.row+previous.slots.length&&Math.floor(row/10)===Math.floor(previous.row/10))previous.slots.push(slot);
  else runs.push({row,y:118+row*5.1+Math.floor(row/10),slots:[slot]});
 }
 return runs;
}
