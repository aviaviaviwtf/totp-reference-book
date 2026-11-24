import {Zip,ZipDeflate,ZipPassThrough,strToU8} from 'fflate';
import {daySlots,makeTotp,type Slot} from './totp.ts';
import {requestDates,validatePdfRequest,type PdfRequest} from './pdf-request.ts';
import {transitionLabel} from './page-header.ts';

export type EpubPreview={date:string;hour:string;rows:{time:string;code:string}[]};
export type EpubResult={buffer:ArrayBuffer;days:number;totalCodes:number;preview:EpubPreview;coverSvg:string};
const XML='<?xml version="1.0" encoding="UTF-8"?>';
function escape(text:string){
 if(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(text))throw Error('Invalid book text.');
 return text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
}
function dateLabel(date:string){return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});}
function hourLabel(slot:Slot,clock:'12'|'24'){
 const hour=clock==='12'?slot.hour%12||12:slot.hour;
 return `${String(hour).padStart(2,'0')}:00${clock==='12'?(slot.hour<12?' AM':' PM'):''} – ${slot.offset}`;
}
function timeLabel(slot:Slot){
 return `${String(slot.minute).padStart(2,'0')}:${String(slot.second).padStart(2,'0')}`;
}
function xhtml(title:string,body:string,nested=false){return `${XML}<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en"><head><title>${escape(title)}</title><link rel="stylesheet" type="text/css" href="${nested?'../':''}book.css"/></head><body>${body}</body></html>`;}

const css=`
body{font-family:serif;line-height:1.2;margin:1em}
h1,h2{break-after:avoid}h1{font-size:1.6em}h2{font-size:1em;line-height:1.2;margin:.15em 0}
a{color:inherit}
.hour-pair{display:flex;flex-wrap:wrap;gap:0 2em;align-items:flex-start}
.hour{flex:1 1 13em;min-width:0;break-inside:avoid;page-break-inside:avoid}
.hour-chunk{break-inside:avoid;page-break-inside:avoid;margin:0 0 1.25em}
table{border-collapse:collapse;width:100%;font-family:sans-serif;font-variant-numeric:tabular-nums}
.chunk-heading{text-align:left;font-family:serif;white-space:normal;border:0;padding:0}
thead{display:table-header-group}
.context{display:block;font-size:.65em;font-weight:normal;overflow-wrap:anywhere}
th,td{text-align:left;padding:.1em .25em;border-bottom:1px solid #aaa;white-space:nowrap}
th[scope="col"]:first-child,td:first-child{width:3.5em}
tr{break-inside:avoid}.code{font-family:monospace;font-size:1em}
nav li{margin:.25em 0}.hours{columns:12em 2}
.cover{margin:0;padding:0}.cover img{width:100%;height:auto}
.title{text-align:center}.title h1{margin-top:2em}.title p{margin-block:1em}
`;

export function epubCover(name:string,start:string,end:string,zone:string){
 const words=name.split(/\s+/),lines:string[]=[''];
 for(const word of words){let last=lines.length-1;if(lines[last]&&lines[last].length+word.length>24){lines.push('');last++;}lines[last]+=(lines[last]?' ':'')+word;}
 const size=Math.min(34,680/Math.max(...lines.map(line=>line.length),1));
 return `${XML}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="#17273b"/><g fill="none" stroke="#eee5cf"><rect x="30" y="30" width="540" height="740"/><rect x="37" y="37" width="526" height="726"/></g><g fill="#eee5cf" text-anchor="middle" font-family="serif"><text font-size="${size}">${lines.map((line,i)=>`<tspan x="300" y="${210+i*42}">${escape(line)}</tspan>`).join('')}</text><text x="300" y="${250+lines.length*42}" font-size="23">TOTP Reference Book</text><text x="300" y="685" font-size="16">${escape(dateLabel(start))} – ${escape(dateLabel(end))}</text><text x="300" y="715" font-size="16">${escape(zone)}</text></g></svg>`;
}

export function generateEpub(request:PdfRequest,onProgress:(value:number)=>void=()=>{}):EpubResult{
 validatePdfRequest(request);
 const {edition,config}=request,dates=requestDates(request),title=edition.name,codeAt=makeTotp(config);
 const dateLabels=dates.map(dateLabel);
 escape(title);escape(edition.zone);
 const parts:Uint8Array[]=[];
 let failure:Error|null=null,totalCodes=0,preview:EpubPreview|undefined;
 const zip=new Zip((error,chunk)=>{if(error)failure=error;else parts.push(chunk);});
 function add(name:string,text:string,stored=false){
  const entry=stored?new ZipPassThrough(name):new ZipDeflate(name,{level:6});
  zip.add(entry);entry.push(strToU8(text),true);if(failure)throw failure;
 }
 try{
  add('mimetype','application/epub+zip',true);
  add('META-INF/container.xml',`${XML}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  add('EPUB/book.css',css);
  const coverSvg=epubCover(title,dates[0],dates.at(-1)!,edition.zone);
  add('EPUB/cover.svg',coverSvg);
  add('EPUB/cover.xhtml',xhtml(title,`<div class="cover" epub:type="cover"><img src="cover.svg" alt="${escape(title)} – TOTP Reference Book"/></div>`));
  add('EPUB/title.xhtml',xhtml(title,`<div class="title" epub:type="titlepage"><h1>${escape(title)}</h1><p>TOTP Reference Book</p><p>${dateLabels[0]} – ${dateLabels.at(-1)!}</p><p>${escape(edition.zone)}</p><p>${edition.clock}-hour</p><p>Reference book created on aviaviavi.wtf/totp</p></div>`));
  for(let d=0;d<dates.length;d++){
   const date=dates[d],slots=daySlots(date,edition.zone),groups:Slot[][]=[];
   for(const slot of slots){const current=groups.at(-1);if(!current||current[0].hour!==slot.hour||current[0].offset!==slot.offset)groups.push([slot]);else current.push(slot);}
   const hourLabels=groups.map(group=>hourLabel(group[0],edition.clock));
   const transition=transitionLabel(slots,edition.clock).replace('; columns marked first / second','; UTC offsets identify each occurrence');
   let body=`<h1>${dateLabels[d]}</h1><p>${escape(edition.zone)}</p>${transition?`<p>${escape(transition)}</p>`:''}<nav aria-label="Hours"><ol class="hours">${hourLabels.map((hour,i)=>`<li><a href="#hour-${i}">${escape(hour)}</a></li>`).join('')}</ol></nav>`;
   for(let pair=0;pair<groups.length;pair+=2){
    const paired=groups.slice(pair,pair+2);
    const length=Math.max(...paired.map(group=>group.length));
    for(let at=0;at<length;at+=5){
     body+='<div class="hour-pair">';
     for(let column=0;column<paired.length;column++){
      const group=paired[column],i=pair+column,hour=hourLabels[i],chunk=group.slice(at,at+5);
      if(!chunk.length)continue;
      body+=`<section class="hour"><table${at===0?` id="hour-${i}"`:""} class="hour-chunk"><thead><tr><th colspan="2" class="chunk-heading"><span class="context">${dateLabels[d]}<br/>${escape(edition.zone)}</span><h2>${escape(hour)}</h2></th></tr><tr><th scope="col">Time</th><th scope="col">Code</th></tr></thead><tbody>`;
      const previewRows:EpubPreview['rows']|undefined=d===0&&i===0&&at<10?[]:undefined;
      for(const slot of chunk){
       const raw=codeAt(slot.epoch),code=raw.slice(0,3)+' '+raw.slice(3),time=timeLabel(slot);
       body+=`<tr><td>${time}</td><td class="code">${code}</td></tr>`;
       if(previewRows)previewRows.push({time,code});totalCodes++;
      }
      body+='</tbody></table></section>';
      if(previewRows){if(preview)preview.rows.push(...previewRows);else preview={date,hour,rows:previewRows};}
     }
     body+='</div>';
    }
   }
   body+='<p><a href="../nav.xhtml">Contents</a></p>';
   add(`EPUB/days/${date}.xhtml`,xhtml(`${dateLabels[d]} – ${title}`,body,true));
   onProgress(Math.round((d+1)/dates.length*95));
  }
  add('EPUB/nav.xhtml',xhtml('Contents',`<nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="title.xhtml">${escape(title)}</a></li>${dates.map((date,i)=>`<li><a href="days/${date}.xhtml">${dateLabels[i]}</a></li>`).join('')}</ol></nav>`));
  const identifier=crypto.randomUUID(),modified=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
  add('EPUB/package.opf',`${XML}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${identifier}</dc:identifier><dc:title>${escape(title)} – TOTP Reference Book</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="book.css" media-type="text/css"/><item id="cover-image" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>${dates.map((date,i)=>`<item id="day-${i}" href="days/${date}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine><itemref idref="cover"/><itemref idref="title"/><itemref idref="nav"/>${dates.map((_,i)=>`<itemref idref="day-${i}"/>`).join('')}</spine></package>`);
  zip.end();if(failure)throw failure;
  const bytes=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
  onProgress(100);
  return {buffer:bytes.buffer,totalCodes,days:dates.length,preview:preview!,coverSvg};
 }catch(error){zip.terminate();throw error;}
}
