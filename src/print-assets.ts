import generationWorkerUrl from './pdf.worker.ts?worker&url';
import previewWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {loadPrintFonts} from '../lib/print-fonts';
import {loadCoverTools} from '../lib/cover';
import {loadWorker} from './worker-assets';
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
