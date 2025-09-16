async function loadSettings() {
  const res = await fetch('/the101game/game.settings', { cache: 'no-store' });
  if (!res.ok) throw new Error('settings load failed');
  return res.json();
}
function scrollLevels(dir) {
  console.log('scrollLevels', dir); // koppel aan jouw engine
}
loadSettings().then(cfg => {
  const keyMap = { 'KeyA': -1, 'KeyF': +1 }; // A=PgDn, F=PgUp
  window.addEventListener('keydown', (e) => {
    if (e.code in keyMap) { e.preventDefault(); scrollLevels(keyMap[e.code]); }
  });
  console.log('grid', cfg.grid.rows, 'x', cfg.grid.cols);
}).catch(console.error);
