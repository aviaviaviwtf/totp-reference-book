import type {EpubPreview} from '../../lib/epub';
import type {CoverDetails} from '../../lib/cover';
import {coverDate} from '../../lib/cover';
import {volumeDownloadName} from '../../lib/workbench/model';
import BookNavigation from './BookNavigation';
import './epub-review.css';

export type EpubBook={key:string;details:CoverDetails;url:string;cover:string;preview:EpubPreview};
type Props={books:EpubBook[];index:number;onChange:(index:number)=>void;zone:string;clock:string;t:(key:string)=>string;onDownload:()=>void};

export default function EpubReview({books,index,onChange,zone,clock,t,onDownload}:Props){
 const book=books[index],items=books.map(item=>item.details);
 if(!book)return <div className="document-placeholder" aria-hidden="true"/>;
 return <>
  <BookNavigation t={t} items={items} index={index} onChange={onChange} zone={zone} clock={clock} id="book-review-navigation" label={t('book.choose')}/>
  <article className="epub-review">
   <div>
    <h3>{t('epub.book')} | {coverDate(book.details.start)} – {coverDate(book.details.end)}</h3>
    <div className="controls"><a href={book.url} download={`${volumeDownloadName(book.key,book.details.name)}.epub`} onClick={onDownload}>{t('epub.download')}</a></div>
    <p>{t('epub.preview').replace('{{count}}',String(book.preview.rows.length))}</p>
    <h4>{coverDate(book.preview.date)}</h4><p>{book.preview.hour}</p>
    <table><thead><tr><th scope="col">{t('epub.time')}</th><th scope="col">{t('verify.code')}</th></tr></thead><tbody>{book.preview.rows.map(row=><tr key={row.time}><td>{row.time}</td><td className="epub-code">{row.code}</td></tr>)}</tbody></table>
   </div>
   <img className="epub-cover" src={book.cover} alt={book.details.name}/>
  </article>
  {books.length>1&&<BookNavigation t={t} items={items} index={index} onChange={onChange} zone={zone} clock={clock} compact focusTargetId="book-review-navigation" label={t('book.chooseAfter')}/>}
 </>;
}
