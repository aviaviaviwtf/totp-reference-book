import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {unzipSync} from 'fflate';
import {pdfArchive} from '../lib/workbench/pdf-archive.ts';

test('generation workers recover from failed loading and remain available offline',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'totp-epub-assets-')),original=globalThis.fetch;
 let retained='';
 try{
  const bundled=await build({stdin:{contents:"export {loadWorker} from './src/worker-assets';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.DEV':'false'},write:false});
  const file=join(temp,'assets.mjs');await writeFile(file,bundled.outputFiles[0].contents);
  const {loadWorker}=await import(pathToFileURL(file).href);
  globalThis.fetch=async()=>{throw Error('Disconnected');};
  await assert.rejects(loadWorker('/assets/epub.worker.js'),/Disconnected/);
  let requests=0;globalThis.fetch=async()=>{requests++;return new Response('self.onmessage = () => {};');};
  const [first,second]=await Promise.all([loadWorker('/assets/epub.worker.js'),loadWorker('/assets/epub.worker.js')]);
  retained=first;assert.equal(first,second);assert.equal(requests,1);assert.match(first,/^blob:/);
  globalThis.fetch=async()=>{throw Error('Offline');};
  assert.equal(await loadWorker('/assets/epub.worker.js'),first);
 }finally{globalThis.fetch=original;if(retained)URL.revokeObjectURL(retained);await rm(temp,{recursive:true,force:true});}
});

test('all-ebook download preserves each EPUB and filename without PDF entries',async()=>{
 const first=new Uint8Array([80,75,3,4,1]),second=new Uint8Array([80,75,3,4,2]);
 const files=[{name:'2026-H1 – Example.epub',url:'blob:first'},{name:'2026-H2 – Example.epub',url:'blob:second'}];
 const result=await pdfArchive(files,async input=>new Response(input==='blob:first'?first:second));
 const entries=unzipSync(new Uint8Array(await result.arrayBuffer()));
 assert.deepEqual(Object.keys(entries),files.map(file=>file.name));
 assert.deepEqual(entries[files[0].name],first);assert.deepEqual(entries[files[1].name],second);
});
