import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jsPDF} from 'jspdf';
import {compactPdfPages} from '../lib/pdf-memory.ts';
test('sealed page storage produces exactly the same PDF, including embedded resources',()=>{
 function make(compact:boolean){
  const doc=new jsPDF({compress:true,putOnlyUsedFonts:true,floatPrecision:3});
  doc.setFileId('12345678901234567890123456789012');doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  doc.addFileToVFS('test.ttf',readFileSync('public/fonts/LiberationSans-Regular.ttf').toString('base64'));
  doc.addFont('test.ttf','Liberation','normal');doc.setFont('Liberation');
  const store=compact?compactPdfPages(doc):null;
  for(let p=0;p<8;p++){
   if(p)doc.addPage();doc.setFontSize(6.2);doc.text(Array.from({length:120},(_,i)=>`${p} ${i}: 123 456`),36,118,{lineHeightFactor:5.1/6.2});
   store?.seal(p+1);
  }
  return store?store.output():doc.output('arraybuffer');
 }
 assert.deepEqual(new Uint8Array(make(true)),new Uint8Array(make(false)));
});
test('sealed pages reject edits and duplicate serialization',()=>{
 const doc=new jsPDF({compress:true}),store=compactPdfPages(doc);doc.text('original',10,10);store.seal(1);
 assert.throws(()=>store.seal(1),/sealed/);doc.text('late edit',10,20);
 assert.throws(()=>store.output(),/edited/);assert.throws(()=>store.output(),/serialized/);
});
test('compaction restores the active font and global stream filter',()=>{
 const doc=new jsPDF({compress:true}),store=compactPdfPages(doc);
 doc.setFont('helvetica','bold');doc.text('bold',10,10);store.seal(1);
 assert.equal(doc.getFont().fontStyle,'bold');
 const api=jsPDF.API as typeof jsPDF.API & {processDataByFilters:unknown};
 const filter=api.processDataByFilters;store.output();assert.equal(api.processDataByFilters,filter);
});
