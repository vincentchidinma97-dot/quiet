// Runs synchronously before first paint to apply saved theme and prevent flash.
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem('quiet-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
