import test from 'node:test';
import assert from 'node:assert/strict';
import {browserTimeZone,timeZoneOptions} from '../lib/time-zone-options.ts';
test('the initial book location uses the browser time zone, including aliases missing from supportedValuesOf',t=>{
 const browserOptions=new Intl.DateTimeFormat().resolvedOptions();
 t.mock.method(Intl.DateTimeFormat.prototype,'resolvedOptions',()=>({...browserOptions,timeZone:'Asia/Kolkata'}));
 assert.equal(browserTimeZone(),'Asia/Kolkata');
 assert.deepEqual(timeZoneOptions([browserTimeZone()],new Date('2026-01-15T12:00:00Z')),[{value:'Asia/Kolkata',label:'UTC + 05:30 – Kolkata'}]);
});
test('an unavailable or invalid browser location falls back to UTC',t=>{
 const browserOptions=new Intl.DateTimeFormat().resolvedOptions();
 const resolvedOptions=t.mock.method(Intl.DateTimeFormat.prototype,'resolvedOptions',()=>({...browserOptions,timeZone:'not-a-location'}));
 assert.equal(browserTimeZone(),'UTC');
 resolvedOptions.mock.mockImplementation(()=>({...browserOptions,timeZone:''}));
 assert.equal(browserTimeZone(),'UTC');
 resolvedOptions.mock.mockImplementation(()=>{throw new Error('Location unavailable');});
 assert.equal(browserTimeZone(),'UTC');
});
test('time zones sort by signed UTC offset and retain IANA identities and fractional offsets',()=>{
 const result=timeZoneOptions(['Asia/Kathmandu','UTC','America/New_York','Pacific/Honolulu','Asia/Kathmandu'],new Date('2026-01-15T12:00:00Z'));
 assert.deepEqual(result,[{value:'Pacific/Honolulu',label:'UTC - 10:00 – Honolulu'},{value:'America/New_York',label:'UTC - 05:00 – New York'},{value:'UTC',label:'UTC + 00:00 – UTC'},{value:'Asia/Kathmandu',label:'UTC + 05:45 – Kathmandu'}]);
});
test('current offset follows DST without changing the location saved for the book',()=>{
 const value='America/New_York';assert.deepEqual(timeZoneOptions([value],new Date('2026-07-15T12:00:00Z')),[{value,label:'UTC - 04:00 – New York'}]);
});
test('renamed city aliases appear once under the current city name',()=>{
 const result=timeZoneOptions(['Asia/Calcutta','Asia/Kolkata','Asia/Katmandu','Asia/Kathmandu'],new Date('2026-01-15T12:00:00Z'));
 assert.deepEqual(result,[{value:'Asia/Kolkata',label:'UTC + 05:30 – Kolkata'},{value:'Asia/Kathmandu',label:'UTC + 05:45 – Kathmandu'}]);
});
test('locations sharing a current offset remain separate because their DST rules differ',()=>{
 const result=timeZoneOptions(['America/Phoenix','America/Denver'],new Date('2026-01-15T12:00:00Z'));
 assert.equal(result.length,2);assert.deepEqual(new Set(result.map(z=>z.value)),new Set(['America/Phoenix','America/Denver']));
});
