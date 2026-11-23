import {COVER_SUBTITLE,coverGeometry,coverDate,type CoverDetails} from '../cover';
import {loadPrintFont} from '../print-fonts';
// Full-wrap 300 dpi PNG design aid. Guides/sample are NOT the PDF submitted to Lulu.
export async function templatePng(details:CoverDetails,sample:boolean){
 const g=coverGeometry(details.pages),scale=300/72,canvas=document.createElement('canvas');
 canvas.width=Math.round(g.width*scale);canvas.height=Math.round(g.height*scale);
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 if(sample){const bytes=Uint8Array.from(atob(await loadPrintFont('AlmanacSerif-Regular.ttf')),char=>char.charCodeAt(0));const font=new FontFace('TemplateSerif',bytes);document.fonts.add(await font.load());}
 ctx.scale(scale,scale);ctx.fillStyle=sample?'#142338':'#fff';ctx.fillRect(0,0,g.width,g.height);ctx.fillStyle=sample?'#e9dec6':'#111';ctx.strokeStyle=ctx.fillStyle;
 const frame=(x:number)=>{ctx.lineWidth=.72;ctx.strokeRect(x,97.2,525.6,723.6);ctx.lineWidth=.312;ctx.strokeRect(x+5.52,102.72,514.56,712.56);};
 frame(97.2);frame(g.frontLeft+52.2);
 const text=(value:string,x:number,y:number,size:number,max=475)=>{ctx.font=`${size}px ${sample?'TemplateSerif':'serif'}`;while(ctx.measureText(value).width>max&&size>7)ctx.font=`${--size}px ${sample?'TemplateSerif':'serif'}`;ctx.textAlign='center';ctx.fillText(value,x,y);};
 if(sample){
  const center=g.frontLeft+315;text(details.name,center,262.8,37.2);text(COVER_SUBTITLE,center,340.8,19.2);text(`${coverDate(details.start)} - ${coverDate(details.end)}`,center,723.6,13.2);text(details.zone,center,748.8,13.2);
  ctx.save();ctx.translate(g.spineLeft+g.spine/2,288);ctx.rotate(Math.PI/2);text(details.name,0,0,18.24,260);ctx.restore();
  ctx.save();ctx.translate(g.spineLeft+g.spine/2,522);ctx.rotate(Math.PI/2);text(COVER_SUBTITLE,0,0,11.76,200);ctx.restore();text(details.start.slice(0,4),g.spineLeft+g.spine/2,745.2,18,60);
 }else{text('Back',360,460,24);text('Website - Account name',g.frontLeft+315,262.8,30);text(COVER_SUBTITLE,g.frontLeft+315,340.8,19.2);text(`${details.start} - ${details.end}`,g.frontLeft+315,723.6,13.2);text(details.zone,g.frontLeft+315,748.8,13.2);}
 ctx.strokeStyle=sample?'#e9dec6':'#555';ctx.lineWidth=.5;ctx.setLineDash([4,4]);
 for(const x of [45,675,675+g.spine,g.width-45]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,g.height);ctx.stroke();}
 for(const y of [45,g.height-45]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(g.width,y);ctx.stroke();}
 text(`300 dpi design aid (${g.width/72} × ${g.height/72} in, spine ${g.spine/72} in, ${details.pages} pages)`,g.width/2,22,11,1200);
 text('Dashed: wrap / board / spine boundaries. Inner frames sit inside the safe area. Do not print guides.',g.width/2,g.height-14,10,1200);
 try{return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG export failed')),'image/png'));}finally{canvas.width=0;canvas.height=0;}
}
