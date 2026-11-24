import generationWorkerUrl from './epub.worker.ts?worker&url';
import {loadWorker} from './worker-assets';
export function prepareEpubAssets(){return loadWorker(generationWorkerUrl);}
