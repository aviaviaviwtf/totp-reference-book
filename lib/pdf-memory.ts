import {jsPDF} from 'jspdf';
import {strFromU8,strToU8,unzlibSync,zlibSync} from 'fflate';

/**
 * jsPDF retains every uncompressed page until output. Archive completed pages
 * and restore only the page being serialized. This is a one-shot document:
 * sealed pages cannot be edited and output must be called through this store.
 * Keep the jsPDF internal adapter here; the byte-equivalence test protects it
 * against library changes. jsPDF's pages declaration incorrectly says number[].
 */
export function compactPdfPages(doc:jsPDF){
 const pages=doc.internal.pages as unknown as string[][];
 const packed=new Map<number,Uint8Array>();
 let finished=false;
 return {
  seal(pageNumber:number){
   if(finished||packed.has(pageNumber))throw Error('PDF page already sealed');
   const page=pages[pageNumber];
   if(!Array.isArray(page))throw Error('Unsupported PDF page storage');
   packed.set(pageNumber,zlibSync(strToU8(page.join('\n'),true),{level:1}));
   page.length=0;
   // jsPDF also appends one glyph ID for every character, including repeats.
   // Font subsetting needs the distinct IDs, not millions of duplicate digits.
   const active=doc.getFont();
   for(const [name,styles] of Object.entries(doc.getFontList()))for(const style of styles){
    doc.setFont(name,style);
    const metadata=doc.getFont().metadata as {glyIdsUsed?:number[]};
    if(metadata?.glyIdsUsed)metadata.glyIdsUsed=[...new Set(metadata.glyIdsUsed)];
   }
   doc.setFont(active.fontName,active.fontStyle);
  },
  output(){
   if(finished)throw Error('PDF already serialized');finished=true;
   for(const n of packed.keys())if(pages[n].length)throw Error('Sealed PDF page was edited');
   let previous:string[]|undefined;
   const subscription=doc.internal.events.subscribe('putPage',({pageNumber,page}:{pageNumber:number;page:string[]})=>{
    if(previous)previous.length=0;
    const compressed=packed.get(pageNumber);
    if(compressed){page.push(strFromU8(unzlibSync(compressed),true));packed.delete(pageNumber);}
    previous=page;
   });
   // jsPDF's compressor concatenates one character at a time. Flatten each
   // finished stream immediately so output does not retain millions of rope nodes.
   const api=jsPDF.API as typeof jsPDF.API & {processDataByFilters:(data:string,filters?:string|string[])=>{data:string;reverseChain:string|string[]}};
   const filter=api.processDataByFilters;
   api.processDataByFilters=(...args:Parameters<typeof filter>)=>{
    const result=filter(...args);
    return result.reverseChain?.length?{...result,data:strFromU8(strToU8(result.data,true),true)}:result;
   };
   try{return doc.output('arraybuffer');}
   finally{api.processDataByFilters=filter;doc.internal.events.unsubscribe(subscription);packed.clear();for(const page of pages)if(Array.isArray(page))page.length=0;}
  },
 };
}
