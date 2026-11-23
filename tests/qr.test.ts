import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {QrReadError,setupFromQrPixels,readSetupQr} from '../lib/qr.ts';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/qr.json',import.meta.url),'utf8')) as {name:string;value:string;matrix:number[][]}[];
function pixels(matrix:number[][],inverted=false){
 const scale=5,pad=20,width=matrix.length*scale+pad*2,data=new Uint8ClampedArray(width*width*4);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const black=matrix[Math.floor((y-pad)/scale)]?.[Math.floor((x-pad)/scale)]===1;
  const value=(inverted?!black:black)?0:255,index=(y*width+x)*4;
  data[index]=data[index+1]=data[index+2]=value;data[index+3]=255;
 }
 return {data,width};
}
test('reads a real authenticator QR, including inverted screenshots',()=>{
 const f=fixtures.find(f=>f.name==='totp')!;
 for(const inverted of [false,true]){const {data,width}=pixels(f.matrix,inverted);assert.equal(setupFromQrPixels(data,width,width),f.value);}
});
test('rejects unrelated, HOTP, and migration QR payloads',()=>{
 for(const f of fixtures.filter(f=>f.name!=='totp')){const {data,width}=pixels(f.matrix);assert.throws(()=>setupFromQrPixels(data,width,width),f.name==='migration'?/export/:f.name==='hotp'?/time-based/:/not an authenticator/);}
});
test('reports missing QR, unsupported files and oversized images',async()=>{
 const blank=new Uint8ClampedArray(100*100*4).fill(255);assert.throws(()=>setupFromQrPixels(blank,100,100),/No QR/);
 await assert.rejects(readSetupQr(new File(['abc'],'test.txt',{type:'text/plain'})),/PNG, JPEG/);
 await assert.rejects(readSetupQr(new File([new Uint8Array(10*1024*1024+1)],'large.png',{type:'image/png'})),/10 MB/);
});
test('QR failures distinguish an unreadable frame from an unsupported setup',()=>{
 const blank=new Uint8ClampedArray(100*100*4).fill(255);
 assert.throws(()=>setupFromQrPixels(blank,100,100),error=>error instanceof Error&&'kind' in error&&error.kind==='not-found');
 for(const fixture of fixtures.filter(item=>item.name!=='totp')){
  const {data,width}=pixels(fixture.matrix);
  assert.throws(()=>setupFromQrPixels(data,width,width),error=>error instanceof Error&&'kind' in error&&error.kind==='unsupported');
 }
});
test('QR failures identify editable copy without exposing decoded setup data',async()=>{
 const matches=(key:string)=>(error:unknown)=>error instanceof QrReadError&&error.copyKey===key&&!error.message.includes('secret=');
 const blank=new Uint8ClampedArray(100*100*4).fill(255);
 assert.throws(()=>setupFromQrPixels(blank,100,100),matches('error.qrNotFound'));
 for(const fixture of fixtures.filter(item=>item.name!=='totp')){
  const {data,width}=pixels(fixture.matrix);
  assert.throws(()=>setupFromQrPixels(data,width,width),matches(fixture.name==='migration'?'error.qrExport':fixture.name==='hotp'?'error.qrUnsupported':'error.qrNotSetup'));
 }
 await assert.rejects(readSetupQr(new File(['abc'],'test.txt',{type:'text/plain'})),matches('error.qrFileType'));
 await assert.rejects(readSetupQr(new File([new Uint8Array(10*1024*1024+1)],'large.png',{type:'image/png'})),matches('error.qrFileSize'));
});
