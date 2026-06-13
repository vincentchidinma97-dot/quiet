// Runs synchronously before first paint to prevent flash of wrong theme/typography/size.
export function ThemeScript() {
  const script = `(function(){try{
    var t=localStorage.getItem('quiet-theme');
    if(t)document.documentElement.setAttribute('data-theme',t);
    var ty=localStorage.getItem('quiet-typography');
    if(ty)document.documentElement.setAttribute('data-typography',ty);
    var ts=localStorage.getItem('quiet-text-scale');
    if(ts)document.documentElement.style.setProperty('--text-scale',ts);
  }catch(e){}})()`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
