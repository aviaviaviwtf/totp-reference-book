import {hmac} from '@noble/hashes/hmac.js';
import {sha1} from '@noble/hashes/legacy.js';
import {sha256,sha512} from '@noble/hashes/sha2.js';
export type OtpConfig={secret:string;algorithm:'SHA1'|'SHA256'|'SHA512';digits:6;period:30};
export const DEMO_SECRET='JBSWY3DPEHPK3PXP';
export function decodeBase32(raw:string):Uint8Array{
 const s=raw.toUpperCase().replace(/\s/g,'').replace(/=+$/,'');
 if(!/^[A-Z2-7]+$/.test(s)||s.length<16||s.length>256||![0,2,4,5,7].includes(s.length%8))throw Error('Enter a valid Base32 setup key (at least 16 characters).');
 let bits=0,value=0;const bytes:number[]=[];
 for(const c of s){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);value&=(1<<bits)-1;}}
 if(value!==0)throw Error('The setup key has invalid trailing bits.');
 return new Uint8Array(bytes);
}
export function parseSetup(input:string):OtpConfig{
 let secret=input.trim(),algorithm='SHA1',digits='6',period='30';
 if(secret.startsWith('otpauth:')){
  let u:URL;try{u=new URL(secret);}catch{throw Error('This authenticator setup link is not valid.');}
  if(u.protocol!=='otpauth:'||u.hostname!=='totp')throw Error('This edition supports time-based (TOTP) authenticators only.');
  secret=u.searchParams.get('secret')||'';algorithm=(u.searchParams.get('algorithm')||'SHA1').toUpperCase();digits=u.searchParams.get('digits')||'6';period=u.searchParams.get('period')||'30';
 }
 if(!['SHA1','SHA256','SHA512'].includes(algorithm))throw Error('This authenticator uses an unsupported hash algorithm.');
 if(digits!=='6'||period!=='30')throw Error('This edition supports six-digit codes changing every 30 seconds. Your setup has different parameters.');
 decodeBase32(secret);
 return {secret:secret.replace(/\s/g,'').replace(/=+$/,'').toUpperCase(),algorithm:algorithm as OtpConfig['algorithm'],digits:6,period:30};
}
export function makeTotp(config:OtpConfig){
 const key=decodeBase32(config.secret);const hash=config.algorithm==='SHA256'?sha256:config.algorithm==='SHA512'?sha512:sha1;
 return (unixSeconds:number,digits:number=6)=>{
  if(!Number.isFinite(unixSeconds)||unixSeconds<0)throw Error('Invalid timestamp');
  let counter=BigInt(Math.floor(unixSeconds/30));const bytes=new Uint8Array(8);
  for(let i=7;i>=0;i--){bytes[i]=Number(counter&255n);counter>>=8n;}
  const digest=hmac(hash,key,bytes),o=digest[digest.length-1]&15;
  const bin=((digest[o]&127)<<24)|(digest[o+1]<<16)|(digest[o+2]<<8)|digest[o+3];
  return (bin%10**digits).toString().padStart(digits,'0');
 };
}
export type Slot={epoch:number;date:string;hour:number;minute:number;second:number;offset:string};
export function timeFormatter(zone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'longOffset'});}
export function localSlot(epoch:number,fmt:Intl.DateTimeFormat):Slot{
 const p=Object.fromEntries(fmt.formatToParts(new Date(epoch*1000)).map(p=>[p.type,p.value]));
 return {epoch,date:`${p.year}-${p.month}-${p.day}`,hour:+p.hour,minute:+p.minute,second:+p.second,offset:p.timeZoneName.replace('GMT','UTC')};
}
// First epoch whose local date is the target. Date changes are monotonic in the supported modern zones.
export function dateStart(date:string,zone:string){
 const fmt=timeFormatter(zone),utc=Date.parse(date+'T00:00:00Z')/1000;let lo=utc-86400,hi=utc+86400;
 while(lo<hi){const mid=Math.floor((lo+hi)/2);if(localSlot(mid,fmt).date<date)lo=mid+1;else hi=mid;}
 if(localSlot(lo,fmt).date!==date)throw Error('This local date does not exist in the selected time zone.');
 return lo;
}
export function daySlots(date:string,zone:string):Slot[]{
 const start=dateStart(date,zone),endDate=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10),end=dateStart(endDate,zone),fmt=timeFormatter(zone),rows:Slot[]=[];
 for(let t=start;t<end;t+=30)rows.push(localSlot(t,fmt));return rows;
}
export const maxEditionYear=()=>new Date().getUTCFullYear()+5;
export const MAX_EDITION_YEAR=maxEditionYear();
export function yearDates(year:number){const maximum=maxEditionYear();if(!Number.isInteger(year)||year<2026||year>maximum)throw Error(`Choose a year from 2026 to ${maximum}.`);const dates:string[]=[];for(let t=Date.UTC(year,0,1);t<Date.UTC(year+1,0,1);t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));return dates;}
export const ZONES=['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Kolkata','Asia/Tokyo','Australia/Sydney','Australia/Lord_Howe','UTC'];
