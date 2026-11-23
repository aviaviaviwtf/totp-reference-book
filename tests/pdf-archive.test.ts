import test from 'node:test';import assert from 'node:assert/strict';import {unzipSync,strFromU8} from 'fflate';
import {volumeDownloadName} from '../lib/workbench/model.ts';
import {pdfArchive} from '../lib/workbench/pdf-archive.ts';
test('download package contains every original PDF in stable volume folders',async()=>{
 let active=0,max=0;
 const blob=await pdfArchive(['2026-first','2026-second'].flatMap(key=>['interior','cover'].map(kind=>({name:`${volumeDownloadName(key,'Instagram – @example')}/${kind}.pdf`,url:`${key}-${kind}`}))),async input=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,1));const response=new Response('%PDF-'+input);active--;return response;});
 const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));assert.deepEqual(Object.keys(files),['2026-H1 – Instagram – @example/interior.pdf','2026-H1 – Instagram – @example/cover.pdf','2026-H2 – Instagram – @example/interior.pdf','2026-H2 – Instagram – @example/cover.pdf']);assert.equal(strFromU8(files['2026-H1 – Instagram – @example/interior.pdf']),'%PDF-2026-first-interior');assert.equal(blob.type,'application/zip');assert.equal(max,1);
});

test('an unreadable or canceled PDF never produces a partial download',async()=>{
 await assert.rejects(pdfArchive([{name:'interior.pdf',url:'bad'}],async()=>new Response('',{status:404})));
 const controller=new AbortController();controller.abort();let called=false;
 await assert.rejects(pdfArchive([{name:'interior.pdf',url:'unused'}],async()=>{called=true;return new Response('%PDF');},controller.signal));assert.equal(called,false);
});


test('book titles cannot create nested archive paths',async()=>{
 const name=volumeDownloadName('2028-first','My / Account: \\ Example');
 const blob=await pdfArchive([{name:`${name}/interior.pdf`,url:'example'}],async()=>new Response('%PDF-original'));
 const entries=unzipSync(new Uint8Array(await blob.arrayBuffer()));
 assert.deepEqual(Object.keys(entries),['2028-H1 – My - Account- - Example/interior.pdf']);
});
