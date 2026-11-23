import {decodeBase32,yearDates,type OtpConfig} from './totp.ts';
import type {Edition} from './edition.ts';
import {titleIssue} from './workbench/title.ts';
export type PdfRequest={edition:Edition;config:OtpConfig;sample:boolean;date:string;full:boolean;half?:'first'|'second'};
export function requestDates(r:Pick<PdfRequest,'edition'|'full'|'date'|'half'>){
 const dates=yearDates(r.edition.year);
 return !r.full?[r.date]:r.half?dates.filter(d=>r.half==='first'?d.slice(5,7)<'07':d.slice(5,7)>='07'):dates;
}
export function validatePdfRequest(input:unknown):asserts input is PdfRequest {
 const r=input as PdfRequest;
 if(!r||typeof r.full!=='boolean'||typeof r.sample!=='boolean'||!r.edition||!r.config)throw Error('Invalid PDF request.');
 const {edition,config}=r;
 if(r.half!==undefined&&(!r.full||!['first','second'].includes(r.half)))throw Error('Choose a valid half-year edition.');
 const dates=yearDates(edition.year);
 if(!['12','24'].includes(edition.clock))throw Error('Choose a 12-hour or 24-hour clock.');
 if(typeof edition.name!=='string'||[...edition.name].length>60)throw Error('Use an edition name of 60 characters or fewer.');
 if(titleIssue(edition.name)==='characters')throw Error('The book fonts cannot print every character in this title.');
 if(typeof edition.zone!=='string'||!edition.zone)throw Error('Choose a time zone.');
 new Intl.DateTimeFormat('en',{timeZone:edition.zone});
 if(config.digits!==6||config.period!==30||!['SHA1','SHA256','SHA512'].includes(config.algorithm))throw Error('Only six-digit, 30-second TOTP is supported.');
 decodeBase32(config.secret);
 if(!r.full && (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!dates.includes(r.date)))throw Error('Choose a valid date in your edition year.');
}
