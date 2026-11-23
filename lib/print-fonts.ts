// Only public font assets are cached here, in memory for this page/worker lifetime.
// Rejected loads are evicted so reconnecting can recover without a refresh.
export const printFontNames=['LiberationSans-Regular.ttf','LiberationSans-Bold.ttf','AlmanacSerif-Regular.ttf'] as const;
export type PrintFontName=typeof printFontNames[number];
export type PrintFonts=Record<PrintFontName,string>;
const pending=new Map<PrintFontName,Promise<string>>();
export function loadPrintFont(name:PrintFontName):Promise<string>{
 const cached=pending.get(name);if(cached)return cached;
 const request=(async()=>{
  const response=await fetch((import.meta.env?.BASE_URL??'/')+'fonts/'+name);
  if(!response.ok)throw Error('The print font could not be loaded.');
  const bytes=new Uint8Array(await response.arrayBuffer());let text='';
  for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
 })();
 pending.set(name,request);void request.catch(()=>{if(pending.get(name)===request)pending.delete(name);});
 return request;
}
export async function loadPrintFonts():Promise<PrintFonts>{
 return Object.fromEntries(await Promise.all(printFontNames.map(async name=>[name,await loadPrintFont(name)]))) as PrintFonts;
}
