import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePdfRequest} from '../lib/pdf-request.ts';
import {DEFAULT_EDITION} from '../lib/edition.ts';
import {parseSetup,DEMO_SECRET,MAX_EDITION_YEAR} from '../lib/totp.ts';
const request={edition:{...DEFAULT_EDITION,name:'Specimen'},config:parseSetup(DEMO_SECRET),sample:true,date:'2028-02-29',full:false};
test('PDF request accepts a leap day in its edition and a complete year',()=>{
 assert.doesNotThrow(()=>validatePdfRequest({...request,edition:{...request.edition,year:2028}}));
 assert.doesNotThrow(()=>validatePdfRequest({...request,full:true}));
});
test('PDF request rejects invalid calendar dates, mismatched years, unsupported timezones and parameters',()=>{
 for(const date of ['2027-02-29','2027-04-31','2028-02-29','2027-01-01junk','']) assert.throws(()=>validatePdfRequest({...request,date}));
 assert.throws(()=>validatePdfRequest({...request,date:'2027-01-01',edition:{...request.edition,zone:'Mars/Olympus'}}));
 assert.throws(()=>validatePdfRequest({...request,full:true,config:{...request.config,period:60}}));
 assert.throws(()=>validatePdfRequest({...request,full:true,edition:{...request.edition,clock:'13'}}));
 assert.throws(()=>validatePdfRequest({...request,full:true,edition:{...request.edition,year:MAX_EDITION_YEAR+1}}));
});

test('half-year ranges have correct boundaries and page counts',async()=>{
 const {requestDates}=await import('../lib/pdf-request.ts');
 for(const [year,half,count,start,end] of [[2026,'first',181,'01-01','06-30'],[2028,'first',182,'01-01','06-30'],[2026,'second',184,'07-01','12-31']] as const){
  const r={...request,edition:{...request.edition,year},full:true,half};validatePdfRequest(r);
  const dates=requestDates(r);assert.equal(dates.length,count);assert.equal(dates[0],`${year}-${start}`);assert.equal(dates.at(-1),`${year}-${end}`);
 }
 assert.throws(()=>validatePdfRequest({...request,full:false,half:'second'}));
 assert.throws(()=>validatePdfRequest({...request,full:true,half:'bad'}));
});
