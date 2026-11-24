import {preparePrintAssets} from '../print-assets';
import {prepareEpubAssets} from '../epub-assets';
import {epubCover,type EpubResult} from '../../lib/epub';
import EpubReview,{type EpubBook} from './EpubReview';
import SiteHeader from './SiteHeader';
import PlatformShortcuts from './PlatformShortcuts';
import BookNavigation from './BookNavigation';
import type {PreviewView} from './PdfPreview';
import './book-review.css';
import './import-recovery.css';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {parseSetup,makeTotp,ZONES,MAX_EDITION_YEAR} from '../../lib/totp';
import {QrReadError,readSetupQr} from '../../lib/qr';
import {browserTimeZone,timeZoneOptions} from '../../lib/time-zone-options';
import {DEFAULT_EDITION} from '../../lib/edition';
import {generateCover,coverDate,type CoverDetails} from '../../lib/cover';
import strings from '../strings.json';
import {nextEdition,volumes,setupLabels,titleFor,volumeDownloadName} from '../../lib/workbench/model';
import {titleIssue} from '../../lib/workbench/title';
import {bookPdfRequest} from '../../lib/workbench/book-request';
import {templatePng} from '../../lib/workbench/template';
import CoverPreview from './CoverPreview';
import PdfPreview from './PdfPreview';
import CameraScanner from './CameraScanner';
import {pdfArchive} from '../../lib/workbench/pdf-archive';
import {copiedUntil} from '../../lib/workbench/copy-feedback';
const visiblePeriodCount=(current:number,total:number)=>Math.min(current+5,total);

export type Book={half:string;year:number;key:string;details:CoverDetails;interior:string;cover:string};

export default function Studio(){
 useEffect(()=>{
  let stopped=false,frame=0,idle=0,timer=0;
  const warm=()=>{if(!stopped){void preparePrintAssets().catch(()=>{});void prepareEpubAssets().catch(()=>{});}};
  // Let the loaded page paint before warming public generation assets for offline use.
  const afterLoad=()=>{frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   if(typeof window.requestIdleCallback==='function')idle=window.requestIdleCallback(warm,{timeout:2000});
   else timer=window.setTimeout(warm,0);
  });});};
  if(document.readyState==='complete')afterLoad();else window.addEventListener('load',afterLoad,{once:true});
  return()=>{stopped=true;window.removeEventListener('load',afterLoad);cancelAnimationFrame(frame);if(idle)window.cancelIdleCallback(idle);clearTimeout(timer);};
 },[]);
 const [unlocked,setUnlocked]=useState(0),[scrollTo,setScrollTo]=useState<number|null>(null);
 const sections=useRef<Array<HTMLElement|null>>([]);
 const [setup,setSetup]=useState(''),[verified,setVerified]=useState(false),[title,setTitle]=useState('');
 const [candidate,setCandidate]=useState(''),[showManual,setShowManual]=useState(true);
 const manualInput=useRef<HTMLInputElement>(null),manualFocus=useRef(false),copyFallback=useRef<HTMLInputElement>(null);
 const defaults=useRef(nextEdition());
 const [zone,setZone]=useState(browserTimeZone),[clock,setClock]=useState<'12'|'24'>('12');
 const [camera,setCamera]=useState(false),[cameraFrame,setCameraFrame]=useState(''),[dragging,setDragging]=useState(false);
 const [uploaded,setUploaded]=useState(false),[selectedPeriods,setSelectedPeriods]=useState<string[]>([`${defaults.current.year}-${defaults.current.period}`]),[periodCount,setPeriodCount]=useState(5),[reviewIndex,setReviewIndex]=useState(0),[coverIndex,setCoverIndex]=useState(0);
 const t=(key:string)=>((strings as Record<string,string>)[key]??`[${key}]`).replaceAll('PDF(s)',selectedPeriods.length===1?'PDF':'PDFs').replaceAll('EPUB(s)',selectedPeriods.length===1?'EPUB':'EPUBs');
 const [now,setNow]=useState(Date.now()),[copyExpires,setCopyExpires]=useState(0),[error,setError]=useState(''),[scanning,setScanning]=useState(false);
 const [qrError,setQrError]=useState('');
 const [books,setBooks]=useState<Book[]>([]),[progress,setProgress]=useState<number|null>(null),[part,setPart]=useState(1),[pngBusy,setPngBusy]=useState(false);

 const [format,setFormat]=useState<'pdf'|'epub'>('pdf'),[epubBooks,setEpubBooks]=useState<EpubBook[]>([]);
 const [previewViews,setPreviewViews]=useState<Record<string,PreviewView>>({});
 const [zipBusy,setZipBusy]=useState(false),[zipUrl,setZipUrl]=useState('');
 const archiveAbort=useRef<AbortController|null>(null);
 const advanceTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const worker=useRef<Worker|null>(null),generation=useRef(0),scan=useRef(0),urls=useRef<string[]>([]),rejectWork=useRef<((e:Error)=>void)|null>(null);
 useEffect(()=>{const tick=setInterval(()=>setNow(Date.now()),250);return()=>{clearInterval(tick);if(advanceTimer.current)clearTimeout(advanceTimer.current);generation.current++;scan.current++;archiveAbort.current?.abort();worker.current?.terminate();rejectWork.current?.(Error('Canceled'));urls.current.forEach(URL.revokeObjectURL);};},[]);
 useEffect(()=>{
  if(scrollTo===null)return;
  let canceled=false,frame=0;
  // Font loading changes section heights; scroll after the final text layout.
  void document.fonts.ready.then(()=>{
   if(canceled)return;
   frame=requestAnimationFrame(()=>{
    const el=sections.current[scrollTo];
    if(el)window.scrollTo({top:Math.max(0,el.getBoundingClientRect().top+window.scrollY-20),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    el?.focus({preventScroll:true});setScrollTo(null);
   });
  });
  return()=>{canceled=true;cancelAnimationFrame(frame);};
 },[scrollTo,unlocked]);
 const config=useMemo(()=>{try{return parseSetup(setup);}catch{return null;}},[setup]);
 const uploadedLabels=useMemo(()=>config?setupLabels(setup):null,[config,setup]);
 const codeAt=useMemo(()=>config?makeTotp(config):null,[config]),code=codeAt?codeAt(Math.floor(now/1000)):'';
 useEffect(()=>{if(!copyExpires)return;const timer=setTimeout(()=>setCopyExpires(0),Math.max(0,copyExpires-Date.now()));return()=>clearTimeout(timer);},[copyExpires]);
 useEffect(()=>{if(showManual&&manualFocus.current){manualFocus.current=false;manualInput.current?.focus();}},[showManual]);
 useEffect(()=>{if(error==='error.copy'){copyFallback.current?.focus();copyFallback.current?.select();}},[error]);
 const copied=now<copyExpires;
 const remaining=30-Math.floor(now/1000)%30;
 const zoneList=useMemo(()=>{let locations=ZONES;try{locations=Intl.supportedValuesOf('timeZone');}catch{/* Use the supported fallback locations. */}return timeZoneOptions([...locations,'UTC',zone]);},[zone]);
 const periods=useMemo(()=>Array.from({length:MAX_EDITION_YEAR-2026+1},(_,i)=>2026+i).flatMap(year=>volumes(year,'pair').map(p=>({...p,year,key:`${year}-${p.half}`}))),[]);
 const plans=useMemo(()=>periods.filter(p=>selectedPeriods.includes(p.key)),[periods,selectedPeriods]);

 useEffect(()=>{setReviewIndex(0);setCoverIndex(0);},[selectedPeriods]);
 const issue=titleIssue(title),busy=progress!==null||scanning;
 const coverPlan=plans[coverIndex]??periods[0];
 const coverDetails={name:title,zone,start:coverPlan.start,end:coverPlan.end,pages:coverPlan.pages};
 const epubCoverUrl=useMemo(()=>format==='epub'&&!issue?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(epubCover(title,coverPlan.start,coverPlan.end,zone)):'',[format,issue,title,coverPlan.start,coverPlan.end,zone]);
 function go(index:number){setUnlocked(current=>Math.max(current,index));setScrollTo(index);}
 function clearBooks(){generation.current++;archiveAbort.current?.abort();setZipBusy(false);setZipUrl('');worker.current?.terminate();rejectWork.current?.(Error('Canceled'));rejectWork.current=null;worker.current=null;urls.current.forEach(URL.revokeObjectURL);urls.current=[];setBooks([]);setEpubBooks([]);setPreviewViews({});setProgress(null);setError('');setUnlocked(current=>Math.min(current,2));}
 function acceptSetup(value:string){
  // Validate the candidate before replacing the active setup or its generated files.
  parseSetup(value);const labels=setupLabels(value);
  if(advanceTimer.current){clearTimeout(advanceTimer.current);advanceTimer.current=null;}
  setCameraFrame('');setCamera(false);setUploaded(false);scan.current++;setScanning(false);setQrError('');setError('');
  if(value.trim()!==setup.trim()){
   clearBooks();setVerified(false);setCopyExpires(0);setSetup(value);
   setUnlocked(0);
   setTitle(titleFor(labels.website,labels.account));
  }
 }
 function imported(value:string,frame=''){
  acceptSetup(value);setCandidate('');setShowManual(false);setUploaded(true);setCameraFrame(frame);setUnlocked(current=>Math.max(current,1));
  advanceTimer.current=setTimeout(()=>{advanceTimer.current=null;go(1);},900);
 }
 function editCandidate(value:string){
  if(advanceTimer.current){clearTimeout(advanceTimer.current);advanceTimer.current=null;}
  scan.current++;setScanning(false);setCamera(false);setError('');setQrError('');setCandidate(value);
 }
 function openManual(){
  if(advanceTimer.current){clearTimeout(advanceTimer.current);advanceTimer.current=null;}
  scan.current++;setScanning(false);setCamera(false);setError('');setQrError('');manualFocus.current=true;setShowManual(true);
 }
 function confirmCandidate(){
  if(!candidate.trim()){setError('error.empty');manualInput.current?.focus();return;}
  try{acceptSetup(candidate);setShowManual(true);go(1);}catch{setError('error.setup');manualInput.current?.focus();}
 }
 async function scanQr(file?:File){
  if(!file)return;
  if(advanceTimer.current){clearTimeout(advanceTimer.current);advanceTimer.current=null;}
  const version=++scan.current;setCamera(false);setScanning(true);setQrError('');setError('');
  try{const value=await readSetupQr(file);if(version===scan.current)imported(value);}
  catch(cause){if(version===scan.current){setQrError(cause instanceof QrReadError?cause.copyKey:'');setError('error.qr');}}
  finally{if(version===scan.current)setScanning(false);}
 }
 async function copyCode(){if(!codeAt)return;const started=Date.now(),version=scan.current;try{await navigator.clipboard.writeText(codeAt(Math.floor(started/1000)));if(version!==scan.current)return;setNow(Date.now());setCopyExpires(copiedUntil(started));setError('');}catch{if(version===scan.current)setError('error.copy');}}
 function objectUrl(blob:Blob){const url=URL.createObjectURL(blob);urls.current.push(url);return url;}
 async function generate(){
  if(format==='epub')return generateEbooks();
  return generatePdfs();
 }
 async function generatePdfs(){
  if(!config||!verified||issue||!plans.length)return;
  clearBooks();const version=++generation.current;setPart(1);setProgress(0);const result:Book[]=[];
  try{const assets=await preparePrintAssets();if(version!==generation.current)return;for(let i=0;i<plans.length;i++){
   const plan=plans[i];setPart(i+1);setProgress(0);
   const data=await new Promise<{buffer:ArrayBuffer;pages:number}>((resolve,reject)=>{
    rejectWork.current=reject;const w=new Worker(assets.workerUrl,{type:'module'});worker.current=w;
    w.onmessage=({data})=>{if(version!==generation.current)return;if(data.type==='progress')setProgress(Math.min(95,data.progress));if(data.type==='error'){w.terminate();reject(Error('Generation failed'));}if(data.type==='done'){w.terminate();worker.current=null;rejectWork.current=null;resolve(data);}};
    w.onerror=()=>{w.terminate();reject(Error('Generation failed'));};
    w.postMessage({...bookPdfRequest({edition:{...DEFAULT_EDITION,name:title,year:plan.year,zone,clock},config,sample:false,half:plan.half,date:plan.start}),fonts:assets.fonts});
   });
   if(version!==generation.current)return;
   if(data.pages!==plan.pages)throw Error('Page count mismatch');
   const details={name:title,zone,start:plan.start,end:plan.end,pages:data.pages};
   const interior=objectUrl(new Blob([data.buffer],{type:'application/pdf'}));
   const cover=await generateCover(details);if(version!==generation.current)return;
   result.push({half:plan.half,year:plan.year,key:plan.key,details,interior,cover:objectUrl(new Blob([cover.buffer],{type:'application/pdf'}))});
  }setBooks(result);setUnlocked(current=>Math.max(current,3));setScrollTo(3);
  }catch{if(version===generation.current){urls.current.forEach(URL.revokeObjectURL);urls.current=[];setBooks([]);setError('error.generate');}}
  finally{if(version===generation.current){setProgress(null);worker.current=null;rejectWork.current=null;}}
 }
 async function generateEbooks(){
  if(!config||!verified||issue||!plans.length)return;
  clearBooks();const version=++generation.current;setPart(1);setProgress(0);const result:EpubBook[]=[];
  try{
   const workerUrl=await prepareEpubAssets();if(version!==generation.current)return;
   for(let i=0;i<plans.length;i++){
    const plan=plans[i];setPart(i+1);setProgress(0);
    const data=await new Promise<EpubResult>((resolve,reject)=>{
     rejectWork.current=reject;const w=new Worker(workerUrl,{type:'module'});worker.current=w;
     w.onmessage=({data})=>{
      if(version!==generation.current)return;
      if(data.type==='progress')setProgress(Math.min(95,data.progress));
      if(data.type==='error'){w.terminate();reject(Error('Generation failed'));}
      if(data.type==='done'){w.terminate();worker.current=null;rejectWork.current=null;resolve(data);}
     };
     w.onerror=()=>{w.terminate();reject(Error('Generation failed'));};
     w.postMessage(bookPdfRequest({edition:{...DEFAULT_EDITION,name:title,year:plan.year,zone,clock},config,sample:false,half:plan.half,date:plan.start}));
    });
    if(version!==generation.current)return;
    if(data.days!==(plan.pages-4)/2)throw Error('Date count mismatch');
    result.push({key:plan.key,details:{name:title,zone,start:plan.start,end:plan.end,pages:plan.pages},url:objectUrl(new Blob([data.buffer],{type:'application/epub+zip'})),cover:objectUrl(new Blob([data.coverSvg],{type:'image/svg+xml'})),preview:data.preview});
   }
   setEpubBooks(result);setUnlocked(current=>Math.max(current,3));setScrollTo(3);
  }catch{
   if(version===generation.current){urls.current.forEach(URL.revokeObjectURL);urls.current=[];setEpubBooks([]);setError('error.epub');}
  }finally{if(version===generation.current){setProgress(null);worker.current=null;rejectWork.current=null;}}
 }
 async function png(book:Book){const version=generation.current;setPngBusy(true);try{const blob=await templatePng(book.details,false);if(version!==generation.current)return;const url=objectUrl(blob),a=document.createElement('a');a.href=url;a.download=`${volumeDownloadName(book.key,book.details.name)}-cover-template-300dpi.png`;a.click();}catch{if(version===generation.current)setError('error.template');}finally{setPngBusy(false);}}
 function savePackage(url:string){const link=document.createElement('a');link.href=url;link.download='totp-reference-books.zip';link.click();}
 async function downloadAll(){
  if(zipBusy||!(format==='epub'?epubBooks.length:books.length))return;
  if(zipUrl){savePackage(zipUrl);return;}
  const version=generation.current,controller=new AbortController();archiveAbort.current=controller;setZipBusy(true);setError('');
  try{const files=format==='epub'?epubBooks.map(book=>({name:`${volumeDownloadName(book.key,book.details.name)}.epub`,url:book.url})):books.flatMap(book=>(['interior','cover'] as const).map(kind=>({name:`${volumeDownloadName(book.key,book.details.name)}/${kind}.pdf`,url:book[kind]})));
   const blob=await pdfArchive(files,fetch,controller.signal);
   if(version!==generation.current)return;const url=objectUrl(blob);setZipUrl(url);
   savePackage(url);
  }catch{if(version===generation.current)setError('error.archive');}
  finally{if(version===generation.current)setZipBusy(false);}
 }
 function instructionsWithRefresh(text:string){const at=text.indexOf('refresh');return at<0?text:<>{text.slice(0,at)}<button className="text-button" type="button" onClick={()=>location.reload()}>{t('action.refresh')}</button>{text.slice(at+7)}</>;}
 function section(index:number,titleKey:string,body:ReactNode){
  const locked=index>unlocked;
  return <section id={`step-${index}`} className={`flow-section step-${index}${locked?' is-locked':''}`} ref={el=>{sections.current[index]=el;}} tabIndex={-1} aria-disabled={locked} aria-labelledby={`heading-${index}`}><header className="section-heading"><span aria-hidden="true">{index+1}</span><h2 id={`heading-${index}`}>{t(titleKey)}</h2></header><fieldset className="section-body" disabled={locked} inert={locked}>{body}</fieldset></section>;
 }
 return <main className="customer-site"><SiteHeader t={t}/>
 <div className="flow-content">

 {section(0,'import.title',<><div className="import-layout"><div className="reading-copy"><p>{t('import.instructions')}</p><PlatformShortcuts heading={t('import.platformShortcuts')}/><p>{t('import.local')}</p></div><div className="import-fields"><div className="qr-target">{camera?<CameraScanner onError={cause=>{setCamera(false);setQrError(cause?.copyKey??'');setError(cause?'error.qr':'error.camera');}} onRead={(value,frame)=>imported(value,frame)}/>:<label className={`qr-upload ${uploaded?'uploaded':''} ${cameraFrame?'scanned':''} ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();if(!scanning)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(!scanning)void scanQr(e.dataTransfer.files[0]);}}>{cameraFrame&&<img className="scan-frame" src={cameraFrame} alt=""/>}<span role={uploaded?'status':undefined}>{cameraFrame?t('import.scanned'):uploaded?t('import.uploaded'):t('import.qr')}</span>{uploaded?<div className="upload-details">{t('import.details')} {[uploadedLabels?.website,uploadedLabels?.account].filter(Boolean).join(' – ')}</div>:<img src={`${import.meta.env.BASE_URL}examples/sample-setup.png`} width="424" height="424" alt="" aria-hidden="true" draggable={false}/>}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={scanning} onChange={e=>{void scanQr(e.target.files?.[0]);e.target.value='';}}/></label>}</div>{camera?<button className="camera-action" type="button" onClick={()=>setCamera(false)}>{t('import.stopCamera')}</button>:<button className="camera-action" type="button" disabled={scanning} onClick={()=>{setError('');setQrError('');scan.current++;if(advanceTimer.current){clearTimeout(advanceTimer.current);advanceTimer.current=null;}setCamera(true);}}>{t('import.camera')}</button>}{uploaded&&!showManual&&<button className="text-button import-source" type="button"  onClick={openManual}>{t('import.manual')}</button>}{showManual&&<label>{t('import.key')}<input ref={manualInput} type="text" name="totp-setup" aria-describedby={error?"import-error":undefined} aria-invalid={error==='error.setup'} data-1p-ignore data-lpignore="true" autoComplete="off" autoCapitalize="off" spellCheck={false} value={candidate} disabled={camera} onChange={e=>editCandidate(e.target.value)}/></label>}{['error.qr','error.setup','error.empty','error.camera'].includes(error)&&<p id="import-error" className="field-error" role="alert">{t(error==='error.qr'&&qrError?qrError:error)}</p>}{scanning&&<p role="status">{t('import.reading')}</p>}{showManual&&<button className="primary-action" disabled={scanning||camera} onClick={confirmCandidate}>{t('action.continue')}</button>}</div></div></>)}
 {section(1,'verify.title',<><p className="reading-copy verbatim">{instructionsWithRefresh(t('verify.instructions'))}</p><div className="code-line"><div><span className="code-label">{t('verify.code')} {titleFor(uploadedLabels?.website??'',uploadedLabels?.account??'')}</span><button className={`code-button ${code&&remaining<=3?'expiring':''}`} disabled={!config} aria-label={`${t('verify.copy')}: ${code}`} onClick={()=>void copyCode()}>{code?`${code.slice(0,3)} ${code.slice(3)}`:'— — —'}</button></div><span className="countdown" aria-label={code?t('verify.seconds').replaceAll('{{number}}',String(remaining)):undefined}>{code?`${remaining}s`:'—'}</span><button className={copied?'is-copied':''} disabled={!config} onClick={()=>void copyCode()}>{t(copied?'verify.copied':'verify.copy')}</button></div>{error==='error.copy'&&<div className="manual-code-copy"><p className="field-error" role="alert">{t(error)}</p><label>{t('verify.current')}<input ref={copyFallback} readOnly value={code} aria-describedby="manual-copy-help" autoComplete="off" spellCheck={false} onFocus={e=>e.currentTarget.select()}/></label><p id="manual-copy-help">{t('error.copy')}</p></div>}<button className="primary-action" disabled={!config} onClick={()=>{setVerified(true);go(2);}}>{t('action.continue')}</button></>)}
 {section(2,'edition.title',<div className="edition-layout"><fieldset disabled={scanning} onChange={clearBooks}><label>{t('edition.cover')} *<input value={title} maxLength={240} onChange={e=>setTitle(e.target.value)} aria-describedby="title-count title-error"/></label><div id="title-count" className="character-count">{[...title].length} / 60</div><p id="title-error" className="field-error" role={issue&&title?'alert':undefined}>{issue==='length'?t('error.titleLength'):issue==='characters'?t('error.titleCharacters'):''}</p>
 <fieldset className="half-selection"><legend>{t('edition.period')} *</legend>{periods.filter((p,index)=>index<periodCount||selectedPeriods.includes(p.key)).map(p=><label className="check" key={p.key}><input type="checkbox" checked={selectedPeriods.includes(p.key)} onChange={e=>setSelectedPeriods(current=>e.target.checked?[...current,p.key]:current.filter(key=>key!==p.key))}/>{coverDate(p.start)} – {coverDate(p.end)}</label>)}{periodCount<periods.length&&<button type="button" className="text-button" onClick={()=>setPeriodCount(count=>visiblePeriodCount(count,periods.length))}>{t('edition.more')}</button>}</fieldset>
 <div className="row"><label>{t('edition.zone')} *<select value={zone} onChange={e=>setZone(e.target.value)}>{zoneList.map(z=><option key={z.value} value={z.value}>{z.label}</option>)}</select></label><fieldset className="clock-field"><legend>{t('edition.clock')} *</legend><div className="clock-toggle">{(['12','24'] as const).map(value=><label key={value}><input type="radio" name="clock-format" value={value} checked={clock===value} onChange={()=>setClock(value)}/><span>{value}h</span></label>)}</div></fieldset></div><fieldset className="clock-field export-format"><legend>{t('edition.exportFormat')} *</legend><div className="clock-toggle">{(['pdf','epub'] as const).map(value=><label key={value}><input type="radio" name="export-format" value={value} checked={format===value} onChange={()=>setFormat(value)}/><span>{value.toUpperCase()}</span></label>)}</div></fieldset><button className="primary-action" disabled={busy||!!issue||!verified||!plans.length} onClick={()=>void generate()}>{t(format==='epub'?'epub.generate':'edition.generate')}</button>
 {['error.generate','error.epub'].includes(error)&&<p className="field-error" role="alert">{t(error)}</p>}{progress!==null&&<div role="status"><p>{t('edition.progress')}: {part}/{plans.length} ({progress}%)</p><progress value={progress} max={100}/><button className="text-button" onClick={clearBooks}>{t(format==='epub'?'epub.cancel':'edition.cancel')}</button></div>}</fieldset><aside className="edition-cover">{plans.length>1&&<div className="carousel-controls"><button aria-label={t('pdf.previous')} disabled={coverIndex===0} onClick={()=>setCoverIndex(i=>i-1)}>‹</button><span>{coverDate(coverDetails.start)} – {coverDate(coverDetails.end)}</span><button aria-label={t('pdf.next')} disabled={coverIndex===plans.length-1} onClick={()=>setCoverIndex(i=>i+1)}>›</button></div>}{plans.length>0&&unlocked>=2&&(format==='epub'?(epubCoverUrl?<img className="epub-cover" src={epubCoverUrl} alt={title}/>:null):<CoverPreview t={t} details={coverDetails} errorLabel={t('pdf.error')}/>)}</aside></div>)}
 {section(3,format==='epub'?'epub.review':'review.title',format==='epub'?<><p className="reading-copy">{t('review.save')}</p><EpubReview books={epubBooks} index={reviewIndex} onChange={setReviewIndex} zone={zone} clock={clock} t={t} onDownload={()=>{}}/><div className="review-complete"><button disabled={zipBusy||!epubBooks.length} aria-busy={zipBusy} onClick={()=>void downloadAll()}>{t('epub.downloadAll')}{zipBusy?'…':''}</button></div>{error==='error.archive'&&<p className="field-error" role="alert">{t('error.epub')}</p>}</>:<><p className="reading-copy">{t('review.save')}</p><p>{t('review.templateQuestion')} <button className="text-button" disabled={pngBusy||!books.length} onClick={()=>books[reviewIndex]&&void png(books[reviewIndex])}>{t('review.template')}</button>.</p>{error==='error.template'&&<p className="field-error" role="alert">{t('error.generate')}</p>}{!books.length&&<div className="previews">{(['interior','cover'] as const).map(kind=><div key={kind}><h3>{t('review.'+kind)}</h3><div className="controls"><button disabled>{t('review.download')}</button><button disabled>{t('review.open')}</button></div><div className="document-placeholder" aria-hidden="true"/></div>)}</div>}{books.length>0&&<BookNavigation t={t} items={books.map(book=>book.details)} index={reviewIndex} onChange={setReviewIndex} zone={zone} clock={clock} id="book-review-navigation" label={t('book.choose')}/>}{books.slice(reviewIndex,reviewIndex+1).map(book=><article className="volume" key={book.key}><div className="previews">{(['interior','cover'] as const).map(kind=><div key={kind}><h3>{t('review.'+kind)} | {coverDate(book.details.start)} – {coverDate(book.details.end)}</h3><div className="controls"><a href={book[kind]} download={`${volumeDownloadName(book.key,book.details.name)}-${kind}.pdf`}>{t('review.download')}</a><a href={book[kind]} target="_blank" rel="noreferrer">{t('review.open')}</a></div>{kind==='cover'?<CoverPreview t={t} details={book.details} url={book.cover} errorLabel={t('pdf.error')}/>:<PdfPreview key={book[kind]} details={book.details} view={previewViews[book.interior]} onViewChange={view=>setPreviewViews(current=>({...current,[book.interior]:view}))} url={book[kind]} label={`${t('review.'+kind)} | ${coverDate(book.details.start)} – ${coverDate(book.details.end)}`} t={t}/>}</div>)}</div></article>)}{books.length>1&&<BookNavigation t={t} items={books.map(book=>book.details)} index={reviewIndex} onChange={setReviewIndex} zone={zone} clock={clock} compact focusTargetId="book-review-navigation" label={t('book.chooseAfter')}/>}<div className="review-complete"><button disabled={zipBusy||!books.length} aria-busy={zipBusy} onClick={()=>void downloadAll()}>{t('review.downloadAll')}{zipBusy?'…':''}</button></div>{error==='error.archive'&&<p className="field-error" role="alert">{t('error.generate')}</p>}</>)}
 <footer className="flow-footer"><a href="https://www.instagram.com/aviaviavi.wtf/" target="_blank" rel="noreferrer">{t('footer.credit')}</a></footer>
 </div></main>;
}
