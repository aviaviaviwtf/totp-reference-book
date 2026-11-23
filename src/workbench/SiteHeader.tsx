import sampleCover from './sample-cover.png';
import './site-header.css';

export default function SiteHeader({t}:{t:(key:string)=>string}){
 return <header className="site-title site-header sample-site-header">
  <div className="site-heading-copy">
   <h1>{t('app.title')}</h1>
   <div className="site-links">
    <a className="github-link" href="https://github.com/aviaviaviwtf/totp-reference-book" target="_blank" rel="noreferrer" aria-label={t('app.github')} title={t('app.github')}><img src={`${import.meta.env.BASE_URL}icons/github.svg`} width="22" height="22" alt=""/></a>
    <span aria-hidden="true">|</span>
    <a href="https://www.instagram.com/p/DgA6IDKO9FN/" target="_blank" rel="noreferrer">{t('app.reel')}</a>
   </div>
  </div>
  <a className="sample-book-link" href={`${import.meta.env.BASE_URL}examples/reference-book-sample-2026.pdf`} target="_blank" rel="noreferrer" aria-label={t('app.sampleDescription')} title={t('app.sampleDescription')}>
   <img className="site-cover-thumbnail" src={sampleCover} width="630" height="828" alt={t('app.sampleAlt')}/>
   <span>{t('app.sample')}</span>
  </a>
 </header>;
}
