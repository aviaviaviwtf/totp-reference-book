import {generateEpub} from '../lib/epub';
import type {PdfRequest} from '../lib/pdf-request';
self.onmessage=({data}:MessageEvent<PdfRequest>)=>{
 try{
  const result=generateEpub(data,progress=>self.postMessage({type:'progress',progress}));
  self.postMessage({type:'done',...result},[result.buffer]);
 }catch{self.postMessage({type:'error'});}
};
