import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {bookPdfRequest} from '../lib/workbench/book-request.ts';
import {DEFAULT_EDITION} from '../lib/edition.ts';
import {DEMO_SECRET,parseSetup} from '../lib/totp.ts';
import {previewPages} from '../lib/workbench/preview-selection.ts';

test('preview and customer downloads contain the entire selected half-year while the reader selects ten pages',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'totp-download-test-'));
 const originalFetch=globalThis.fetch,originalSelf=globalThis.self;
 try{
  const bundled=await build({entryPoints:[new URL('../src/pdf.worker.ts',import.meta.url).pathname],bundle:true,format:'esm',platform:'browser',write:false});
  const workerPath=join(temp,'worker.mjs');await writeFile(workerPath,bundled.outputFiles[0].contents);
  globalThis.fetch=async input=>{
   const path=String(input);assert.match(path,/^\/fonts\/[A-Za-z-]+\.ttf$/);
   return new Response(await readFile(new URL('../public'+path,import.meta.url)));
  };
  const messages:Array<{type:string;buffer:ArrayBuffer;pages:number}>=[];
  const receive=(message:{type:string;buffer:ArrayBuffer;pages:number})=>{messages.push(message);};
  globalThis.self={postMessage:receive} as unknown as typeof self;
  for(const [sample,half,start,end,count] of [[true,'first','2026-01-01','2026-06-30',366],[false,'second','2026-07-01','2026-12-31',372]] as const){
   messages.length=0;
   globalThis.self={postMessage:receive} as unknown as typeof self;
   const request=bookPdfRequest({edition:{...DEFAULT_EDITION,name:'Public example',year:2026,zone:'America/New_York'},config:parseSetup(DEMO_SECRET),sample,half,date:start});
   // The second download starts after disconnecting, with the public print fonts
   // already loaded in this page session (no key or PDF is persisted).
   const data=sample?request:{...request,fonts:Object.fromEntries(await Promise.all(['LiberationSans-Regular.ttf','LiberationSans-Bold.ttf'].map(async name=>[name,(await readFile(new URL('../public/fonts/'+name,import.meta.url))).toString('base64')])))};
   if(!sample)globalThis.fetch=async()=>{throw new Error('Network disconnected');};
   await import(pathToFileURL(workerPath).href+'?volume='+half);
   const generate=self.onmessage!.bind(self);
   if(!sample){await generate({data:request} as MessageEvent);assert.equal(messages.find(message=>message.type==='error')?.type,'error','a fresh offline worker cannot fetch missing fonts');messages.length=0;}
   await generate({data} as MessageEvent);
   assert.equal(messages.find(message=>message.type==='error'),undefined);
   const done=messages.find(message=>message.type==='done');assert.ok(done);assert.equal(done.pages,count);
   const task=getDocument({data:new Uint8Array(done.buffer)});
   try{
    const pdf=await task.promise;assert.equal(pdf.numPages,count);
    for(const [number,date] of [[4,sample?'January 01, 2026':'July 01, 2026'],[count-1,sample?'June 30, 2026':'December 31, 2026']] as const){
     const page=await pdf.getPage(number),text=(await page.getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ');
     assert.ok(text.includes(date),`full download includes ${date}`);
    }
    const selected=previewPages({start,end,zone:'America/New_York'},pdf.numPages);
    assert.equal(selected.length,10);assert.equal(pdf.numPages,count,'preview selection leaves the full download intact');
   }finally{await task.destroy();}
  }
 }finally{globalThis.fetch=originalFetch;globalThis.self=originalSelf;await rm(temp,{recursive:true,force:true});}
});
