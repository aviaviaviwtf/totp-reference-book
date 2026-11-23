import {loadPrintFont} from './print-fonts';
export const loadCoverTools=()=>import('jspdf');
export type CoverDetails={name:string;zone:string;start:string;end:string;pages:number};
export const COVER_SUBTITLE='TOTP Reference Book';
// Lulu's downloaded Letter/378-page casewrap: 19.875 x 12.75 inches,
// 8.75-inch boards, .625-inch wrap, 1.125-inch spine. Hardcover table:
// https://help.api.lulu.com/en/support/solutions/articles/64000254616
export function coverGeometry(pages:number){
 if(!Number.isInteger(pages)||pages%2)throw Error('The cover needs an even interior page count.');
 const spine=pages>=361&&pages<=388?1.125:pages>=723&&pages<=750?1.9375:null;
 if(spine===null)throw Error('Covers are available for half-year and full-year editions, not daily proofs.');
 return {width:(18.75+spine)*72,height:12.75*72,spine:spine*72,spineLeft:9.375*72,frontLeft:(9.375+spine)*72};
}
export function coverDate(date:string){return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});}
export async function generateCover(details:CoverDetails){
 const {jsPDF}=await loadCoverTools();
 const g=coverGeometry(details.pages),doc=new jsPDF({unit:'pt',format:[g.width,g.height],orientation:'landscape',compress:true,putOnlyUsedFonts:true});
 const font=await loadPrintFont('AlmanacSerif-Regular.ttf');doc.addFileToVFS('AlmanacSerif-Regular.ttf',font);doc.addFont('AlmanacSerif-Regular.ttf','AlmanacSerif','normal');doc.setFont('AlmanacSerif');
 const name=details.name.trim()||'Personal account';
 // Fail explicitly instead of silently stripping characters or printing missing glyphs.
 const metadata=doc.getFont().metadata as unknown as {cmap?:{unicode?:{codeMap?:Record<number,number>}}};
 const glyphs=metadata.cmap?.unicode?.codeMap;
 if(!glyphs)throw Error('Could not validate the cover font.');
 for(const char of name+details.zone)if(!glyphs[char.codePointAt(0)!])throw Error('The cover font does not support every character in the name or time zone. Please use Latin characters for this cover.');
 doc.setProperties({title:`${name} — ${COVER_SUBTITLE}`,author:'Authenticator Almanac'});
 doc.setFillColor(20,35,56);doc.rect(0,0,g.width,g.height,'F');doc.setDrawColor(233,222,198);doc.setTextColor(233,222,198);
 function frame(x:number){doc.setLineWidth(.72);doc.rect(x,97.2,525.6,723.6);doc.setLineWidth(.312);doc.rect(x+5.52,102.72,514.56,712.56);}
 frame(97.2);frame(g.frontLeft+52.2);
 const center=g.frontLeft+315,spineCenter=g.spineLeft+g.spine/2;
 function fit(text:string,maxSize:number,width:number){let size=maxSize;doc.setFontSize(size);while(doc.getTextWidth(text)>width&&size>8){size-=.25;doc.setFontSize(size);}if(doc.getTextWidth(text)>width)throw Error('This title is too long for the cover. Please shorten it.');return size;}
 function centered(text:string,x:number,y:number,size:number,width:number){fit(text,size,width);doc.text(text,x,y,{align:'center'});}
 // Account title wraps rather than shrinking below the subtitle size.
 doc.setFontSize(37.2);let lines=doc.splitTextToSize(name,475) as string[];let size=37.2;
 while(lines.length>3&&size>22){size-=1;doc.setFontSize(size);lines=doc.splitTextToSize(name,475) as string[];}
 if(lines.length>3)throw Error('Please shorten the account name for the cover.');
 doc.text(lines,center,262.8-(lines.length-1)*size*.55,{align:'center',lineHeightFactor:1.1});
 const dividerY=262.8+(lines.length-1)*size*.55+34;
 doc.setLineWidth(.48);doc.line(center-46.8,dividerY,center+46.8,dividerY);
 centered(COVER_SUBTITLE,center,dividerY+44,19.2,475);
 centered(`${coverDate(details.start)} - ${coverDate(details.end)}`,center,723.6,13.2,475);
 centered(details.zone,center,748.8,13.2,475);
 // Rotate a coordinate system for top-to-bottom spine lettering.
 function spineText(text:string,y:number,size:number,width:number){const actualSize=fit(text,size,width);doc.text(text,spineCenter-actualSize*.3,y-doc.getTextWidth(text)/2,{angle:270});}
 spineText(name,288,18.24,260);spineText(COVER_SUBTITLE,522,11.76,200);
 doc.line(spineCenter-18.24,709.2,spineCenter+18.24,709.2);
 centered(details.start.slice(0,4),spineCenter,745.2,18, g.spine-18);
 centered(details.start.slice(5,7)==='01'&&details.end.slice(5,7)==='12'?'JAN–DEC':details.start.slice(5,7)==='01'?'JAN–JUN':'JUL–DEC',spineCenter,771.84,8.4,g.spine-18);
 return {buffer:doc.output('arraybuffer'),geometry:g};
}
