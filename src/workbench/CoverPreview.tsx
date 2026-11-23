import strings from '../strings.json';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentLoadingTask,RenderTask} from 'pdfjs-dist';
import {preparePdfPreview} from '../print-assets';
import {generateCover,coverGeometry,type CoverDetails} from '../../lib/cover';
import './pdf-preview.css';

export default function CoverPreview({details,url,errorLabel,t=key=>(strings as Record<string,string>)[key]??`[${key}]`}:{details:CoverDetails;url?:string;errorLabel:string;t?:(key:string)=>string}){
 const front=useRef<HTMLCanvasElement>(null),spine=useRef<HTMLCanvasElement>(null);
 const {name,zone,start,end,pages}=details;
 const fallbackTitle=t('pdf.title');
 const key=JSON.stringify([name,zone,start,end,pages,url,fallbackTitle]);
 const [retry,setRetry]=useState(0),[rendered,setRendered]=useState<{key:string;status:'ready'|'error'}|null>(null);
 const status=rendered?.key===key?rendered.status:'loading';
 useEffect(()=>{
  let stopped=false,source:HTMLCanvasElement|undefined,task:PDFDocumentLoadingTask|undefined,render:RenderTask|undefined;
  const timer=setTimeout(()=>{void(async()=>{
   const data=url?null:await generateCover({name:name||fallbackTitle,zone,start,end,pages});
   if(stopped)return;
   const {getDocument}=await preparePdfPreview();if(stopped)return;
   task=getDocument(url?{url}:{data:new Uint8Array(data!.buffer)});
   const pdf=await task.promise;if(stopped)return;
   const page=await pdf.getPage(1);if(stopped)return;
   const view=page.getViewport({scale:1.5});
   source=document.createElement('canvas');source.width=Math.ceil(view.width);source.height=Math.ceil(view.height);
   render=page.render({canvas:source,viewport:view});await render.promise;if(stopped)return;
   const geometry=coverGeometry(pages);
   for(const [target,x,width] of [[spine.current,geometry.spineLeft,geometry.spine],[front.current,geometry.frontLeft,630]] as const){
    if(!target)continue;target.width=Math.round(width*1.5);target.height=1242;
    target.getContext('2d')!.drawImage(source,x*1.5,45*1.5,width*1.5,828*1.5,0,0,target.width,target.height);
   }
   page.cleanup();setRendered({key,status:'ready'});
  })().catch(()=>{if(!stopped)setRendered({key,status:'error'});}).finally(()=>{if(source)source.width=source.height=0;void task?.destroy();});},150);
  return()=>{stopped=true;clearTimeout(timer);render?.cancel();void task?.destroy();};
 },[name,zone,start,end,pages,url,key,retry]);
 return <div className="printed-cover stable-cover" aria-busy={status==='loading'}>
  <canvas ref={spine} className="printed-spine" role="img" aria-label={t('cover.spine').replaceAll('{{title}}',details.name)}/><canvas ref={front} className="printed-front" role="img" aria-label={t('cover.front').replaceAll('{{title}}',details.name)}/>
  {status==='loading'&&<span className="cover-loading" role="status">{t('cover.loading')}</span>}
  {status==='error'&&<div className="preview-overlay"><p className="field-error" role="alert">{errorLabel}</p><button type="button" onClick={()=>{setRendered(null);setRetry(value=>value+1);}}>{t('action.retry')}</button></div>}
 </div>;
}
