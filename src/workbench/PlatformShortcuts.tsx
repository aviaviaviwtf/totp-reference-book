const platforms = [
 ['Instagram', 'https://accountscenter.instagram.com/password_and_security/two_factor/'],
 ['Facebook', 'https://accountscenter.facebook.com/password_and_security/two_factor/'],
 ['Twitter', 'https://x.com/settings/account/login_verification'],
 ['Google', 'https://myaccount.google.com/signinoptions/two-step-verification'],
 ['GitHub', 'https://github.com/settings/two_factor_authentication/setup/intro'],
 ['LinkedIn', 'https://www.linkedin.com/mypreferences/d/two-factor-authentication'],
] as const;

export default function PlatformShortcuts({heading}: {heading: string}) {
 return <div className="platform-shortcuts">
  <h3 id="platform-shortcuts-heading">{heading}</h3>
  <ul role="list" aria-labelledby="platform-shortcuts-heading">
   {platforms.map(([name, href]) => <li key={name}>
    <a href={href} target="_blank" rel="noreferrer">{name} <span aria-hidden="true">↗</span></a>
   </li>)}
  </ul>
 </div>;
}
