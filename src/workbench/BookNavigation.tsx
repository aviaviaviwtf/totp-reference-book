import strings from '../strings.json';
import {coverDate} from '../../lib/cover';
type Item={start:string;end:string};
export default function BookNavigation({items,index,onChange,zone,clock,label,compact=false,id,focusTargetId,t=key=>(strings as Record<string,string>)[key]??`[${key}]`}:{items:Item[];index:number;onChange:(index:number)=>void;zone?:string;clock?:string;label:string;compact?:boolean;id?:string;focusTargetId?:string;t?:(key:string)=>string}){
 const item=items[index];if(!item)return null;
 function change(next:number){
  onChange(next);
  if(focusTargetId)requestAnimationFrame(()=>{
   const target=document.getElementById(focusTargetId);if(!target)return;
   target.focus({preventScroll:true});
   target.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
 }
 return <nav id={id} tabIndex={id?-1:undefined} className="book-navigation" aria-label={label}><div className="book-navigation-buttons"><button type="button" disabled={index===0} onClick={()=>change(index-1)}>{t('book.previous')}</button>{!compact&&<strong>{t('book.position').replaceAll('{{number}}',String(index+1)).replaceAll('{{total}}',String(items.length))}</strong>}<button type="button" disabled={index===items.length-1} onClick={()=>change(index+1)}>{t('book.next')}</button></div>{!compact&&<><p>{coverDate(item.start)} – {coverDate(item.end)}</p>{zone&&<p className="book-context">{zone} | {clock}H</p>}</>}</nav>;
}
