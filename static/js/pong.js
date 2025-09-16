(function(){
  // Mount only on page 0002 or when #page has data-page="0002"
  const getIdx = () => Number(localStorage.getItem('pager.idx')||0);
  const pageEl = document.getElementById('page') || document.body;
  const is0002 = (pageEl.getAttribute('data-page')==='0002') || (getIdx()===2);
  if (!is0002) return;

  // Build stage
  const wrap = document.createElement('div');
  wrap.style.margin = '80px auto 24px';
  wrap.style.maxWidth = '900px';
  wrap.style.padding = '0 12px';
  wrap.innerHTML = `
    <h2 style="margin:.2rem 0 1rem">0002 / 5200 — PONG</h2>
    <p style="opacity:.8;margin:.2rem 0 1rem">
      player one: <b>PING</b> (UP/DOWN) · player two: <b>PONG</b> (UP/DOWN) ·
      <span id="pong-status">wachten...</span>
    </p>
    <canvas id="pong-canvas" width="900" height="520"
      style="width:100%;height:auto;background:#0b0e11;border:1px solid #2b3440;border-radius:12px;display:block"></canvas>
  `;
  pageEl.innerHTML = '';
  pageEl.appendChild(wrap);

  // Canvas & sizes (scale to HiDPI)
  const cvs = document.getElementById('pong-canvas');
  const ctx = cvs.getContext('2d');
  const DPR = Math.min(2, (window.devicePixelRatio||1));
  function resize(){
    const w = 900, h = 520;
    cvs.width = Math.floor(w*DPR); cvs.height = Math.floor(h*DPR);
    cvs.style.width = '100%'; // CSS scales
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize(); window.addEventListener('resize', resize);

  // Game state
  const W=900, H=520, PADH=96, PADW=12, MARGIN=18;
  let role = 'P1';   // 'P1' = PING (links), 'P2' = PONG (rechts)
  let bot  = true;   // becomes false when a 2nd player joins
  let running = true;
  let scoreL = 0, scoreR = 0;
  const maxScore = 5;

  const state = {
    p1y: (H-PADH)/2,
    p2y: (H-PADH)/2,
    ball: { x: W/2, y: H/2, vx: 4, vy: 3.2, r: 8 },
    red:  { x: 0, y: 24, vx: 2.2, r: 4 }
  };

  // Controls
  let up=false, down=false;
  document.addEventListener('keydown', e=>{
    if (['ArrowUp','KeyW'].includes(e.code)) up=true;
    if (['ArrowDown','KeyS'].includes(e.code)) down=true;
  });
  document.addEventListener('keyup', e=>{
    if (['ArrowUp','KeyW'].includes(e.code)) up=false;
    if (['ArrowDown','KeyS'].includes(e.code)) down=false;
  });
  // touch (mobile)
  cvs.addEventListener('touchstart', e=>{ const y=e.touches[0].clientY; up=y<cvs.getBoundingClientRect().height/2; down=!up; });
  cvs.addEventListener('touchend', ()=>{ up=down=false; });

  // Socket.IO (optional – works offline vs bot too)
  let socket=null, roomId=null;
  const aliasKey='the101game.alias';
  const alias=(localStorage.getItem(aliasKey)||'Player').slice(0,24);

  function setStatus(s){ const el=document.getElementById('pong-status'); if(el) el.textContent=s; }

  try {
    // global io() is served from /socket.io/socket.io.js via nginx
    socket = io();
    socket.on('connect', ()=>{
      socket.emit('pong:hello', { alias, page: 2 });
    });
    socket.on('pong:welcome', (msg)=>{
      roomId = msg.room;
      role   = msg.role;        // 'P1' or 'P2'
      bot    = !msg.hasOpponent;
      setStatus(msg.hasOpponent ? '2 spelers — live duel' : '1 speler — bot actief');
    });
    socket.on('pong:opponent-joined', ()=>{
      bot=false; setStatus('2 spelers — live duel');
    });
    socket.on('pong:update', (s)=>{
      // From other player / server
      if (role==='P1') { state.p2y = s.p2y; }
      else             { state.p1y = s.p1y; }
      if (s.ball && s.author==='P1') state.ball = s.ball; // P1 is authoritative for ball
    });
    socket.on('pong:swap', (data)=>{
      // You lost, go to waiting (page 0003)
      running=false;
      setStatus('gewisseld: naar wachtkamer (0003)…');
      localStorage.setItem('pager.idx','3'); // move to 0003
      setTimeout(()=>location.reload(), 1200);
    });
  } catch(e){ /* offline, ok */ }

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function resetBall(toLeft){
    state.ball.x=W/2; state.ball.y=H/2;
    const sp=4.2, ang=(Math.random()*0.6-0.3);
    state.ball.vx=(toLeft?-1:1)*(sp+Math.random()*1.5);
    state.ball.vy=Math.sin(ang)*(sp+1.2);
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // middle line
    ctx.strokeStyle='#223247'; ctx.lineWidth=2; ctx.setLineDash([8,8]);
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke(); ctx.setLineDash([]);

    // paddles
    ctx.fillStyle='#e9eef2';
    ctx.fillRect(MARGIN, state.p1y, PADW, PADH);
    ctx.fillRect(W-MARGIN-PADW, state.p2y, PADW, PADH);

    // scores
    ctx.font='24px system-ui,Segoe UI,Roboto,Arial'; ctx.textAlign='center';
    ctx.fillText(String(scoreL), W/2-40, 30);
    ctx.fillText(String(scoreR), W/2+40, 30);

    // white ball
    ctx.beginPath(); ctx.fillStyle='#fff';
    ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI*2); ctx.fill();

    // red dot (left->right)
    ctx.beginPath(); ctx.fillStyle='#f25f5c';
    ctx.arc(state.red.x, state.red.y, state.red.r, 0, Math.PI*2); ctx.fill();
  }

  let lastSync=0;
  function tick(){
    if (!running) return;
    // Controls → move my paddle
    const speed = 6;
    if (role==='P1'){
      if (up)   state.p1y = clamp(state.p1y - speed, 0, H-PADH);
      if (down) state.p1y = clamp(state.p1y + speed, 0, H-PADH);
    } else {
      if (up)   state.p2y = clamp(state.p2y - speed, 0, H-PADH);
      if (down) state.p2y = clamp(state.p2y + speed, 0, H-PADH);
    }

    // Bot follows ball when there is no human opponent
    if (bot){
      const target = state.ball.y - PADH/2;
      const by = role==='P1' ? 'p2y' : 'p1y';
      const cur = state[by];
      state[by] = clamp(cur + Math.sign(target-cur) * 4.2, 0, H-PADH);
    }

    // Ball physics (authoritative on P1)
    if (role==='P1'){
      let b = state.ball;
      b.x += b.vx; b.y += b.vy;

      // top/bottom
      if (b.y-b.r<0 && b.vy<0) b.vy*=-1;
      if (b.y+b.r>H && b.vy>0) b.vy*=-1;

      // left paddle
      if (b.x-b.r < MARGIN+PADW && b.vx<0 &&
          b.y > state.p1y && b.y < state.p1y+PADH){
        b.x = MARGIN+PADW+b.r; b.vx*=-1.05;
        const off = (b.y - (state.p1y+PADH/2)) / (PADH/2);
        b.vy += off*2.2;
      }
      // right paddle
      if (b.x+b.r > W-MARGIN-PADW && b.vx>0 &&
          b.y > state.p2y && b.y < state.p2y+PADH){
        b.x = W-MARGIN-PADW-b.r; b.vx*=-1.05;
        const off = (b.y - (state.p2y+PADH/2)) / (PADH/2);
        b.vy += off*2.2;
      }

      // scoring
      if (b.x < -20){
        scoreR++; resetBall(false);
        if (scoreR>=maxScore) gameOver('P1');
      }
      if (b.x > W+20){
        scoreL++; resetBall(true);
        if (scoreL>=maxScore) gameOver('P2');
      }
    }

    // Red dot (pure cosmetic)
    state.red.x += state.red.vx;
    if (state.red.x > W+20){ state.red.x = -20; state.red.y = 24 + Math.random()*(H-48); }

    // Networking: send my paddle (and ball if P1) at ~30fps
    const now = performance.now();
    if (socket && socket.connected && now - lastSync > 33){
      lastSync = now;
      socket.emit('pong:state', {
        room: roomId,
        role,
        p1y: state.p1y,
        p2y: state.p2y,
        ball: role==='P1' ? state.ball : undefined
      });
    }

    draw();
    requestAnimationFrame(tick);
  }

  function gameOver(loser){
    running=false;
    setStatus((loser==='P1'?'PING':'PONG')+' verliest');
    if (socket && socket.connected){
      socket.emit('pong:over', { room: roomId, loser });
    }
    setTimeout(()=>{
      scoreL=0; scoreR=0; resetBall(Math.random()<.5);
      running=true; requestAnimationFrame(tick);
    }, 1200);
  }

  resetBall(Math.random()<.5);
  requestAnimationFrame(tick);
})();
