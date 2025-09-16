// Scorebord overlay (online count + waar is iedereen)
(function(){
  const $menu = document.getElementById('menu-btn');
  const $board = document.getElementById('board');
  const $count = document.getElementById('online-count');
  const $byPage = document.getElementById('by-page');
  const $list = document.getElementById('online-list');

  function fmtByPage(byPage){
    $byPage.replaceChildren();
    const pages = Object.keys(byPage).map(k=>({page:+k, n:byPage[k]})).sort((a,b)=>a.page-b.page);
    if (pages.length===0) {
      const d = document.createElement('div'); d.className='card'; d.textContent = 'Niemand online.';
      $byPage.append(d); return;
    }
    for (const {page, n} of pages) {
      const d = document.createElement('div'); d.className='card';
      d.innerHTML = `<b>${page} / 101</b><div>${n} online</div>`;
      $byPage.append(d);
    }
  }
  function fmtList(list){
    $list.replaceChildren();
    for (const u of list.sort((a,b)=>a.alias.localeCompare(b.alias))) {
      const li = document.createElement('li');
      li.textContent = `${u.alias} — ${u.lastPage ?? 0} / 101`;
      $list.append(li);
    }
  }

  async function refresh() {
    try{
      const r = await fetch('/api/online/summary', { cache:'no-store' });
      const j = await r.json();
      if (!j.ok) return;
      $count.textContent = `${j.onlineCount} online`;
      fmtByPage(j.byPage || {});
      fmtList(j.list || []);
    }catch{}
  }

  let open = false, timer = null;
  function show(v){
    open = !!v;
    $board.style.display = open ? 'flex' : 'none';
    clearInterval(timer);
    if (open) { refresh(); timer = setInterval(refresh, 7000); }
  }

  if ($menu) $menu.addEventListener('click', ()=> show(!open));
  if ($board) $board.addEventListener('click', (e)=>{ if (e.target===$board) show(false); });
})();

