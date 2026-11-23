import {loadPrintFont,type PrintFonts} from '../lib/print-fonts';
import {coverDate,COVER_SUBTITLE} from '../lib/cover';
import {jsPDF} from 'jspdf';
import {compactPdfPages} from '../lib/pdf-memory';
import {timetableRuns} from '../lib/timetable-runs';
import {transitionLabel} from '../lib/page-header';
import {daySlots,makeTotp,type Slot} from '../lib/totp';
import {validatePdfRequest,requestDates,type PdfRequest} from '../lib/pdf-request';
const W=612,H=792;
function printTitle(s:string){return s.trim();}
self.onmessage=async(e:MessageEvent<PdfRequest&{fonts?:PrintFonts}>)=>{
 try{
  validatePdfRequest(e.data);
  const {edition,config,sample,date,full}=e.data;
  const doc=new jsPDF({unit:'pt',format:'letter',compress:true,putOnlyUsedFonts:true,floatPrecision:3});
  const pageStore=compactPdfPages(doc);
  for(const [file,style] of [['LiberationSans-Regular.ttf','normal'],['LiberationSans-Bold.ttf','bold']] as const){
   const font=e.data.fonts?.[file]??await loadPrintFont(file);
   doc.addFileToVFS(file,font);doc.addFont(file,'Liberation',style);
  }
  doc.setFont('Liberation');doc.setProperties({title:`${printTitle(edition.name)||'Personal'} Authenticator Reference Book ${edition.year}`,author:'Authenticator Reference Book'});
  const dates=requestDates(e.data);const codeAt=makeTotp(config);
  if(full){
   // Title, blank verso, edition details: the first morning starts on page 4 (left).
   for(let p=0;p<3;p++){
    const frontLeft=p%2===0?90:36;
    if(p)doc.addPage();doc.setTextColor(24,43,69);doc.setFont('Liberation','bold');doc.setFontSize(27);
    if(p===0){doc.text(COVER_SUBTITLE,frontLeft,140);doc.setFontSize(56);doc.text(String(edition.year),frontLeft,300);doc.setFontSize(18);doc.text(printTitle(edition.name)||'Personal edition',frontLeft,365);doc.setFontSize(11);doc.text(edition.zone,frontLeft,410);doc.setFont('Liberation','normal');doc.text('Reference book created on aviaviavi.wtf/totp',frontLeft,430);doc.text(`${coverDate(dates[0])} - ${coverDate(dates.at(-1)!)}`,frontLeft,455);if(sample)doc.text('SPECIMEN / PUBLIC DEMONSTRATION KEY',frontLeft,480);}
    if(p===2){doc.text('Edition details',frontLeft,100);doc.setFont('Liberation','normal');doc.setFontSize(12);doc.text([`Year: ${edition.year}`,`Dates: ${dates[0]} - ${dates.at(-1)}`,`Time zone: ${edition.zone}`,`Clock: ${edition.clock}-hour`,`TOTP: ${config.algorithm}, 6 digits, 30 seconds`,`Generated: ${new Date().toISOString()}`],frontLeft,155,{lineHeightFactor:1.8});}
   }
  }
  if(full)for(let p=1;p<=doc.getNumberOfPages();p++)pageStore.seal(p);
  let totalCodes=0;
  for(let d=0;d<dates.length;d++){
   const rows=daySlots(dates[d],edition.zone);
   for(let half=0;half<2;half++){
    if(full||d>0||half>0)doc.addPage();
    const left=half===0?36:90,right=half===0?90:36;
    const groups=new Map<string,Slot[]>();
    for(const s of rows.filter(r=>Math.floor(r.hour/12)===half)){const key=s.hour+'/'+s.offset;if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(s);}
    // Keep skipped whole hours in their timetable position, explicitly empty.
    for(let h=half*12;h<(half+1)*12;h++){
     if(![...groups.values()].some(slots=>slots[0]?.hour===h))groups.set(h+'/skipped',[]);
    }
    const orderedGroups=[...groups.entries()].sort(([a],[b])=>Number(a.split('/')[0])-Number(b.split('/')[0]));
    if(groups.size>13)throw Error('This date needs a special layout. Choose a different time zone for this proof.');
    const n=Math.max(12,groups.size),cw=(W-left-right)/n;
    const dateText=new Date(dates[d]+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'2-digit',year:'numeric',timeZone:'UTC'});
    doc.setTextColor(20);doc.setFont('Liberation','bold');doc.setFontSize(27);
    doc.text(dateText,half?W-right:left,56,{align:half?'right':'left'});
    doc.setFontSize(24);doc.text(half?'PM':'AM',half?left:W-right,56,{align:half?'left':'right'});
    doc.setFont('Liberation','normal');doc.setFontSize(7);
    doc.text(edition.zone,half?W-right:left,68,{align:half?'right':'left'});
    const transition=transitionLabel(rows,edition.clock);
    if(transition){doc.setFont('Liberation','bold');doc.setFontSize(7);doc.text(transition,left,80);}
    doc.setDrawColor(70);doc.setLineWidth(.4);doc.line(left,85,W-right,85);
    const hourCounts=new Map<number,number>();
    for(const slots of groups.values())if(slots.length)hourCounts.set(slots[0].hour,(hourCounts.get(slots[0].hour)||0)+1);
    const hourOccurrences=new Map<number,number>();
    let col=0;
    for(const [key,slots] of orderedGroups){
     const x=left+col++*cw,first=slots[0],hourNumber=Number(key.split('/')[0]);const hour=edition.clock==='12'?`${String(hourNumber%12||12).padStart(2,'0')}:00 ${half?'PM':'AM'}`:`${String(hourNumber).padStart(2,'0')}:00`;
     doc.setFont('Liberation','bold');doc.setFontSize(6.3);doc.text(hour,x,96);doc.setFont('Liberation','normal');
     if(!first){
      doc.setFontSize(4.7);doc.text('DST SKIPPED',x,103);
      doc.setLineWidth(.25);doc.line(x,107,x+cw-4,107);
      doc.setFontSize(6);doc.text(['No local','times in','this hour.'],x,122,{lineHeightFactor:1.4});continue;
     }
     const occurrence=(hourOccurrences.get(first.hour)||0)+1;hourOccurrences.set(first.hour,occurrence);
     const repeated=hourCounts.get(first.hour)!>1;
     doc.setFontSize(repeated?3.8:4.7);doc.text((repeated?(occurrence===1?'first / ':'second / '):'')+first.offset,x,103);
     doc.setLineWidth(.25);doc.line(x,107,x+cw-4,107);
     const rowSize=n===13?5.8:6.2;
     doc.setFont('Liberation','bold');doc.setFontSize(rowSize);
     const codeX=x+doc.getTextWidth('00:00')+.4;
     // Keep one text object per consecutive run, instead of three per code.
     // The printed positions, five-minute gaps, and bold minute markers are unchanged.
     for(const run of timetableRuns(slots)){
      const {row,y}=run;
      if(row%10===0&&Math.floor(row/10)%2===0){doc.setFillColor(238,238,238);doc.rect(x,y-5,cw-(n===13?1.5:2.3),9*5.1+6.1,'F');}
      const times=run.slots.map(s=>`${String(s.minute).padStart(2,'0')}:${s.second?'30':'00'}`);
      const codes=run.slots.map(s=>codeAt(s.epoch));
      const lineHeightFactor=5.1/rowSize;
      doc.setTextColor(65);doc.setFontSize(rowSize);
      if(row%10===0){
       doc.setFont('Liberation','bold');doc.text(times[0],x,y);
       doc.setFont('Liberation','normal');if(times.length>1)doc.text(times.slice(1),x,y+5.1,{lineHeightFactor});
      }else{doc.setFont('Liberation','normal');doc.text(times,x,y,{lineHeightFactor});}
      doc.setFont('Liberation','normal');doc.setTextColor(15);
      doc.text(codes.map(code=>code.slice(0,3)),codeX,y,{lineHeightFactor});
      doc.text(codes.map(code=>code.slice(3)),codeX+doc.getTextWidth('000')+.6,y,{lineHeightFactor});
      totalCodes+=codes.length;
     }
    }
    doc.setFont('Liberation','normal');doc.setFontSize(9);doc.setTextColor(100);const footer=(printTitle(edition.name)||'Personal account')+(sample?' / Sample codes':'');let footerSize=9;while(doc.getTextWidth(footer)>W-left-right-45&&footerSize>6){doc.setFontSize(--footerSize);}doc.text(footer,left,H-42);doc.setFontSize(9);doc.text(String(doc.getNumberOfPages()),W-right,H-42,{align:'right'});
   }
   for(let p=doc.getNumberOfPages()-1;p<=doc.getNumberOfPages();p++)pageStore.seal(p);
   self.postMessage({type:'progress',progress:Math.round((d+1)/dates.length*95)});
  }
  // Complete even page count, preserving left/right morning/afternoon pairing.
  if(full&&doc.getNumberOfPages()%2)doc.addPage();
  const pages=doc.getNumberOfPages(),buffer=pageStore.output();
  self.postMessage({type:'done',buffer,pages,totalCodes},[buffer]);
 }catch(err){self.postMessage({type:'error',message:err instanceof Error?err.message:'PDF generation failed.'});}
};
