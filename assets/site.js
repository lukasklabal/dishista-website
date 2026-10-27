/* Dishista — interactions: plate ring, parallax, rotating headline, reveals, counters, story, chat, store dialog. */
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

  /* Scrollytelling: the sticky phone tilts in 3D with the scroll, screens wipe in like an app
     switching views, and two cards per step float out of the phone. Everything is lerped in one
     rAF loop, so the motion stays buttery even with coarse wheel steps. */
  const story = document.querySelector('.story');
  const stage = story?.querySelector('.stage3d');
  if (story && stage) {
    const steps = [...story.querySelectorAll('.step')];
    const shots = [...stage.querySelectorAll('.screen img')];
    const groups = [...stage.querySelectorAll('.callouts')];
    let current = 0, target = { ry: 0, rx: 0, y: 0, local: 0 }, now = { ry: 0, rx: 0, y: 0, local: 0 }, running = false;
    const setActive = (i) => {
      if (i === current) return;
      current = i;
      steps.forEach((st, j) => st.classList.toggle('active', j === i));
      shots.forEach((img, j) => { img.classList.toggle('on', j === i); img.classList.toggle('past', j < i); });
      groups.forEach((g, j) => g.classList.toggle('on', j === i));
    };
    const measure = () => {
      const mid = window.innerHeight / 2;
      let best = 0, bestD = Infinity;
      steps.forEach((st, j) => {
        const r = st.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = j; }
      });
      const r = steps[best].getBoundingClientRect();
      const local = Math.max(-0.5, Math.min(0.5, (mid - (r.top + r.height / 2)) / r.height));
      setActive(best);
      const side = best % 2 ? 1 : -1;
      target = { ry: side * 9 - local * 16, rx: local * 7, y: -local * 24, local };
    };
    const tick = () => {
      const k = reduce ? 1 : 0.1;
      let moving = false;
      for (const key of Object.keys(target)) {
        now[key] += (target[key] - now[key]) * k;
        if (Math.abs(target[key] - now[key]) > 0.01) moving = true;
      }
      stage.style.transform = `translateY(${now.y.toFixed(2)}px) rotateY(${now.ry.toFixed(2)}deg) rotateX(${now.rx.toFixed(2)}deg)`;
      stage.style.setProperty('--local', now.local.toFixed(3));
      running = moving;
      if (moving) requestAnimationFrame(tick);
    };
    const onScroll = () => {
      measure();
      if (!running) { running = true; requestAnimationFrame(tick); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* Hero phone drifts up and straightens as you scroll away from the hero. */
  const heroPhone = document.querySelector('.stage .hero-phone');
  if (heroPhone && !reduce) {
    let queued = false;
    const update = () => {
      queued = false;
      const p = Math.min(1, window.scrollY / window.innerHeight);
      heroPhone.style.setProperty('--sy', `${(-p * 90).toFixed(1)}px`);
      heroPhone.style.setProperty('--sr', `${(p * 9).toFixed(2)}deg`);
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
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
  const layers = hero ? [...hero.querySelectorAll('.hero-phone, .stage .float')] : [];
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

  /* ── Talíře kuchyní: prstenec jídel kolem telefonu. Pomalu se točí, tažením se roztočí
     (se setrvačností), klepnutím na talíř se natočí dopředu a ukáže, o jakou kuchyni jde. ── */
  const ringEl = document.querySelector('.plates');
  if (ringEl) initPlates(ringEl);

  function initPlates(ring) {
    const stageEl = ring.closest('.stage');
    const plates = [...ring.querySelectorAll('.plate')];
    const label = stageEl.querySelector('.plate-label');
    const N = plates.length;
    const TAU = Math.PI * 2;
    const AUTO = reduce ? 0 : 0.11;              // rad / s
    let rot = 0, vel = AUTO, dragging = false, moved = 0, lastX = 0, lastT = 0, tween = null, holdUntil = 0;
    let W = 0, H = 0, S = 0, CX = 0, CY = 0, RX = 0, RY = 0, front = -1, running = false, visible = true, prev = 0;

    const resize = () => {
      const r = stageEl.getBoundingClientRect();
      W = r.width; H = r.height;
      const small = W < 560;
      S = Math.max(80, Math.min(small ? W * 0.27 : W * 0.24, 172));
      CX = W * (small ? 0.42 : 0.38); CY = H * (small ? 0.42 : 0.44);
      RX = W * (small ? 0.36 : 0.34); RY = H * (small ? 0.15 : 0.17);
      ring.style.setProperty('--s', `${S.toFixed(1)}px`);
      if (label) { label.style.left = `${CX}px`; label.style.top = `${CY + RY + S * 0.56}px`; }
      draw();
    };

    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

    function draw() {
      let best = 0, bestD = -2;
      plates.forEach((el, i) => {
        const th = rot + (i / N) * TAU;
        const c = Math.cos(th);
        const d = (c + 1) / 2;                       // 0 vzadu … 1 vpředu
        const x = CX + RX * Math.sin(th), y = CY + RY * c;
        const k = 0.42 + 0.58 * d;
        el.style.transform = `translate3d(${(x - S / 2).toFixed(1)}px, ${(y - S / 2).toFixed(1)}px, 0) scale(${k.toFixed(3)})`;
        el.style.zIndex = String(Math.round(d * 100));
        el.style.setProperty('--shade', ((1 - d) * 0.42).toFixed(3));
        if (c > bestD) { bestD = c; best = i; }
      });
      if (best !== front) {
        if (front >= 0) plates[front].classList.remove('front');
        front = best;
        plates[front].classList.add('front');
        if (label) {
          label.querySelector('b').textContent = plates[front].dataset.label;
          label.querySelector('small').textContent = plates[front].dataset.recipes;
          label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
        }
      }
    }

    function frame(t) {
      const dt = Math.min(0.05, prev ? (t - prev) / 1000 : 0);
      prev = t;
      if (tween) {
        const p = Math.min(1, (t - tween.t0) / tween.ms);
        const ease = 1 - Math.pow(1 - p, 3);
        rot = tween.from + (tween.to - tween.from) * ease;
        if (p >= 1) { tween = null; vel = 0; }
      } else if (!dragging) {
        const auto = t < holdUntil ? 0 : AUTO;
        vel += (auto - vel) * (1 - Math.exp(-dt * 1.4));
        rot += vel * dt;
      }
      draw();
      running = visible && (AUTO > 0 || dragging || tween || Math.abs(vel) > 0.001);
      if (running) requestAnimationFrame(frame); else prev = 0;
    }
    const kick = () => { if (!running) { running = true; prev = 0; requestAnimationFrame(frame); } };

    // Natočí talíř i dopředu (nejkratší cestou) a chvíli počká, než se prstenec zase rozjede.
    const bringToFront = (i) => {
      const th = norm(rot + (i / N) * TAU);
      tween = { from: rot, to: rot - th, t0: performance.now(), ms: reduce ? 1 : 700 };
      holdUntil = performance.now() + 3500;
      kick();
    };

    ring.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; lastX = e.clientX; lastT = performance.now(); tween = null;
      ring.setPointerCapture(e.pointerId);
      ring.classList.add('grabbing');
      kick();
    });
    ring.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      moved += Math.abs(dx);
      const k = 1.15 / RX;
      rot += dx * k;
      const dts = Math.max(0.008, (now - lastT) / 1000);
      vel = vel * 0.55 + ((dx * k) / dts) * 0.45;
      lastX = e.clientX; lastT = now;
    });
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      ring.classList.remove('grabbing');
      vel = Math.max(-5, Math.min(5, vel));
      holdUntil = performance.now() + 1200;
    };
    ring.addEventListener('pointerup', stop);
    ring.addEventListener('pointercancel', stop);
    plates.forEach((el, i) =>
      el.addEventListener('click', (e) => {
        if (moved > 6) { e.preventDefault(); return; }
        bringToFront(i);
      }),
    );

    new ResizeObserver(resize).observe(stageEl);
    resize();
    stageEl.classList.add('ready');
    new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible) kick();
    }).observe(stageEl);
    kick();
  }
})();
