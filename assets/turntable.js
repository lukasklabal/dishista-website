/* Dishista — 3D otočný stůl (WebGL, three.js). Mramorová deska s mosaznou hranou na ořechové noze,
   porcelánové talíře se zlatým okrajem a fotkou jídla. Tažením se stůl roztočí, se setrvačností dojede
   a zastaví vždy na jedné kuchyni (talíř vpředu se zvedne a natočí k divákovi).
   Bez WebGL 2 zůstává CSS verze stolu (řídí ji site.js). */
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const stage = document.querySelector('.stage');
const dom = stage?.querySelector('.susan');
const probe = document.createElement('canvas').getContext('webgl2');
if (stage && dom && probe) init();

function init() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buttons = [...dom.querySelectorAll('.plate')];
  const label = stage.querySelector('.plate-label');
  const N = buttons.length;
  const TAU = Math.PI * 2;

  /* ── Renderer, scéna, kamera ── */
  const canvas = document.createElement('canvas');
  canvas.className = 'susan3d';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const ELEV = THREE.MathUtils.degToRad(29);

  const key = new THREE.DirectionalLight(0xfff0dc, 2.1);
  key.position.set(-2.4, 4.2, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.7, right: 1.7, top: 1.7, bottom: -1.7, near: 1, far: 12 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc89a, 0.9);
  rim.position.set(2.6, 1.6, -2.4);
  scene.add(rim);

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (url) => {
    const t = loader.load(url, () => wake());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    return t;
  };

  /* ── Materiály ── */
  const marble = new THREE.CanvasTexture(marbleCanvas());
  marble.colorSpace = THREE.SRGBColorSpace;
  marble.anisotropy = Math.min(8, maxAniso);
  const matMarble = new THREE.MeshPhysicalMaterial({ map: marble, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xc9a066, metalness: 1, roughness: 0.28 });
  const matGold = new THREE.MeshStandardMaterial({ color: 0xd8b26a, metalness: 1, roughness: 0.18 });
  const matWalnut = new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.55, metalness: 0.05 });
  const matPorcelain = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f3, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });

  /* ── Stůl ── */
  const table = new THREE.Group();
  scene.add(table);
  const spin = new THREE.Group();          // otáčí se
  table.add(spin);

  const TOP_Y = 0.04;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 160, 1), [matBrass, matMarble, matBrass]);
  top.receiveShadow = true;
  top.castShadow = true;
  spin.add(top);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.011, 16, 200), matGold);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = TOP_Y;
  spin.add(edge);
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.004, 8, 120), matGold);
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = TOP_Y + 0.001;
  spin.add(inlay);

  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.16, 96), matWalnut);
  leg.position.y = -0.12;
  leg.castShadow = true;
  table.add(leg);
  const legRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.008, 10, 120), matBrass);
  legRing.rotation.x = Math.PI / 2;
  legRing.position.y = -0.2;
  table.add(legRing);

  // Střed: mosazný podstavec s logem.
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 96), matBrass);
  hub.position.y = TOP_Y + 0.025;
  hub.castShadow = true;
  spin.add(hub);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.155, 64), new THREE.MeshBasicMaterial({ map: tex('/assets/logo.png'), toneMapped: false }));
  logo.rotation.x = -Math.PI / 2;
  logo.position.y = TOP_Y + 0.051;
  spin.add(logo);

  // Stín na „podlaze“ stránky (průhledný, jen stín).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ── Talíře ── */
  const R = 0.122, RING = 0.735;
  const plateGeo = new THREE.CylinderGeometry(R, R * 0.8, 0.02, 72);
  const wellGeo = new THREE.CircleGeometry(R * 0.74, 72);
  const rimGeo = new THREE.TorusGeometry(R * 0.985, 0.0042, 10, 96);
  const plates = buttons.map((btn, i) => {
    const holder = new THREE.Group();              // poloha na desce
    const phi = (i / N) * TAU;
    holder.position.set(Math.sin(phi) * RING, TOP_Y, Math.cos(phi) * RING);
    spin.add(holder);
    const plate = new THREE.Group();               // natáčí se k divákovi, zvedá se
    plate.rotation.order = 'YXZ';
    holder.add(plate);
    const body = new THREE.Mesh(plateGeo, matPorcelain);
    body.position.y = 0.012;
    body.castShadow = true;
    body.receiveShadow = true;
    plate.add(body);
    const goldRim = new THREE.Mesh(rimGeo, matGold.clone());
    goldRim.rotation.x = Math.PI / 2;
    goldRim.position.y = 0.022;
    plate.add(goldRim);
    const food = new THREE.Mesh(wellGeo, new THREE.MeshPhysicalMaterial({ map: tex(btn.querySelector('img').src), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 }));
    food.rotation.x = -Math.PI / 2;
    food.position.y = 0.0225;
    food.receiveShadow = true;
    plate.add(food);
    // Vlaječka jako odznak (vždy čelem ke kameře).
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(btn), depthWrite: false }));
    badge.scale.setScalar(0.085);
    badge.position.set(R * 0.78, 0.07, -R * 0.62);
    plate.add(badge);
    body.userData.index = i;
    food.userData.index = i;
    return { holder, plate, rim: goldRim, lift: 0, accent: new THREE.Color(btn.style.getPropertyValue('--accent').trim() || '#d8b26a') };
  });
  const pickables = plates.flatMap((p) => p.plate.children.filter((c) => c.userData.index !== undefined));

  /* ── Rozložení ── */
  let W = 0, H = 0, frontScreen = new THREE.Vector3();
  const layout = () => {
    const r = canvas.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    const offX = r.left - sr.left;
    const dpr = Math.min(2, devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // Vzdálenost kamery tak, aby stůl zabral ~ 88 % šířky (na mobilu víc).
    const small = W < 560;
    const want = small ? 2.32 : 2.42;
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const dist = Math.max(want / (2 * halfW), (want * 0.62) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
    camera.lookAt(0, -0.02, 0);
    // Střed stolu posuneme doleva (telefon je vpravo) — bez zkreslení perspektivy.
    const shift = small ? -0.03 : -0.02;
    camera.setViewOffset(W, H, W * shift, -H * 0.02, W, H);
    camera.updateProjectionMatrix();
    // Kde je přední okraj stolu na obrazovce (tam patří popisek).
    frontScreen.set(0, TOP_Y, 1.02).project(camera);
    if (label) {
      label.style.left = `${((frontScreen.x + 1) / 2) * W + offX}px`;
      label.style.top = `${((1 - frontScreen.y) / 2) * H + 14}px`;
    }
    wake();
  };

  /* ── Fyzika otáčení (stupně jako ve 2D verzi) ── */
  const STEP = 360 / N;
  const IDLE = reduce ? 0 : 6;
  let rot = 0, vel = IDLE, dragging = false, moved = 0, lastA = 0, lastT = 0, holdUntil = 0, snap = null;
  let front = -1, running = false, visible = true, prev = 0, settle = 0;
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const frontIndex = () => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < N; i++) {
      const d = Math.abs(wrap(i * STEP + rot));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const nearestStop = () => rot - wrap(frontIndex() * STEP + rot);
  const snapTo = (target, ms = 900) => { snap = { from: rot, to: target, t0: performance.now(), ms: reduce ? 1 : ms }; };

  const updateLabel = (i) => {
    if (!label) return;
    const b = buttons[i];
    const flag = b.querySelector('.badge')?.innerHTML ?? '';
    label.querySelector('b').innerHTML = `<span aria-hidden="true">${flag}</span> ${b.dataset.name}`;
    label.querySelector('small').textContent = b.dataset.recipes;
    label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
  };

  function frame(t) {
    const dt = Math.min(0.05, prev ? (t - prev) / 1000 : 0);
    prev = t;
    if (snap) {
      const p = Math.min(1, (t - snap.t0) / snap.ms);
      rot = snap.from + (snap.to - snap.from) * (1 - Math.pow(1 - p, 4));
      if (p >= 1) { snap = null; vel = 0; holdUntil = t + 2600; }
    } else if (!dragging) {
      if (t < holdUntil) vel = 0;
      else if (Math.abs(vel) > IDLE + 0.5) {
        vel *= Math.exp(-dt * 1.1);
        if (Math.abs(vel) < 38) snapTo(nearestStop(), 1100);
      } else vel += (IDLE - vel) * (1 - Math.exp(-dt * 0.8));
      rot += vel * dt;
    }

    const a = THREE.MathUtils.degToRad(rot);
    spin.rotation.y = a;
    const f = frontIndex();
    if (f !== front) { front = f; updateLabel(f); }
    let animating = false;
    plates.forEach((p, i) => {
      // Talíř drží fotku „rovně“ vůči divákovi; přední se zvedne a nakloní ke kameře.
      p.plate.rotation.y = -a;
      p.plate.rotation.x = p.lift * 0.34;
      const target = i === front && (snap || !dragging) && Math.abs(vel) < 60 ? 1 : 0;
      p.lift += (target - p.lift) * (1 - Math.exp(-dt * 9));
      if (Math.abs(target - p.lift) > 0.002) animating = true;
      p.plate.position.y = p.lift * 0.075;
      p.plate.scale.setScalar(1 + p.lift * 0.1);
      p.rim.material.color.copy(matGold.color).lerp(p.accent, p.lift);
      p.rim.material.emissive.copy(p.accent).multiplyScalar(p.lift * 0.35);
    });
    renderer.render(scene, camera);
    settle = animating ? 30 : Math.max(0, settle - 1);
    running = visible && (IDLE > 0 || dragging || !!snap || Math.abs(vel) > 0.01 || settle > 0);
    if (running) requestAnimationFrame(frame); else prev = 0;
  }
  function wake() { if (!running) { running = true; prev = 0; settle = 30; requestAnimationFrame(frame); } }

  /* ── Ovládání: tažení kolem středu, klepnutí na talíř ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP_Y);
  const hit = new THREE.Vector3();
  const pointer = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const angleAt = (e) => {
    pointer(e);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { a: THREE.MathUtils.radToDeg(Math.atan2(hit.x, hit.z)), r: Math.hypot(hit.x, hit.z) };
  };
  // Plátno nepřijímá kliknutí (přesahuje přes text vlevo) — stůl poznáme podle zásahu do desky.
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.hero-phone')) return;
    const p = angleAt(e);
    if (!p || p.r > 1.12) return;                    // mimo stůl — nech stránku rolovat
    dragging = true; moved = 0; snap = null; vel = 0; lastA = p.a; lastT = performance.now();
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('grabbing');
    wake();
  });
  stage.addEventListener('pointermove', (e) => {
    const p = angleAt(e);
    if (!dragging) {
      stage.style.cursor = p && p.r <= 1.05 && !e.target.closest('.hero-phone') ? 'grab' : '';
      return;
    }
    if (!p) return;
    const now = performance.now();
    const d = wrap(p.a - lastA);
    moved += Math.abs(d);
    rot += d;
    vel = vel * 0.5 + (d / Math.max(0.008, (now - lastT) / 1000)) * 0.5;
    lastA = p.a; lastT = now;
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('grabbing');
    vel = Math.max(-900, Math.min(900, vel));
    if (moved < 2) {
      // Klepnutí: talíř pod prstem dopředu.
      pointer(e);
      const hitPlate = ray.intersectObjects(pickables, false)[0];
      if (hitPlate) { snapTo(rot - wrap(hitPlate.object.userData.index * STEP + rot), 1000); return; }
    }
    if (Math.abs(vel) < 60) snapTo(nearestStop(), 600);
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  // Klávesnice / čtečky: skrytá tlačítka 2D verze vybírají talíř i ve 3D.
  buttons.forEach((b, i) => b.addEventListener('click', () => { snapTo(rot - wrap(i * STEP + rot), 1000); wake(); }));

  stage.classList.add('has-3d', 'ready');
  new ResizeObserver(layout).observe(stage);
  layout();
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) wake(); }).observe(stage);
  wake();
}

/* Mramor: teplý světlý podklad s jemnými šedobéžovými žilkami (generováno, žádný obrázek navíc). */
function marbleCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(420, 380, 60, 512, 512, 760);
  grad.addColorStop(0, '#fbf7f0');
  grad.addColorStop(0.7, '#f3eadf');
  grad.addColorStop(1, '#e9dccb');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let k = 0; k < 34; k++) {
    let x = rnd() * 1024, y = rnd() * 1024, ang = rnd() * Math.PI;
    const wide = rnd() < 0.25;
    const gold = k % 9 === 0;
    g.strokeStyle = gold ? 'rgba(196, 150, 80, 0.32)' : wide ? 'rgba(140, 118, 96, 0.16)' : 'rgba(110, 92, 78, 0.26)';
    g.lineWidth = wide ? 6 + rnd() * 8 : 0.8 + rnd() * 1.6;
    g.filter = wide ? 'blur(6px)' : 'blur(0.6px)';
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 40; s++) {
      ang += (rnd() - 0.5) * 0.55;
      x += Math.cos(ang) * 22; y += Math.sin(ang) * 22;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.filter = 'none';
  return c;
}

/* Odznak s vlajkou: bílé kolečko s emoji (nebo obrázkem znaku arabského světa). */
function badgeTexture(btn) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const paint = (img) => {
    g.clearRect(0, 0, 128, 128);
    g.shadowColor = 'rgba(60, 30, 10, 0.35)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(64, 62, 52, 0, Math.PI * 2); g.fill();
    g.shadowColor = 'transparent';
    if (img) {
      g.save(); g.beginPath(); g.arc(64, 62, 40, 0, Math.PI * 2); g.clip();
      g.drawImage(img, 24, 22, 80, 80); g.restore();
    } else {
      g.font = '60px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(btn.dataset.flag, 64, 66);
    }
    t.needsUpdate = true;
  };
  const mark = btn.querySelector('.badge img');
  if (mark) {
    const img = new Image();
    img.onload = () => paint(img);
    img.src = mark.src;
    paint(null);
  } else paint(null);
  return t;
}
