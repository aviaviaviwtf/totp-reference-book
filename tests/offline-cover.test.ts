import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

test('cover downloads work offline after asset loading recovers from a connection failure',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'totp-offline-cover-')),originalFetch=globalThis.fetch;
 try{
  const bundled=await build({stdin:{contents:"export {generateCover} from './lib/cover';export {loadPrintFonts} from './lib/print-fonts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false});
  const file=join(temp,'cover.mjs');await writeFile(file,bundled.outputFiles[0].contents);
  const {generateCover,loadPrintFonts}=await import(pathToFileURL(file).href);
  globalThis.fetch=async()=>{throw Error('Connection interrupted');};
  await assert.rejects(loadPrintFonts(),/Connection interrupted/);
  globalThis.fetch=async input=>{
   const path=String(input);assert.match(path,/^\/fonts\/[A-Za-z-]+\.ttf$/);
   return new Response(await readFile(new URL('../public'+path,import.meta.url)));
  };
  await loadPrintFonts();
  let offlineRequests=0;globalThis.fetch=async()=>{offlineRequests++;throw Error('Network disconnected');};
  for(const [name,start,end,pages] of [['Offline first volume','2026-01-01','2026-06-30',366],['Offline second volume','2026-07-01','2026-12-31',372]] as const){
   const cover=await generateCover({name,zone:'America/New_York',start,end,pages});
   const task=getDocument({data:new Uint8Array(cover.buffer)});
   try{const pdf=await task.promise;assert.equal(pdf.numPages,1);const text=(await (await pdf.getPage(1)).getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ');assert.ok(text.includes(name));assert.ok(text.includes('TOTP Reference Book'));}finally{await task.destroy();}
  }
  assert.equal(offlineRequests,0,'cached public assets require no network while generating covers');
 }finally{globalThis.fetch=originalFetch;await rm(temp,{recursive:true,force:true});}
});
