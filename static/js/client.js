(function () {
  const cv = document.getElementById('cv');
  const cx = cv.getContext('2d');
  const rows = 6, cols = 9, cellW = cv.width / cols, cellH = cv.height / rows;

  const key = 'the101game.alias';
  let alias = localStorage.getItem(key) || prompt('Enter your alias', '') || 'Player';
  alias = alias.trim() || 'Player';
  localStorage.setItem(key, alias);
  document.getElementById('alias').textContent = alias;

  const ioopts = { transports: ['websocket'], upgrade: false };
  const sock = io('', ioopts);

  const players = new Map(); // id -> {alias, cell}
  let myId = null;

  function draw() {
    cx.clearRect(0,0,cv.width,cv.height);
    // grid
    cx.strokeStyle = '#ccc';
    for (let r=1;r<rows;r++){ cx.beginPath(); cx.moveTo(0,r*cellH); cx.lineTo(cv.width,r*cellH); cx.stroke(); }
    for (let c=1;c<cols;c++){ cx.beginPath(); cx.moveTo(c*cellW,0); cx.lineTo(c*cellW,cv.height); cx.stroke(); }
    // players
    players.forEach((p,id)=>{
      const r = Math.floor(p.cell / cols), c = p.cell % cols;
      cx.fillStyle = id===myId ? '#06f' : '#f60';
      cx.beginPath();
      cx.arc(c*cellW+cellW/2, r*cellH+cellH/2, Math.min(cellW,cellH)/3, 0, Math.PI*2);
      cx.fill();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  sock.on('connect', ()=>{
    myId = sock.id; // transport id; okay for demo
    sock.emit('hello', { alias, cell: 0 });
  });

  sock.on('join', (p)=>{
    players.set(p.id, { alias: p.alias, cell: p.cell ?? 0 });
    document.getElementById('room').textContent = 'online: ' + players.size;
  });
  sock.on('state', (p)=>{
    const cur = players.get(p.id) || { alias:'?' , cell:0 };
    cur.cell = p.cell;
    players.set(p.id, cur);
  });
  sock.on('leave', (p)=>{
    players.delete(p.id);
    document.getElementById('room').textContent = 'online: ' + players.size;
  });
  sock.on('full', (m)=>{ alert(m.msg || 'Server full'); });

  // A = PageDown (-1), F = PageUp (+1)
  const keyMap = { 'KeyA': -1, 'KeyF': +1 };
  window.addEventListener('keydown', (e)=>{
    if (keyMap[e.code]) {
      e.preventDefault();
      sock.emit('move', keyMap[e.code]);
    }
  });
})();
