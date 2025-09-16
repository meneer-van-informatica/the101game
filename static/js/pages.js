// SRT-gedreven content per pagina/language, 0000..5199 (total 5200)
window.PageBook = (function(){
  const total = 5200;

  function pad4(n){ return String(n).padStart(4,'0'); }

  function el(tag, attrs={}, html=''){
    const n = document.createElement(tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (html) n.innerHTML = html;
    return n;
  }

  function parseSRT(s){
    const blocks = s.trim().split(/\n\s*\n/);
    const items = [];
    for (const b of blocks) {
      const lines = b.split('\n');
      if (lines.length < 2) continue;
      const text = lines.slice(2).join('\n');
      items.push(text);
    }
    return items;
  }

  async function loadSRT(idx, lang){
    const url = `/pages/${lang}/${pad4(idx)}.srt`;
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error('no srt');
    return parseSRT(await r.text());
  }

  function defaultContent(i){
    const d = el('div');
    d.append(
      el('h1',{},`Page ${String(i).padStart(4,'0')} / 5200`),
      el('p',{}, 'Deze pagina heeft nog geen SRT. Gebruik het script om een template te genereren.')
    );
    return d;
  }

  async function render(i, lang){
    const root = document.getElementById('page');
    root.replaceChildren();
    try{
      const blocks = await loadSRT(i, lang);
      const c = el('div');
      for (const t of blocks) c.append(el('p',{}, t.replaceAll('\n','<br>')));
      root.append(c);
    } catch {
      root.append(defaultContent(i));
    }
  }

  return { total, render, pad4 };
})();

