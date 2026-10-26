/* Dishista — interactions: globe, rotating headline, reveals, counters, story, chat, store dialog. */
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

  /* Store badges: before launch they open a friendly “coming soon” dialog. */
  const dialog = document.querySelector('dialog.soon-dialog');
  if (!cfg.launched && dialog) {
    document.querySelectorAll('[data-store], [data-notify]').forEach((a) =>
      a.addEventListener('click', (ev) => {
        if (a.hasAttribute('data-notify') && !a.hasAttribute('data-store')) return;
        ev.preventDefault();
        dialog.showModal();
      }),
    );
    dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
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
      R = Math.min(w, h) * 0.42;
    };
    resize();
    window.addEventListener('resize', resize);

    const project = (v) => {
      const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
      const x1 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy;
      const y2 = v[1] * cx - z1 * sx, z2 = v[1] * sx + z1 * cx;
      return [w / 2 + x1 * R, h / 2 - y2 * R, z2];
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Atmosphere glow
      const g = ctx.createRadialGradient(w / 2, h / 2, R * 0.85, w / 2, h / 2, R * 1.35);
      g.addColorStop(0, 'rgba(242,165,65,0.20)');
      g.addColorStop(1, 'rgba(242,165,65,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h / 2, R * 1.35, 0, Math.PI * 2); ctx.fill();
      // Sphere body
      const body = ctx.createRadialGradient(w / 2 - R * 0.35, h / 2 - R * 0.4, R * 0.1, w / 2, h / 2, R);
      body.addColorStop(0, 'rgba(255,255,255,0.10)');
      body.addColorStop(1, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(w / 2, h / 2, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
      // Land dots
      const size = Math.max(1.4, R / 140);
      for (const v of pts) {
        const [x, y, z] = project(v);
        if (z < -0.05) continue;
        const a = 0.3 + 0.7 * Math.max(0, z);
        ctx.fillStyle = `rgba(255,${Math.round(196 + 40 * z)},${Math.round(150 + 60 * z)},${a})`;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      // Pins with flags
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sorted = pinPts.map((p) => ({ p, s: project(p.v) })).sort((a, b) => a.s[2] - b.s[2]);
      for (const { p, s } of sorted) {
        const [x, y, z] = s;
        if (z < 0.08) continue;
        const k = 0.65 + 0.35 * z;
        ctx.globalAlpha = Math.min(1, (z - 0.08) * 4);
        ctx.fillStyle = 'rgba(228,87,46,0.35)';
        ctx.beginPath(); ctx.arc(x, y, 22 * k, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, 15 * k, 0, Math.PI * 2); ctx.fill();
        ctx.font = `${Math.round(17 * k)}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
        ctx.fillText(p.flag, x, y + 1);
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
