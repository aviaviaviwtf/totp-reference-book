import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {generateEpub} from '../lib/epub.ts';
import type {PdfRequest} from '../lib/pdf-request.ts';
import {DEFAULT_EDITION} from '../lib/edition.ts';

const request=(date:string,zone='America/New_York',clock:'12'|'24'='24'):PdfRequest=>({edition:{...DEFAULT_EDITION,name:'Example & <reader>',year:2026,zone,clock},config:{secret:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',algorithm:'SHA1',digits:6,period:30},full:false,sample:true,date});
function entries(buffer:ArrayBuffer){return Object.fromEntries(Object.entries(unzipSync(new Uint8Array(buffer))).map(([name,value])=>[name,strFromU8(value)]));}
function code(epoch:number){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(epoch/30)));const h=createHmac('sha1','12345678901234567890').update(counter).digest(),offset=h[19]&15;return ((h.readUInt32BE(offset)&0x7fffffff)%1e6).toString().padStart(6,'0');}

test('EPUB is a self-contained package with escaped metadata and no setup material',()=>{
 const result=generateEpub(request('2026-07-01')),files=entries(result.buffer),header=new DataView(result.buffer);
 assert.equal(header.getUint32(0,true),0x04034b50);assert.equal(header.getUint16(8,true),0);assert.equal(header.getUint16(28,true),0);
 assert.equal(new TextDecoder().decode(new Uint8Array(result.buffer,30,header.getUint16(26,true))),'mimetype');
 assert.equal(files.mimetype,'application/epub+zip');assert.match(files['META-INF/container.xml'],/EPUB\/package.opf/);
 assert.match(files['EPUB/package.opf'],/Example &amp; &lt;reader&gt;/);assert.match(files['EPUB/package.opf'],/properties="nav"/);
 assert.match(files['EPUB/nav.xhtml'],/days\/2026-07-01.xhtml/);
 for(const content of Object.values(files)){
  assert.ok(!content.includes(request('2026-07-01').config.secret));assert.doesNotMatch(content,/otpauth:|<script|<iframe|(?:href|src)="https?:|url\(\s*https?:/i);
 }
 assert.equal(result.days,1);assert.equal(result.totalCodes,2880);
});

for(const [date,zone,count,start] of [
 ['2026-03-08','America/New_York',2760,Date.UTC(2026,2,8,5)/1000],
 ['2026-11-01','America/New_York',3000,Date.UTC(2026,10,1,4)/1000],
 ['2026-04-05','Australia/Lord_Howe',2940,Date.UTC(2026,3,4,13)/1000],
 ['2026-07-01','Asia/Kolkata',2880,Date.UTC(2026,5,30,18,30)/1000],
] as const)test(`EPUB preserves every chronological code for ${zone} ${date}`,()=>{
 const result=generateEpub(request(date,zone)),chapter=entries(result.buffer)[`EPUB/days/${date}.xhtml`];
 const rows=[...chapter.matchAll(/<tr><td>([^<]+)<\/td><td class="code">(\d{3}) (\d{3})<\/td><\/tr>/g)];
 assert.equal(rows.length,count);assert.equal(result.totalCodes,count);
 rows.forEach((row,i)=>assert.equal(row[2]+row[3],code(start+i*30)));
 if(date==='2026-11-01'){assert.match(chapter,/UTC-04:00/);assert.match(chapter,/UTC-05:00/);assert.equal((chapter.match(/<h2[^>]*>01:00 /g)||[]).length,2);}
 if(date==='2026-03-08'){assert.doesNotMatch(chapter,/<td>02:/);assert.match(chapter,/skipped/);}
});

test('clock selection changes labels, not codes, and invalid XML text is rejected',()=>{
 const a=generateEpub(request('2026-07-01','UTC','12')),b=generateEpub(request('2026-07-01','UTC','24'));
 const aText=entries(a.buffer)['EPUB/days/2026-07-01.xhtml'],bText=entries(b.buffer)['EPUB/days/2026-07-01.xhtml'];
 assert.match(aText,/12:00:00 AM/);assert.match(aText,/12:00:00 PM/);assert.match(bText,/00:00:00/);
 assert.deepEqual([...aText.matchAll(/class="code">([^<]+)/g)].map(m=>m[1]),[...bText.matchAll(/class="code">([^<]+)/g)].map(m=>m[1]));
 const bad=request('2026-07-01');bad.edition.name='Title\u0001';assert.throws(()=>generateEpub(bad));
});

test('a complete half-year contains all dates and reports finished progress',()=>{
 const input=request('2026-01-01');input.full=true;input.half='first';const progress:number[]=[];
 const result=generateEpub(input,value=>progress.push(value)),files=entries(result.buffer);
 assert.equal(result.days,181);assert.equal(result.totalCodes,181*2880-120);
 assert.equal(Object.keys(files).filter(name=>name.startsWith('EPUB/days/')).length,181);
 assert.ok(files['EPUB/days/2026-01-01.xhtml']);assert.ok(files['EPUB/days/2026-06-30.xhtml']);assert.ok(!files['EPUB/days/2026-07-01.xhtml']);
 assert.equal(progress.at(-1),100);assert.ok(progress.every((n,i)=>i===0||n>=progress[i-1]));
});
