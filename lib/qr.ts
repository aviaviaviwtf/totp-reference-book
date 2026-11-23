import jsQR from 'jsqr';
import {parseSetup} from './totp.ts';

export class QrReadError extends Error {
 readonly kind:'not-found'|'unsupported'|'image';
 readonly copyKey:string;
 constructor(kind:QrReadError['kind'],message:string,copyKey:string){super(message);this.name='QrReadError';this.kind=kind;this.copyKey=copyKey;}
}

export function setupFromQrPixels(pixels:Uint8ClampedArray,width:number,height:number):string {
 const decoded=jsQR(pixels,width,height,{inversionAttempts:'attemptBoth'});
 if(!decoded)throw new QrReadError('not-found','No QR code found - please use a clearer image and try again.','error.qrNotFound');
 if(decoded.data.startsWith('otpauth-migration:'))throw new QrReadError('unsupported','Use the account’s setup QR code, not an authenticator export QR code.','error.qrExport');
 if(!decoded.data.startsWith('otpauth://'))throw new QrReadError('unsupported','This QR code is not an authenticator setup code.','error.qrNotSetup');
 try{parseSetup(decoded.data);}catch{throw new QrReadError('unsupported','This setup is not supported. Use a time-based authenticator with 6 digits and 30-second codes.','error.qrUnsupported');}
 return decoded.data;
}

export async function readSetupQr(file:File):Promise<string> {
 if(file.size>10*1024*1024)throw new QrReadError('image','Choose an image smaller than 10 MB.','error.qrFileSize');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new QrReadError('image','Choose a PNG, JPEG or WebP photo','error.qrFileType');
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new QrReadError('image','This image couldn\'t be opened.','error.qrOpen');}
 try{
  if(bitmap.width*bitmap.height>32_000_000)throw new QrReadError('image','This image is too large','error.qrImageSize');
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,4096/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new QrReadError('image','Your browser has issues with the image upload. Paste the setup key instead.','error.qrBrowser');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  try{return setupFromQrPixels(pixels.data,pixels.width,pixels.height);}finally{canvas.width=0;canvas.height=0;}
 }finally{bitmap.close();}
}
