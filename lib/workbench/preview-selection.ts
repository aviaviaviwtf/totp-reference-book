import {dateStart} from '../totp.ts';
import strings from '../../src/strings.json' with {type:'json'};
export type PreviewDetails={start:string;end:string;zone:string};
export type PreviewPage={number:number;label:string};
type PreviewLabels={title:string;details:string;page:string;clockChange:string};
const day=86_400_000;
function dateAt(start:string,index:number){return new Date(Date.parse(start+'T12:00:00Z')+index*day).toISOString().slice(0,10);}
function dateLabel(date:string){return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
export function previewPages(details:PreviewDetails|undefined,totalPages:number,labels?:PreviewLabels):PreviewPage[]{
 const wording=labels??{title:strings['pdf.title'],details:strings['pdf.details'],page:strings['pdf.page'],clockChange:strings['pdf.clockChange']};
 if(!details||totalPages<6)return Array.from({length:Math.min(totalPages,10)},(_,index)=>({number:index+1,label:`${wording.page} ${index+1}`}));
 const days=Math.round((Date.parse(details.end)-Date.parse(details.start))/day)+1;
 const changes:number[]=[];
 let previous=dateStart(details.start,details.zone);
 for(let index=0;index<days;index++){
  const next=dateStart(dateAt(details.start,index+1),details.zone);
  if(next-previous!==86400)changes.push(index);
  previous=next;
 }
 // Title and edition details plus four complete AM/PM days = ten preview pages.
 // Clock changes take priority, then representative dates across the selected half-year.
 const indices=[...new Set([...changes,0,Math.floor(days/2),days-1,Math.floor(days/4),...Array.from({length:days},(_,index)=>index)])].slice(0,4);
 return [{number:1,label:wording.title},{number:3,label:wording.details},...indices.flatMap(index=>['AM','PM'].map((half,offset)=>({number:4+index*2+offset,label:`${dateLabel(dateAt(details.start,index))} ${half}${changes.includes(index)?` (${wording.clockChange})`:''}`})))].filter(page=>page.number<=totalPages).sort((a,b)=>a.number-b.number);
}
