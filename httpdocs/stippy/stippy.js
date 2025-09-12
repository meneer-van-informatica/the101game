(function(){
  const dot = document.createElement('div');
  dot.id = 'stippy';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(dot));
  const safe = { t: 8, r: 8, b: 8, l: 8 }; // kleine marge

  function placeAt(x, y){
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    x = Math.min(vw - safe.r, Math.max(safe.l, x));
    y = Math.min(vh - safe.b, Math.max(safe.t, y));
    dot.style.left = x + 'px';
    dot.style.top  = y + 'px';
    dot.classList.add('show');
    dot.classList.remove('pulse'); void dot.offsetWidth; dot.classList.add('pulse');
  }

  function rectFromSelection(){
    const sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0) return null;
    const rng = sel.getRangeAt(0);
    if (sel.isCollapsed) return null;
    const rect = rng.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) return rect;
    const el = rng.startContainer && rng.startContainer.parentElement;
    return el ? el.getBoundingClientRect() : null;
  }

  function showFromSelection(fallback){
    const rect = rectFromSelection();
    if (rect){
      placeAt(rect.right + 10, rect.top);
    } else if (fallback){
      placeAt(fallback.x, fallback.y);
    } else {
      hide();
    }
  }

  function hide(){
    dot.classList.remove('show');
  }

  let lastPointer = null;
  window.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
  window.addEventListener('pointerup',   e => { lastPointer = { x: e.clientX, y: e.clientY }; setTimeout(()=>showFromSelection(lastPointer), 0); }, { passive: true });
  window.addEventListener('dblclick',    e => { lastPointer = { x: e.clientX, y: e.clientY }; setTimeout(()=>showFromSelection(lastPointer), 0); }, { passive: true });
  document.addEventListener('selectionchange', () => { setTimeout(()=>showFromSelection(lastPointer), 0); });

  // auto hide als selectie verdwijnt
  document.addEventListener('keyup', () => { if (window.getSelection && window.getSelection().isCollapsed) hide(); });
  document.addEventListener('pointerdown', e => {
    // tik in lege ruimte → verberg
    if (!rectFromSelection()) hide();
  }, { passive: true });
})();
