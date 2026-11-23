import {useEffect,useMemo,useRef,useState} from 'react';
import type {PDFDocumentProxy,PDFDocumentLoadingTask,RenderTask} from 'pdfjs-dist';
import {preparePdfPreview} from '../print-assets';
import {previewPages,type PreviewDetails} from '../../lib/workbench/preview-selection';
import './pdf-preview.css';

export type PreviewView={page:number;zoom:number};
type Props={url:string;label:string;details?:PreviewDetails;view?:PreviewView;onViewChange?:(view:PreviewView)=>void;t:(key:string)=>string};

export default function PdfPreview({url,label,details,view,onViewChange,t}:Props){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[localView,setLocalView]=useState<PreviewView>({page:1,zoom:1});
 const [width,setWidth]=useState(500),[error,setError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[renderedPage,setRenderedPage]=useState<number|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
 const selected=view??localView;
 const titleLabel=t('pdf.title'),detailsLabel=t('pdf.details'),pageLabel=t('pdf.page'),clockChangeLabel=t('pdf.clockChange');
 const choices=useMemo(()=>pdf?previewPages(details,pdf.numPages,{title:titleLabel,details:detailsLabel,page:pageLabel,clockChange:clockChangeLabel}):[],[pdf,details?.start,details?.end,details?.zone,titleLabel,detailsLabel,pageLabel,clockChangeLabel]);
 const page=choices.some(choice=>choice.number===selected.page)?selected.page:choices[0]?.number??1;
 const zoom=[1,2,3].includes(selected.zoom)?selected.zoom:1;
 const index=choices.findIndex(choice=>choice.number===page);
 function choose(next:PreviewView){setLocalView(next);onViewChange?.(next);}
 useEffect(()=>{const el=container.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(1,Math.floor(entry.contentRect.width))));observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  let stopped=false;setPdf(null);setError(false);setLoading(true);setRenderedPage(null);setLocalView({page:1,zoom:1});
  let task:PDFDocumentLoadingTask|undefined;
  void preparePdfPreview().then(async({getDocument})=>{if(stopped)return;task=getDocument({url});const doc=await task.promise;if(!stopped)setPdf(doc);}).catch(()=>{if(!stopped){setError(true);setLoading(false);}});
  return()=>{stopped=true;void task?.destroy();};
 },[url,retry]);
 useEffect(()=>{
  if(!pdf||!canvas.current)return;
  let stopped=false,render:RenderTask|undefined;
  const target=canvas.current,source=document.createElement('canvas');setLoading(true);setError(false);
  void pdf.getPage(page).then(async current=>{
   if(stopped)return;
   try{
    const base=current.getViewport({scale:1});
    // Four million pixels bounds each canvas to 16 MB; only the visible page is rasterized.
    const scale=Math.min(Math.max(2,Math.min(3,window.devicePixelRatio||1))*width*zoom/base.width,Math.sqrt(4_000_000/(base.width*base.height)));
    const viewport=current.getViewport({scale});source.width=Math.floor(viewport.width);source.height=Math.floor(viewport.height);
    render=current.render({canvas:source,viewport});await render.promise;
    if(stopped)return;
    // Resize the visible bitmap only after the replacement is ready. CSS owns the reserved height.
    target.width=source.width;target.height=source.height;target.getContext('2d')!.drawImage(source,0,0);setRenderedPage(page);setLoading(false);
   }finally{current.cleanup();}
  }).catch(cause=>{if(!stopped&&cause?.name!=='RenderingCancelledException'){setError(true);setLoading(false);}}).finally(()=>{source.width=source.height=0;});
  return()=>{stopped=true;render?.cancel();};
 },[pdf,page,width,zoom]);
 return <div className="pdf-reader stable-pdf-reader">
  <p className="preview-explanation">{t('pdf.explanation').replaceAll('{{count}}',String(choices.length||10))}</p>
  <div className="pdf-paging">
   <button type="button" aria-label={`${label}: ${t('pdf.previous')}`} disabled={!pdf||index<=0} onClick={()=>choose({page:choices[index-1].number,zoom})}>‹</button>
   <label><span className="sr-only">{label}: {t('pdf.page')}</span><select value={page} disabled={!pdf} onChange={event=>choose({page:Number(event.target.value),zoom})}>{choices.length?choices.map(choice=><option key={choice.number} value={choice.number}>{choice.label} – {t('pdf.page')} {choice.number}</option>):<option value={1}>{t('pdf.loading')}</option>}</select></label>
   <button type="button" aria-label={`${label}: ${t('pdf.next')}`} disabled={!pdf||index>=choices.length-1} onClick={()=>choose({page:choices[index+1].number,zoom})}>›</button>
  </div>
  <div className="preview-zoom"><label>{t('pdf.magnification')} <select value={zoom} onChange={event=>choose({page,zoom:Number(event.target.value)})}><option value={1}>{t('pdf.fit')}</option><option value={2}>200%</option><option value={3}>300%</option></select></label><span role="status" aria-live="polite">{loading?t('pdf.loading'):error?t('pdf.unavailable'):`${t('pdf.page')} ${renderedPage}`}</span></div>
  <div className="pdf-viewport" ref={container} aria-busy={loading} tabIndex={zoom>1?0:undefined} aria-label={zoom>1?t('pdf.enlarged'):undefined}>
   <button type="button" className="pdf-surface" style={{width:`${zoom*100}%`}} disabled={!pdf||loading||error} aria-label={`${t(zoom===1?'pdf.magnify':'pdf.fit')} ${label}, ${t('pdf.page')} ${renderedPage??page}`} aria-pressed={zoom>1} onClick={()=>choose({page,zoom:zoom===1?2:1})}><canvas ref={canvas} aria-label={`${label}, ${t('pdf.page')} ${renderedPage??page}`} role="img"/></button>
   {error&&<div className="preview-overlay"><p className="field-error" role="alert">{t('pdf.error')}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{t('action.retry')}</button></div>}
  </div>
 </div>;
}
