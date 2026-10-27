/* Dishista — interactions: turntable, parallax, rotating headline, reveals, counters, story, chat, store dialog. */
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

  /* ── Otočný stůl s talíři kuchyní: tažením kolem středu se roztočí, se setrvačností dojede
     a zastaví se vždy přesně na jedné kuchyni (talíř vpředu se zvedne a ukáže, co dnes vaříš).
     V klidu se stůl pomalu otáčí sám. ── */
  // S WebGL 2 stůl vykreslí ve 3D turntable.js; tahle CSS verze je záloha pro starší prohlížeče.
  const susanEl = document.querySelector('.susan');
  const webgl2 = !!document.createElement('canvas').getContext('webgl2');
  if (susanEl && !webgl2) initSusan(susanEl);

  function initSusan(susan) {
    const stageEl = susan.closest('.stage');
    const spin = susan.querySelector('.susan-spin');
    const plates = [...susan.querySelectorAll('.plate')];
    const label = stageEl.querySelector('.plate-label');
    const N = plates.length;
    const STEP = 360 / N;
    const TILT = Math.cos((60 * Math.PI) / 180);
    const IDLE = reduce ? 0 : 7;                     // °/s, pomalé samovolné otáčení
    let rot = 0, vel = IDLE, dragging = false, moved = 0, lastA = 0, lastT = 0, holdUntil = 0, snap = null;
    let front = -1, running = false, visible = true, prev = 0, D = 0, cx = 0, cy = 0;

    const layout = () => {
      const r = stageEl.getBoundingClientRect();
      const small = r.width < 560;
      D = Math.min(r.width * (small ? 0.96 : 0.86), r.height * (small ? 1.05 : 1.04), 600);
      const x = r.width * (small ? 0.4 : 0.36), y = r.height * (small ? 0.5 : 0.5);
      susan.style.setProperty('--d', `${D.toFixed(0)}px`);
      susan.style.setProperty('--x', `${x.toFixed(0)}px`);
      susan.style.setProperty('--y', `${y.toFixed(0)}px`);
      cx = x; cy = y;
      if (label) { label.style.left = `${x}px`; label.style.top = `${y + D * TILT * 0.5 + D * 0.05}px`; }
    };

    // Úhel ukazatele kolem středu disku (y se přepočítá z nakloněné roviny).
    const angleAt = (e) => {
      const r = stageEl.getBoundingClientRect();
      return (Math.atan2((e.clientY - r.top - cy) / TILT, e.clientX - r.left - cx) * 180) / Math.PI;
    };
    const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
    // Který talíř je právě vpředu (u diváka = úhel 180° v rovině disku).
    const frontIndex = () => {
      let best = 0, bd = 1e9;
      for (let i = 0; i < N; i++) {
        const d = Math.abs(wrap(i * STEP + rot - 180));
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };

    function draw() {
      spin.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
      plates.forEach((el) => el.style.setProperty('--rot', `${rot.toFixed(2)}deg`));
      const f = frontIndex();
      if (f !== front) {
        if (front >= 0) plates[front].classList.remove('front');
        front = f;
        plates[f].classList.add('front');
        if (label) {
          const pl = plates[f];
          const flag = pl.querySelector('.badge')?.innerHTML ?? '';
          label.querySelector('b').innerHTML = `<span aria-hidden="true">${flag}</span> ${pl.dataset.name}`;
          label.querySelector('small').textContent = pl.dataset.recipes;
          label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
        }
      }
    }

    // Plynulé dojetí na nejbližší talíř (nebo na zvolený), jako ruleta.
    const snapTo = (target, ms = 900) => { snap = { from: rot, to: target, t0: performance.now(), ms: reduce ? 1 : ms }; };
    const nearestStop = () => {
      const i = frontIndex();
      return rot - wrap(i * STEP + rot - 180);
    };

    function frame(t) {
      const dt = Math.min(0.05, prev ? (t - prev) / 1000 : 0);
      prev = t;
      if (snap) {
        const p = Math.min(1, (t - snap.t0) / snap.ms);
        const ease = 1 - Math.pow(1 - p, 4);
        rot = snap.from + (snap.to - snap.from) * ease;
        if (p >= 1) { snap = null; vel = 0; holdUntil = t + 2600; }
      } else if (!dragging) {
        if (t < holdUntil) vel = 0;
        else if (Math.abs(vel) > IDLE + 0.5) {
          vel *= Math.exp(-dt * 1.1);              // tření po roztočení
          if (Math.abs(vel) < 38) snapTo(nearestStop() + Math.sign(vel) * 0, 1100);
        } else vel += (IDLE - vel) * (1 - Math.exp(-dt * 0.8));
        rot += vel * dt;
      }
      draw();
      running = visible && (IDLE > 0 || dragging || snap || Math.abs(vel) > 0.01);
      if (running) requestAnimationFrame(frame); else prev = 0;
    }
    const kick = () => { if (!running) { running = true; prev = 0; requestAnimationFrame(frame); } };

    susan.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; snap = null; lastA = angleAt(e); lastT = performance.now(); vel = 0;
      susan.setPointerCapture(e.pointerId);
      susan.classList.add('grabbing');
      kick();
    });
    susan.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const now = performance.now();
      const a = angleAt(e);
      const d = wrap(a - lastA);
      moved += Math.abs(d);
      rot += d;
      const dts = Math.max(0.008, (now - lastT) / 1000);
      vel = vel * 0.5 + (d / dts) * 0.5;
      lastA = a; lastT = now;
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      susan.classList.remove('grabbing');
      vel = Math.max(-900, Math.min(900, vel));
      // Pomalé puštění rovnou dojede na nejbližší talíř, rychlé se nejdřív vytočí.
      if (Math.abs(vel) < 60) snapTo(nearestStop(), 600);
    };
    susan.addEventListener('pointerup', release);
    susan.addEventListener('pointercancel', release);
    plates.forEach((el, i) =>
      el.addEventListener('click', (e) => {
        if (moved > 4) { e.preventDefault(); return; }
        snapTo(rot - wrap(i * STEP + rot - 180), 1000);
        kick();
      }),
    );

    new ResizeObserver(() => { layout(); draw(); }).observe(stageEl);
    layout();
    rot = 180 - 0 * STEP;                            // na začátku je vpředu první kuchyně
    draw();
    stageEl.classList.add('ready');
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) kick(); }).observe(stageEl);
    kick();
  }
})();
