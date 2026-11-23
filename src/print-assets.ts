import generationWorkerUrl from './pdf.worker.ts?worker&url';
import previewWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {loadPrintFonts} from '../lib/print-fonts';
import {loadCoverTools} from '../lib/cover';

// Retain executable public assets in memory, so a loaded tab can work offline
// without a service worker or persistent storage of customer information.
const workers=new Map<string,Promise<string>>();
function loadWorker(url:string){
 // Vite serves unbundled modules in development; their relative imports need
 // the original HTTP base. Deployed workers are self-contained bundles.
 if(import.meta.env.DEV)return Promise.resolve(url);
 const cached=workers.get(url);if(cached)return cached;
 const request=(async()=>{
  const response=await fetch(url);if(!response.ok)throw Error('The PDF tools could not be loaded.');
  return URL.createObjectURL(new Blob([await response.text()],{type:'text/javascript'}));
 })();
 workers.set(url,request);void request.catch(()=>{if(workers.get(url)===request)workers.delete(url);});
 return request;
}
export async function preparePdfPreview(){
 const [pdf,workerSrc]=await Promise.all([import('pdfjs-dist'),loadWorker(previewWorkerUrl)]);
 pdf.GlobalWorkerOptions.workerSrc=workerSrc;
 return pdf;
}
export async function preparePrintAssets(){
 // Preview failure belongs to the reader's retry UI, never the download path.
 void preparePdfPreview().catch(()=>{});
 const [workerUrl,fonts]=await Promise.all([loadWorker(generationWorkerUrl),loadPrintFonts(),loadCoverTools()]);
 return {workerUrl,fonts};
}
