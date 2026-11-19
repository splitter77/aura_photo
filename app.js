(() => {
  const $ = (id) => document.getElementById(id);
  const cam = AuraKit.camera;
  const haptics = AuraKit.haptics;

  const vf = $('viewfinder'), video = $('video'), fake = $('fake');
  const shutter = $('shutter'), thumb = $('thumb'), thumbImg = $('thumb-img');

  const state = {
    facing: 'environment',
    zoom: 1,
    flash: 'auto',          // auto | on | off
    motion: false,
    mode: 'PHOTO',
    live: false,            // vraie caméra disponible ?
    recording: null,
    shots: [],              // { type: 'photo'|'video', src }
  };

  /* ---------- Caméra ---------- */
  async function startCamera() {
    try {
      await cam.open({ facing: state.facing, video });
      state.live = true;
      fake.hidden = true; video.hidden = false;
      hideMsg();
    } catch (e) {
      state.live = false;
      video.hidden = true; fake.hidden = false;
      startFakeScene();
      showMsg('Caméra indisponible — mode simulation');
    }
    applyTransform();
  }

  function applyTransform() {
    const mirror = state.facing === 'user' ? -1 : 1;
    const t = `scale(${state.zoom * mirror}, ${state.zoom})`;
    video.style.transform = t; fake.style.transform = `scale(${state.zoom})`;
  }

  /* Scène de remplacement quand il n'y a pas de caméra (ordinateur sans webcam, permission refusée…) */
  let fakeRaf = 0;
  function startFakeScene() {
    if (fakeRaf) return;
    const ctx = fake.getContext('2d');
    fake.width = 600; fake.height = 800;
    const draw = (t) => {
      const s = t / 1000;
      const sway = Math.sin(s * 1.3) * 6;
      // écran
      const g = ctx.createLinearGradient(0, 0, 0, 380);
      g.addColorStop(0, '#e9cdf0'); g.addColorStop(1, '#dcc3e6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 600, 380);
      ctx.fillStyle = 'rgba(80,60,90,.35)'; ctx.fillRect(140 + sway, 330, 300, 6);
      // barre des tâches + cadre
      ctx.fillStyle = '#2b3442'; ctx.fillRect(0, 380, 600, 26);
      ctx.fillStyle = '#20232a'; ctx.fillRect(0, 406, 600, 60);
      ctx.fillStyle = '#6d6a5a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('iiyama', 270 + sway / 3, 440);
      // bureau
      ctx.fillStyle = '#c8bf8a'; ctx.fillRect(0, 466, 600, 70);
      // clavier
      ctx.fillStyle = '#141414'; ctx.fillRect(0, 520, 600, 280);
      const hues = [120, 90, 60, 45, 30, 15, 0, 330, 300];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 11; c++) {
        const x = c * 56 - 8 + sway / 2 + (r % 2) * 14, y = 540 + r * 52;
        const h = hues[Math.floor(c * hues.length / 11)];
        ctx.fillStyle = `hsl(${(h + s * 20) % 360},90%,55%)`; ctx.fillRect(x - 2, y + 2, 50, 46);
        ctx.fillStyle = '#1d1d1d'; ctx.fillRect(x, y, 46, 42);
      }
      // grain
      ctx.fillStyle = 'rgba(255,255,255,.03)';
      for (let i = 0; i < 150; i++) ctx.fillRect(Math.random() * 600, Math.random() * 800, 2, 2);
      fakeRaf = requestAnimationFrame(draw);
    };
    fakeRaf = requestAnimationFrame(draw);
  }

  /* ---------- Capture : ce que montre le viseur (recadrage 3:4, zoom, miroir) ---------- */
  function captureFrame() {
    const src = state.live ? video : fake;
    const sw = state.live ? video.videoWidth : fake.width;
    const sh = state.live ? video.videoHeight : fake.height;
    if (!sw || !sh) return null;
    const aspect = vf.clientWidth / vf.clientHeight;
    let cw = sw, ch = sh;
    if (sw / sh > aspect) cw = sh * aspect; else ch = sw / aspect;
    cw /= state.zoom; ch /= state.zoom;
    const cx = (sw - cw) / 2, cy = (sh - ch) / 2;
    const scale = Math.min(1, 2400 / Math.max(cw, ch));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cw * scale); canvas.height = Math.round(ch * scale);
    const ctx = canvas.getContext('2d');
    if (state.live && state.facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    if (state.mode === 'PORTRAIT') ctx.filter = 'saturate(1.08) contrast(1.04)';
    ctx.drawImage(src, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);
    if (state.mode === 'PORTRAIT') {
      ctx.filter = 'none'; ctx.setTransform(1, 0, 0, 1, 0, 0);
      const r = ctx.createRadialGradient(canvas.width / 2, canvas.height * .45, canvas.width * .3, canvas.width / 2, canvas.height * .45, canvas.width * .8);
      r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  /* ---------- Son de déclencheur (synthétisé) ---------- */
  let audio;
  function shutterSound() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      [0, 0.07].forEach((d) => {
        const len = 0.05, buf = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
        const n = audio.createBufferSource(); n.buffer = buf;
        const f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = d ? 2600 : 1800; f.Q.value = 0.8;
        const g = audio.createGain(); g.gain.value = 0.7;
        n.connect(f).connect(g).connect(audio.destination); n.start(now + d);
      });
    } catch (_) {}
  }

  /* ---------- Prise de photo ---------- */
  let busy = false;
  async function takePhoto() {
    if (busy) return; busy = true;
    haptics.tap('medium');
    const useFlash = state.flash === 'on';
    let torched = false;
    if (useFlash && state.live && state.facing === 'environment' && cam.hasTorch()) {
      try { await cam.torch(true); torched = true; await wait(350); } catch (_) {}
    }
    const flashEl = $('shutter-flash');
    flashEl.classList.toggle('white', useFlash && !torched);
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
    shutterSound();
    const src = captureFrame();
    if (torched) cam.torch(false).catch(() => {});
    if (src) addShot({ type: 'photo', src });
    busy = false;
  }

  function addShot(shot) {
    state.shots.push(shot);
    thumbImg.src = shot.poster || shot.src;
    thumb.classList.remove('pop'); void thumb.offsetWidth; thumb.classList.add('pop');
  }

  /* ---------- Vidéo ---------- */
  let timerInt = 0;
  function toggleRecording() {
    if (state.recording) return stopRecording();
    const stream = state.live ? cam.stream : fake.captureStream(30);
    if (!window.MediaRecorder || !stream) return showMsg('Enregistrement non pris en charge', 2000);
    const poster = captureFrame();
    const chunks = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => addShot({ type: 'video', src: URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })), poster });
    rec.start();
    state.recording = rec;
    haptics.heavy();
    shutter.classList.add('recording');
    const start = Date.now();
    $('rec-timer').hidden = false; $('flash-btn').hidden = $('motion-btn').hidden = true;
    const tick = () => { const s = Math.floor((Date.now() - start) / 1000); $('rec-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    tick(); timerInt = setInterval(tick, 250);
  }
  function stopRecording() {
    state.recording.stop(); state.recording = null;
    haptics.medium();
    clearInterval(timerInt);
    shutter.classList.remove('recording');
    $('rec-timer').hidden = true; $('flash-btn').hidden = $('motion-btn').hidden = false;
  }

  shutter.addEventListener('click', () => {
    if (state.mode === 'VIDÉO') toggleRecording(); else takePhoto();
  });
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'AudioVolumeUp') { e.preventDefault(); shutter.click(); } });

  /* ---------- Modes ---------- */
  const MODES = ['VIDÉO', 'PHOTO', 'PORTRAIT', 'PRO', 'PLUS'];
  const strip = $('mode-strip'), pill = $('mode-pill');
  MODES.forEach((m) => {
    const el = document.createElement('button');
    el.className = 'mode'; el.textContent = m; el.dataset.mode = m;
    el.onclick = () => setMode(m);
    strip.appendChild(el);
  });
  function layoutModes() {
    const el = strip.querySelector(`[data-mode="${state.mode}"]`);
    const center = $('modes').clientWidth / 2;
    strip.style.transform = `translateX(${center - (el.offsetLeft + el.offsetWidth / 2)}px)`;
    pill.style.width = `${el.offsetWidth}px`;
    strip.querySelectorAll('.mode').forEach((m) => m.classList.toggle('active', m === el));
  }
  function setMode(m) {
    if (m === 'PLUS' || m === 'PRO') { showMsg(`Mode ${m.toLowerCase()} non simulé`, 1500); return; }
    if (state.recording || m === state.mode) return;
    state.mode = m;
    haptics.selection();
    layoutModes();
    shutter.classList.toggle('video', m === 'VIDÉO');
    vf.classList.toggle('portrait', m === 'PORTRAIT');
  }
  function stepMode(dir) {
    const usable = MODES.filter((m) => m !== 'PLUS' && m !== 'PRO');
    const i = usable.indexOf(state.mode) + dir;
    if (i >= 0 && i < usable.length) setMode(usable[i]);
  }

  /* ---------- Gestes dans le viseur : toucher = mise au point, glisser = changer de mode, pincer = zoom ---------- */
  let gesture = null;
  vf.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.zoom-btn')) return;
    gesture = { x: e.clientX, y: e.clientY, t: Date.now() };
  });
  vf.addEventListener('pointerup', (e) => {
    if (!gesture) return;
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) stepMode(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 10) focusAt(e);
    gesture = null;
  });
  const modesBox = $('modes');
  let mx = null;
  modesBox.addEventListener('pointerdown', (e) => { mx = e.clientX; });
  modesBox.addEventListener('pointerup', (e) => { if (mx !== null && Math.abs(e.clientX - mx) > 30) stepMode(e.clientX < mx ? 1 : -1); mx = null; });

  function focusAt(e) {
    const r = vf.getBoundingClientRect();
    const f = $('focus');
    f.style.left = `${e.clientX - r.left}px`; f.style.top = `${e.clientY - r.top}px`;
    f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
    haptics.light();
  }

  /* Pincement (zoom libre 1×–8×) */
  let pinch = null;
  vf.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { gesture = null; pinch = { d: dist(e.touches), z: state.zoom }; }
  }, { passive: true });
  vf.addEventListener('touchmove', (e) => {
    if (pinch && e.touches.length === 2) setZoom(Math.min(8, Math.max(1, pinch.z * dist(e.touches) / pinch.d)), true);
  }, { passive: true });
  vf.addEventListener('touchend', () => { pinch = null; });
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  /* ---------- Zoom ---------- */
  function setZoom(z, smooth) {
    state.zoom = z;
    video.style.transition = fake.style.transition = smooth ? 'none' : '';
    applyTransform();
    const b1 = document.querySelector('[data-zoom="1"]'), b2 = document.querySelector('[data-zoom="2"]');
    const on2 = z >= 2;
    b1.classList.toggle('active', !on2); b2.classList.toggle('active', on2);
    const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
    b1.firstChild.textContent = on2 ? '1' : `${z === 1 ? '1' : fmt(z)}×`;
    b2.firstChild.textContent = on2 ? `${z === 2 ? '2' : fmt(z)}×` : '2';
  }
  document.querySelectorAll('.zoom-btn').forEach((b) => b.addEventListener('click', () => {
    haptics.selection(); setZoom(Number(b.dataset.zoom));
  }));

  /* ---------- Boutons du haut ---------- */
  const flashBtn = $('flash-btn');
  flashBtn.dataset.mode = state.flash;
  flashBtn.onclick = () => {
    state.flash = { auto: 'on', on: 'off', off: 'auto' }[state.flash];
    flashBtn.dataset.mode = state.flash;
    haptics.selection();
    showMsg({ auto: 'Flash automatique', on: 'Flash activé', off: 'Flash désactivé' }[state.flash], 1200);
  };
  $('motion-btn').onclick = () => {
    state.motion = !state.motion;
    $('motion-btn').classList.toggle('on', state.motion);
    haptics.selection();
    showMsg(state.motion ? 'Photo animée activée' : 'Photo animée désactivée', 1200);
  };

  /* ---------- Changer de caméra ---------- */
  $('flip-btn').onclick = async () => {
    if (state.recording) return;
    haptics.light();
    $('flip-btn').classList.toggle('spin');
    state.facing = state.facing === 'environment' ? 'user' : 'environment';
    vf.animate([{ filter: 'blur(0)' }, { filter: 'blur(14px)' }, { filter: 'blur(0)' }], { duration: 500 });
    setZoom(1);
    await startCamera();
  };
  $('more-btn').onclick = () => { haptics.light(); showMsg('Réglages rapides', 1200); };

  /* ---------- Galerie ---------- */
  const gallery = $('gallery'), gScroll = $('g-scroll');
  thumb.onclick = () => {
    if (state.recording) return;
    gScroll.innerHTML = '';
    state.shots.forEach((s) => {
      const el = document.createElement(s.type === 'video' ? 'video' : 'img');
      el.src = s.src;
      if (s.type === 'video') { el.controls = true; el.playsInline = true; el.poster = s.poster || ''; el.style.cssText = 'flex:0 0 100%;width:100%;height:100%;object-fit:contain;scroll-snap-align:center'; }
      gScroll.appendChild(el);
    });
    $('g-empty').hidden = state.shots.length > 0;
    gallery.hidden = false;
    gScroll.scrollLeft = gScroll.scrollWidth;
    updateCount();
  };
  const currentIndex = () => Math.round(gScroll.scrollLeft / (gScroll.clientWidth || 1));
  const updateCount = () => { $('g-count').textContent = state.shots.length ? `${currentIndex() + 1} / ${state.shots.length}` : ''; };
  gScroll.addEventListener('scroll', updateCount);
  $('g-close').onclick = () => { gallery.hidden = true; gScroll.querySelectorAll('video').forEach((v) => v.pause()); };
  $('g-delete').onclick = () => {
    if (!state.shots.length) return;
    const i = currentIndex();
    state.shots.splice(i, 1);
    gScroll.children[i].remove();
    const last = state.shots[state.shots.length - 1];
    if (last) thumbImg.src = last.poster || last.src; else thumbImg.removeAttribute('src');
    $('g-empty').hidden = state.shots.length > 0;
    haptics.warning();
    updateCount();
  };

  /* ---------- Messages ---------- */
  let msgTimer = 0;
  function showMsg(text, ms) {
    const m = $('cam-msg'); m.textContent = text; m.hidden = false;
    clearTimeout(msgTimer); if (ms) msgTimer = setTimeout(hideMsg, ms);
  }
  function hideMsg() { $('cam-msg').hidden = true; }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Démarrage ---------- */
  window.addEventListener('resize', layoutModes);
  document.fonts && document.fonts.ready.then(layoutModes);
  layoutModes();
  startCamera();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (state.recording) stopRecording(); cam.close(); }
    else startCamera();
  });
})();
