/* Dishista — interactions: globe, parallax, rotating headline, reveals, counters, story, chat, store dialog. */
(() => {
  const cfg = window.DISHISTA || {};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header turns solid once you scroll past the hero. */
  const header = document.querySelector('.site-header');
  if (header && !header.classList.contains('solid')) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Remember an explicit language choice so the root page doesn't redirect again. */
  document.querySelectorAll('[data-lang-link]').forEach((a) =>
    a.addEventListener('click', () => {
      try { localStorage.setItem('dishista-lang', a.dataset.langLink); } catch {}
    }),
  );

  /* Rotating word in the headline. */
  const rot = document.querySelectorAll('.rotator > span');
  if (rot.length > 1 && !reduce) {
    let i = 0;
    setInterval(() => {
      rot[i].classList.remove('on');
      i = (i + 1) % rot.length;
      rot[i].classList.add('on');
    }, 2300);
  }

  /* Reveal on scroll + counters + chat. */
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        if (e.target.dataset.count) countUp(e.target);
        if (e.target.classList.contains('chat')) playChat(e.target);
        io.unobserve(e.target);
      }
    },
    { threshold: 0.18 },
  );
  document.querySelectorAll('[data-reveal], [data-count], .chat').forEach((el) => io.observe(el));

  function countUp(el) {
    const end = Number(el.dataset.count);
    if (reduce) { el.textContent = end; return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function playChat(chat) {
    const items = [...chat.querySelectorAll('.bubble:not(.typing)')];
    const typing = chat.querySelector('.bubble.typing');
    let delay = 200;
    items.forEach((b) => {
      const bot = b.classList.contains('bot');
      if (bot && typing && !reduce) {
        setTimeout(() => { b.before(typing); typing.classList.add('in'); }, delay);
        delay += 900;
      }
      setTimeout(() => { if (typing) typing.classList.remove('in'); b.classList.add('in'); }, delay);
      delay += bot ? 700 : 600;
    });
    if (typing) setTimeout(() => typing.remove(), delay);
  }

  /* Scrollytelling: the sticky phone follows the active step. */
  const steps = document.querySelectorAll('.story .step');
  const shots = document.querySelectorAll('.story .sticky .screen img');
  if (steps.length && shots.length) {
    const sio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number(e.target.dataset.index);
          steps.forEach((s) => s.classList.toggle('active', s === e.target));
          shots.forEach((img, j) => img.classList.toggle('on', j === i));
          const phone = document.querySelector('.story .sticky .phone');
          if (phone) phone.style.transform = `rotate(${[-2, 2, -1.5, 1.5][i] ?? 0}deg)`;
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    steps.forEach((s) => sio.observe(s));
  }

  /* Store buttons: before launch they open a friendly “coming soon” dialog. */
  const dialog = document.querySelector('dialog.soon-dialog');
  if (!cfg.launched && dialog) {
    document.querySelectorAll('[data-store]').forEach((a) =>
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        dialog.showModal();
      }),
    );
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
    dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  }

  /* Hero parallax: phone, dish chips and 3D icons drift with the pointer at different depths. */
  const hero = document.querySelector('.hero');
  const layers = hero ? [...hero.querySelectorAll('.hero-phone, .float-chip, .stage .float')] : [];
  if (hero && layers.length && !reduce && window.matchMedia('(pointer: fine)').matches) {
    const depth = (el) => Number(el.dataset.depth || (el.classList.contains('hero-phone') ? 0.5 : el.classList.contains('float') ? 1.4 : 0.9));
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const step = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      for (const el of layers) {
        const d = depth(el);
        el.style.setProperty('--px', `${(cx * 18 * d).toFixed(2)}px`);
        el.style.setProperty('--py', `${(cy * 14 * d).toFixed(2)}px`);
      }
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  }

  /* ── Globe ── */
  const canvas = document.querySelector('canvas.globe');
  if (canvas && cfg.globe) initGlobe(canvas, cfg.globe, cfg.pins || []);

  function initGlobe(canvas, flat, pins) {
    const ctx = canvas.getContext('2d');
    const pts = [];
    const rad = Math.PI / 180;
    for (let i = 0; i < flat.length; i += 2) {
      const lat = flat[i] * rad, lon = flat[i + 1] * rad;
      pts.push([Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]);
    }
    const pinPts = pins.map((p) => {
      const lat = p.lat * rad, lon = p.lng * rad;
      return { ...p, v: [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)] };
    });
    let w = 0, h = 0, dpr = 1, R = 0;
    let rotY = -0.35, rotX = 0.32, vel = reduce ? 0 : 0.0018, dragging = false, lastX = 0, lastY = 0, visible = true;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      R = Math.min(w * 0.42, h * 0.42);
    };
    resize();
    window.addEventListener('resize', resize);

    const project = (v) => {
      const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
      const x1 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy;
      const y2 = v[1] * cx - z1 * sx, z2 = v[1] * sx + z1 * cx;
      return [w * 0.46 + x1 * R, h * 0.46 - y2 * R, z2];
    };

    const dark = () => {
      const t = document.documentElement.dataset.theme;
      return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    };

    // Same look as the app icon: a soft glossy sphere with tomato land dots.
    const draw = () => {
      const dk = dark();
      const X = w * 0.46, Y = h * 0.46;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Soft contact shadow
      const sh = ctx.createRadialGradient(X + R * 0.12, Y + R * 0.18, R * 0.6, X + R * 0.12, Y + R * 0.18, R * 1.12);
      sh.addColorStop(0, dk ? 'rgba(0,0,0,0.5)' : 'rgba(120,50,20,0.22)');
      sh.addColorStop(1, 'rgba(120,50,20,0)');
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(X + R * 0.12, Y + R * 0.18, R * 1.12, 0, Math.PI * 2); ctx.fill();
      // Sphere body
      const body = ctx.createRadialGradient(X - R * 0.35, Y - R * 0.42, R * 0.05, X, Y, R);
      if (dk) { body.addColorStop(0, '#4a3a30'); body.addColorStop(0.55, '#2c221c'); body.addColorStop(1, '#1d1612'); }
      else { body.addColorStop(0, '#ffffff'); body.addColorStop(0.5, '#fff5ea'); body.addColorStop(0.88, '#f8dcc2'); body.addColorStop(1, '#ecc09c'); }
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
      // Land dots
      const size = Math.max(1.6, R / 120);
      for (const v of pts) {
        const [x, y, z] = project(v);
        if (z < 0) continue;
        ctx.globalAlpha = Math.min(1, 0.2 + z * 1.05);
        ctx.fillStyle = z > 0.55 ? '#ee4524' : '#f0603a';
        const s = size * (0.55 + 0.45 * z);
        ctx.beginPath(); ctx.arc(x, y, s / 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Rim light + specular highlight (the "plastic" gloss)
      const rim = ctx.createLinearGradient(X - R, Y - R, X + R, Y + R);
      rim.addColorStop(0, 'rgba(255,255,255,0.85)'); rim.addColorStop(0.5, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,200,140,0.5)');
      ctx.strokeStyle = rim; ctx.lineWidth = Math.max(2, R / 50); ctx.beginPath(); ctx.arc(X, Y, R - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
      const spec = ctx.createRadialGradient(X - R * 0.42, Y - R * 0.5, 0, X - R * 0.42, Y - R * 0.5, R * 0.32);
      spec.addColorStop(0, dk ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.95)'); spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(X - R * 0.42, Y - R * 0.5, R * 0.32, 0, Math.PI * 2); ctx.fill();
      // Pins with flags
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sorted = pinPts.map((p) => ({ p, s: project(p.v) })).sort((a, b) => a.s[2] - b.s[2]);
      for (const { p, s } of sorted) {
        const [x, y, z] = s;
        if (z < 0.1) continue;
        const k = 0.7 + 0.3 * z;
        ctx.globalAlpha = Math.min(1, (z - 0.1) * 4);
        ctx.shadowColor = 'rgba(92,48,18,0.35)'; ctx.shadowBlur = 12 * k; ctx.shadowOffsetY = 5 * k;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y - 6 * k, 17 * k, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.beginPath(); ctx.moveTo(x - 6 * k, y + 8 * k); ctx.lineTo(x + 6 * k, y + 8 * k); ctx.lineTo(x, y + 16 * k); ctx.closePath(); ctx.fill();
        ctx.font = `${Math.round(18 * k)}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
        ctx.fillText(p.flag, x, y - 5 * k);
        ctx.globalAlpha = 1;
      }
    };

    const tick = () => {
      if (visible) {
        if (!dragging) rotY += vel;
        draw();
      }
      requestAnimationFrame(tick);
    };
    draw();
    if (!reduce) requestAnimationFrame(tick);

    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      rotY += dx * 0.006;
      rotX = Math.max(-1.1, Math.min(1.1, rotX + dy * 0.004));
      if (reduce) draw();
    });
    const stop = () => { dragging = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }
})();
