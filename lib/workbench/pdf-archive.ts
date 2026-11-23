import {Zip,ZipPassThrough} from 'fflate';

// PDFs are already compressed. Stream them into stored ZIP entries, one at a
// time, to avoid keeping every PDF buffer plus a compressed copy in iOS memory.
export async function pdfArchive(files:readonly {name:string;url:string}[],fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<Blob>{
 const parts:BlobPart[]=[];
 let failure:Error|undefined;
 const zip=new Zip((error,chunk)=>{if(error)failure=error;else parts.push(new Uint8Array(chunk));});
 try{
  for(const file of files){
   signal?.throwIfAborted();
   const response=await fetcher(file.url,{signal});
   if(!response.ok||!response.body)throw Error('PDF unavailable');
   const entry=new ZipPassThrough(file.name);zip.add(entry);
   const reader=response.body.getReader();
   try{while(true){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;entry.push(value);if(failure)throw failure;}}
   finally{await reader.cancel();reader.releaseLock();}
   entry.push(new Uint8Array(),true);
  }
  zip.end();if(failure)throw failure;
  return new Blob(parts,{type:'application/zip'});
 }catch(error){zip.terminate();throw error;}
}
