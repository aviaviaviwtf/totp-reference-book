import {useEffect,useRef} from 'react';
import {QrReadError,setupFromQrPixels} from '../../lib/qr';
export default function CameraScanner({onRead,onError}:{onRead:(value:string,frame:string)=>void;onError:(error?:QrReadError)=>void}){
 const video=useRef<HTMLVideoElement>(null);
 const callbacks=useRef({onRead,onError});
 useEffect(()=>{callbacks.current={onRead,onError};},[onRead,onError]);
 useEffect(()=>{
  let closed=false,stream:MediaStream|undefined,frame=0,last=0;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  const close=()=>{closed=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());if(video.current)video.current.srcObject=null;canvas.width=canvas.height=0;};
  void (async()=>{
   if(!navigator.mediaDevices?.getUserMedia||!ctx)throw Error('Camera unavailable');
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(closed){stream.getTracks().forEach(track=>track.stop());return;}
   const element=video.current;if(!element){close();return;}
   element.srcObject=stream;await element.play();
   const scan=(time:number)=>{
    if(closed)return;
    if(time-last>150&&element.readyState>=2&&element.videoWidth){
     last=time;const scale=Math.min(1,960/element.videoWidth);canvas.width=Math.round(element.videoWidth*scale);canvas.height=Math.round(element.videoHeight*scale);
     ctx.drawImage(element,0,0,canvas.width,canvas.height);
     let value:string|undefined;
     try{const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);value=setupFromQrPixels(pixels.data,pixels.width,pixels.height);}catch(error){if(error instanceof QrReadError&&error.kind==='unsupported'){close();callbacks.current.onError(error);return;}}
     if(value){const still=canvas.toDataURL('image/jpeg',.8);close();callbacks.current.onRead(value,still);return;}
    }
    frame=requestAnimationFrame(scan);
   };
   frame=requestAnimationFrame(scan);
  })().catch(()=>{if(!closed){close();callbacks.current.onError();}});
  return close;
 },[]);
 return <div className="camera-scanner"><video ref={video} autoPlay muted playsInline/></div>;
}
