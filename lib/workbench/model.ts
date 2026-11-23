import {yearDates} from '../totp.ts';
export type Period='first'|'second'|'pair';
export function nextEdition(now=new Date()){
 return {year:now.getFullYear(),period:(now.getMonth()<6?'first':'second') as Period};
}
export function volumes(year:number,period:Period){
 const dates=yearDates(year);
 return (period==='pair'?['first','second']: [period]).map(half=>{
  const selected=dates.filter(date=>half==='first'?date.slice(5,7)<'07':date.slice(5,7)>='07');
  return {half:half as 'first'|'second',start:selected[0],end:selected.at(-1)!,pages:selected.length*2+4};
 });
}
export function setupLabels(input:string){
 if(!input.trim().startsWith('otpauth:'))return {website:'',account:''};
 const url=new URL(input.trim());let label=url.pathname.slice(1);
 try{label=decodeURIComponent(label);}catch{/* Preserve literal metadata when percent escapes are malformed. */}
 const colon=label.indexOf(':');
 return {website:url.searchParams.get('issuer')||(colon>=0?label.slice(0,colon):''),account:colon>=0?label.slice(colon+1):label};
}
export function titleFor(website:string,account:string){return [website.trim(),account.trim()].filter(Boolean).join(' – ');}

export function volumeDownloadName(key:string,title:string){
 const half=key.replace(/-(first|second)$/,(_,part)=>part==='first'?'-H1':'-H2');
 const safeTitle=title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'-').replace(/[. ]+$/g,'');
 return safeTitle?`${half} – ${safeTitle}`:half;
}
