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

  /* ── Globe (WebGL): a soft, glossy sphere with crisp land dots, same look as the app icon ── */
  const canvas = document.querySelector('canvas.globe');
  if (canvas) initGlobe(canvas, cfg.pins || []);

  function initGlobe(canvas, pins) {
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true });
    if (!gl) { canvas.remove(); return; }
    const rad = Math.PI / 180;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision highp float;
uniform vec2 uC; uniform float uR, uRotX, uRotY, uDark, uDpr; uniform sampler2D uMask;
const float D = 1.15;           // dot grid spacing in degrees (jemnější mřížka)
const float PI = 3.14159265;
vec3 srgb(vec3 c){ return c; }
void main(){
  vec2 q = (gl_FragCoord.xy - uC) / uR;
  float r = length(q);
  float px = 1.0 / uR;                                   // one pixel in sphere units
  vec3 lit = mix(vec3(1.0,.973,.937), vec3(.27,.21,.17), uDark);
  vec3 shade = mix(vec3(.93,.74,.58), vec3(.10,.075,.06), uDark);
  vec3 dotLit = mix(vec3(.93,.27,.14), vec3(1.0,.42,.24), uDark);
  vec3 dotShade = mix(vec3(.74,.17,.08), vec3(.62,.18,.08), uDark);
  vec4 outc = vec4(0.);
  // soft contact shadow + warm atmosphere outside the sphere
  float sh = length(q - vec2(.10,-.16));
  float shadow = (1. - smoothstep(.70, 1.18, sh)) * mix(.16, .45, uDark);
  float halo = (exp(-max(r - 1., 0.) * 9.) * .75 + exp(-max(r - 1., 0.) * 3.5) * .25) * mix(.42, .34, uDark) * step(1., r);
  vec3 haloCol = mix(vec3(1.,.70,.40), vec3(.93,.27,.14), uDark);
  outc = vec4(vec3(.36,.14,.04) * shadow, shadow);
  outc = vec4(haloCol * halo, halo) + outc * (1. - halo);
  if (r < 1. + px) {
    float z = sqrt(max(0., 1. - r * r));
    vec3 n = vec3(q, z);
    // view -> world (undo tilt, then spin)
    float cx = cos(uRotX), sx = sin(uRotX), cy = cos(uRotY), sy = sin(uRotY);
    float y = n.y * cx + n.z * sx;
    float z1 = -n.y * sx + n.z * cx;
    float x = n.x * cy - z1 * sy;
    float zw = n.x * sy + z1 * cy;
    float lat = asin(clamp(y, -1., 1.)) / PI * 180.;
    float lon = atan(x, zw) / PI * 180.;
    float li = floor((lat + 90.) / D);
    float latC = (li + .5) * D - 90.;
    float cnt = max(1., floor(360. * cos(latC * PI / 180.) / D));
    float lj = floor((lon + 180.) / 360. * cnt);
    float lonC = (lj + .5) * 360. / cnt - 180.;
    float dlon = lon - lonC;
    vec2 dd = vec2(dlon * cos(lat * PI / 180.), lat - latC);
    float dist = length(dd);
    float land = step(.5, texture2D(uMask, vec2((lonC + 180.) / 360., (90. - latC) / 180.)).r);
    float degPx = (180. / PI) * px / max(z, .12);          // pixel footprint in degrees (foreshortened)
    float dotR = D * .36;
    float dotShape = 1. - smoothstep(dotR - degPx * .9, dotR + degPx * .9, dist);
    float dotA = land * dotShape;
    // jemná tečková textura i na moři, ať koule není plochá
    float seaA = (1. - land) * (1. - smoothstep(D * .16 - degPx * .9, D * .16 + degPx * .9, dist)) * .22;
    dotA *= smoothstep(.0, .18, z);                          // fade towards the limb
    vec3 L = normalize(vec3(-.62, .7, .5));
    float dif = clamp(dot(n, L), 0., 1.);
    float lightT = smoothstep(-.25, .95, dif);
    vec3 col = mix(shade, lit, lightT);
    col = mix(col, mix(shade * .86, lit * .9, lightT), seaA * smoothstep(.0, .25, z));
    col = mix(col, mix(dotShade, dotLit, lightT), dotA);
    // jemný vnitřní stín u okraje (objem)
    col *= mix(1., .9, pow(1. - z, 3.));
    float fres = pow(1. - z, 2.6);
    col += mix(vec3(1.,.82,.62), vec3(1.,.45,.25), uDark) * fres * .35;
    float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 48.);
    float sheen = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 6.);
    col += vec3(1.) * spec * mix(.42, .16, uDark) + vec3(1., .9, .8) * sheen * mix(.08, .04, uDark);
    float a = clamp((1. - r) / px + .5, 0., 1.);             // 1px anti-aliased edge
    outc = vec4(col * a, a) + outc * (1. - a);
  }
  gl_FragColor = outc;
}`;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const uC = U('uC'), uR = U('uR'), uRotX = U('uRotX'), uRotY = U('uRotY'), uDark = U('uDark'), uDpr = U('uDpr');

    // Land mask texture (Natural Earth 1:50m)
    const tex = gl.createTexture();
    let ready = false;
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      ready = true;
      canvas.classList.add('ready');
      frame(performance.now());
    };
    img.src = '/assets/land-mask.png';

    // Flag pins are real DOM elements: crisp emoji, soft shadows, no canvas text.
    const layer = document.createElement('div');
    layer.className = 'globe-pins';
    layer.setAttribute('aria-hidden', 'true');
    canvas.after(layer);
    const pinEls = pins.map((p) => {
      const el = document.createElement('span');
      el.className = 'gpin';
      el.innerHTML = `<img src="${p.img}" alt="" width="26" height="26" />`;
      layer.appendChild(el);
      const la = p.lat * rad, lo = p.lng * rad;
      return { el, v: [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)] };
    });

    const PAD = 60;
    let w = 0, h = 0, dpr = 1, R = 0, X = 0, Y = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const small = w < 560;
      // Canvas přesahuje scénu o PAD px, aby se měkká atmosféra kolem koule neořízla.
      const sw = w - 2 * PAD, sh = h - 2 * PAD;
      R = small ? Math.min(sw * 0.42, sh * 0.44) : Math.min(sw * 0.4, sh * 0.42);
      X = PAD + sw * (small ? 0.4 : 0.37); Y = PAD + sh * 0.47;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (ready && !running) frame(performance.now());
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : darkMQ.matches; };

    // Rotation state: smooth auto-spin, drag with inertia that eases back to the auto speed.
    const AUTO = reduce ? 0 : 0.16;          // rad / s
    let rotY = -15 * rad, rotX = 22 * rad, vel = AUTO, dragging = false, lastX = 0, lastY = 0, lastT = 0, visible = true, running = false, prev = 0;

    function project(v) {
      const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
      const x1 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy;
      const y2 = v[1] * cx - z1 * sx, z2 = v[1] * sx + z1 * cx;
      return [X + x1 * R, Y - y2 * R, z2];
    }

    function frame(t) {
      const dt = Math.min(0.05, prev ? (t - prev) / 1000 : 0);
      prev = t;
      if (!dragging) {
        vel += (AUTO - vel) * (1 - Math.exp(-dt * 1.6));
        rotY += vel * dt;
      }
      gl.uniform2f(uC, X * dpr, (h - Y) * dpr);
      gl.uniform1f(uR, R * dpr);
      gl.uniform1f(uRotX, rotX);
      gl.uniform1f(uRotY, rotY);
      gl.uniform1f(uDark, isDark() ? 1 : 0);
      gl.uniform1f(uDpr, dpr);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      for (const p of pinEls) {
        const [x, y, z] = project(p.v);
        const o = Math.max(0, Math.min(1, (z - 0.12) * 5));
        p.el.style.opacity = o.toFixed(3);
        p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, calc(-100% - 6px)) scale(${(0.72 + 0.28 * z).toFixed(3)})`;
        p.el.style.zIndex = String(Math.round(z * 100));
      }
      running = visible && (AUTO > 0 || dragging || Math.abs(vel) > 0.001);
      if (running) requestAnimationFrame(frame); else prev = 0;
    }

    new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible && ready && !running) { prev = 0; requestAnimationFrame(frame); }
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => { prev = 0; });

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      canvas.setPointerCapture(e.pointerId);
      if (!running) { prev = 0; requestAnimationFrame(frame); }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      const k = 1 / R;                       // drag follows the finger on the sphere surface
      rotY += dx * k;
      rotX = Math.max(-1.0, Math.min(1.0, rotX + dy * k));
      const dts = Math.max(0.008, (now - lastT) / 1000);
      vel = vel * 0.6 + (dx * k / dts) * 0.4;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    });
    const stop = () => { dragging = false; vel = Math.max(-6, Math.min(6, vel)); };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }
})();
