import * as THREE from 'three';

/**
 * The sky for Wordflight, drawn 3D.
 *
 * Same split as the Block Stack tower: the scene owns geometry and motion, the
 * game owns the rules. The scene is handed one frame of truth per tick — where
 * the bird is, how high the sea has come, which buoys exist — and draws it. It
 * does not know what a word is, why the bird flapped, or what drowned it. That
 * arithmetic lives in WordflightGame.tsx.
 *
 * The one structural difference from the tower: here the scene drives the
 * clock. Flappy physics integrated at an interval's 30Hz and rendered at 60
 * judders, so instead the component hands over a `tick(dt)` callback and the
 * scene calls it once per rendered frame. One clock, one integration, no
 * interpolation layer pretending there are two.
 *
 * There is exactly one thing in this world that can hurt you and it is the
 * bottom of it. An earlier version flew through Flappy pillars, and threading a
 * gap turned out to be a precision game about position when the game is
 * supposed to be about not stopping. The sea says the same thing with no
 * dexterity attached: keep typing and you stay up.
 */

/** What the game tells the sky, once per frame. */
export interface FlightFrame {
  /** 0 is the sea floor line, 1 the ceiling. */
  alt: number;
  /** Vertical speed in alt units/s. Only read for the bird's pitch. */
  vy: number;
  /** How far the run has scrolled, in game distance units. */
  dist: number;
  /** 0..1, shakes the bird. */
  turb: number;
  /** Counts up, one per wing-beat. The scene flaps when it changes. */
  flapN: number;
  /** Where the waterline has climbed to, in alt units. */
  seaAlt: number;
  launched: boolean;
  dead: boolean;
  /** Distance markers bobbing on the water. */
  buoys: { id: number; at: number; passed: boolean }[];
}

export interface FlightScene {
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface FlightSceneOpts {
  /** Base hue in degrees, read from the theme so the sky belongs to the app. */
  hue: number;
  light: boolean;
  /** Reduced motion: no bob, no jitter, no death spin. Flight itself stays. */
  calm: boolean;
  kid: boolean;
  tick: (dt: number) => FlightFrame;
}

/** Game distance units per world unit. Buoy spacing and speed are tuned in
 *  game units, so this is the only number that couples the two spaces. */
const DIV = 56;
/** The bird flies between these world heights. */
const ALT_LO = -3.1;
const ALT_SPAN = 6.2;

const altY = (alt: number): number => ALT_LO + alt * ALT_SPAN;

export function createFlightScene(canvas: HTMLCanvasElement, opts: FlightSceneOpts): FlightScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

  const scene = new THREE.Scene();
  // Perspective, unlike the tower's orthographic: nothing here is measured by
  // eye against anything else, and the sea running away to a horizon with a
  // little parallax is what makes a flat panel read as air.
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90);
  camera.position.set(0.3, 0.2, 10.4);
  camera.lookAt(0.3, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, opts.light ? 0.85 : 0.62));
  const key = new THREE.DirectionalLight(0xffffff, opts.light ? 0.9 : 1.1);
  key.position.set(5, 10, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-6, 3, -4);
  scene.add(fill);

  const materials: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];

  function mat(h: number, s: number, l: number): THREE.MeshLambertMaterial {
    const m = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l) });
    materials.push(m);
    return m;
  }
  function geo<T extends THREE.BufferGeometry>(g: T): T {
    geos.push(g);
    return g;
  }

  // ---------- the bird ----------
  // A hen's-egg of a bird: round body, stub wings hinged at the shoulder, cone
  // beak, cone tail. It faces +x, the way the world scrolls past it.
  const bird = new THREE.Group();
  scene.add(bird);

  const bodyHue = opts.hue;
  const sphere = geo(new THREE.SphereGeometry(1, 20, 14));
  const body = new THREE.Mesh(sphere, mat(bodyHue, opts.kid ? 0.72 : 0.55, opts.light ? 0.5 : 0.6));
  body.scale.set(0.5, 0.4, 0.38);
  bird.add(body);

  const belly = new THREE.Mesh(sphere, mat(bodyHue, 0.3, opts.light ? 0.8 : 0.86));
  belly.scale.set(0.36, 0.28, 0.3);
  belly.position.set(0.1, -0.13, 0);
  bird.add(belly);

  const cone = geo(new THREE.ConeGeometry(1, 1, 10));
  const beak = new THREE.Mesh(cone, mat(34, 0.9, 0.55));
  beak.scale.set(0.11, 0.26, 0.11);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.55, 0.02, 0);
  bird.add(beak);

  const tail = new THREE.Mesh(cone, mat(bodyHue + 24, 0.5, opts.light ? 0.42 : 0.5));
  tail.scale.set(0.14, 0.34, 0.14);
  tail.rotation.z = Math.PI / 2 - 0.35;
  tail.position.set(-0.52, 0.1, 0);
  bird.add(tail);

  const eyeWhite = mat(0, 0, 0.97);
  const eyeDark = mat(0, 0, 0.08);
  for (const side of [1, -1]) {
    const w = new THREE.Mesh(sphere, eyeWhite);
    w.scale.setScalar(0.1);
    w.position.set(0.3, 0.14, 0.24 * side);
    bird.add(w);
    const p = new THREE.Mesh(sphere, eyeDark);
    p.scale.setScalar(0.05);
    p.position.set(0.37, 0.15, 0.26 * side);
    bird.add(p);
  }

  // Wings pivot at the shoulder, not the wing centre, or the flap reads as the
  // wing sliding through the body rather than beating.
  const wingGeo = geo(new THREE.BoxGeometry(0.5, 0.07, 0.72));
  const wingMat = mat(bodyHue + 16, opts.kid ? 0.66 : 0.5, opts.light ? 0.42 : 0.52);
  const wings: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.05, 0.12, 0.3 * side);
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.position.z = 0.36 * side;
    pivot.add(w);
    bird.add(pivot);
    wings.push(pivot);
  }

  // ---------- the sea ----------
  // The only hazard in the world, so it has to look like one: a real surface
  // with moving swell rather than a flat band, because the player needs to
  // read at a glance how much air is left under the bird.
  const SEA_W = 90;
  /**
   * Deliberately shallow. A horizontal plane seen from a level camera recedes
   * to a horizon at eye height, so a deep sea climbs most of the panel and the
   * bird looks like it is skimming the water while it still has half the sky
   * left. Ten units deep keeps the water a strip along the bottom, with its
   * far edge just above the line that actually drowns you.
   */
  const SEA_D = 10;
  const seaGeo = geo(new THREE.PlaneGeometry(SEA_W, SEA_D, 48, 10));
  // Water is blue, not themed. Every other colour here is a relative of the
  // app's accent, but the sea derived from a teal accent came out maroon, and
  // a player reads "that is the sea" from the colour before anything else.
  const seaMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color().setHSL(204 / 360, opts.light ? 0.62 : 0.6, opts.light ? 0.5 : 0.32),
    shininess: 70,
    specular: new THREE.Color(0xffffff),
  });
  materials.push(seaMat);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, altY(0), -1);
  scene.add(sea);
  const seaBase = (seaGeo.attributes.position.array as Float32Array).slice();

  // A bright lip at the bird's own depth. The water is a receding surface, so
  // "the top of the blue" is the far horizon rather than the height that kills
  // you; this bar sits at z = 0, where the bird flies, and is therefore the
  // actual line. Without it the one thing on screen the player must judge is
  // the one thing they cannot locate.
  const crestMat = mat(192, 0.55, opts.light ? 0.9 : 0.76);
  crestMat.transparent = true;
  crestMat.opacity = 0.8;
  const crest = new THREE.Mesh(geo(new THREE.BoxGeometry(SEA_W, 0.07, 0.36)), crestMat);
  scene.add(crest);

  // ---------- buoys ----------
  // Distance markers, not obstacles: they cannot be hit and they cost nothing
  // to miss. They are there so a long flight over open water has a countable
  // rhythm to it instead of being one undifferentiated stretch of blue.
  const buoyBody = geo(new THREE.SphereGeometry(0.3, 12, 9));
  const buoyPole = geo(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 6));
  const buoyMat = mat(8, 0.72, 0.55);
  const buoyPassedMat = mat(45, 0.85, 0.6);
  const poleMat = mat(0, 0, opts.light ? 0.35 : 0.85);

  interface BuoyMeshes { group: THREE.Group; ball: THREE.Mesh; passed: boolean }
  const buoyMap = new Map<number, BuoyMeshes>();

  function buildBuoy(): BuoyMeshes {
    const group = new THREE.Group();
    const ball = new THREE.Mesh(buoyBody, buoyMat);
    ball.scale.y = 0.8;
    group.add(ball);
    const pole = new THREE.Mesh(buoyPole, poleMat);
    pole.position.y = 0.5;
    group.add(pole);
    const flag = new THREE.Mesh(geo(new THREE.BoxGeometry(0.3, 0.18, 0.04)), buoyMat);
    flag.position.set(0.16, 0.82, 0);
    group.add(flag);
    scene.add(group);
    return { group, ball, passed: false };
  }

  // ---------- backdrop ----------
  // Clouds and islands are placed from a hash of their index and wrapped on
  // distance, not stateful: scrolling is a pure function of `dist`, so a
  // paused tab resumes with the sky exactly where it was.
  const cloudMat = mat(0, 0, opts.light ? 0.99 : 0.75);
  cloudMat.transparent = true;
  cloudMat.opacity = opts.light ? 0.9 : 0.32;
  const clouds: { m: THREE.Group; y: number; z: number; par: number; seed: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(sphere, cloudMat);
      const s = 0.5 - p * 0.12;
      puff.scale.set(s * 1.5, s * 0.8, s);
      puff.position.x = (p - 1) * 0.55;
      g.add(puff);
    }
    clouds.push({ m: g, y: 0.4 + ((i * 2.31) % 2.8), z: -2.5 - (i % 3) * 1.4, par: 0.3 + (i % 3) * 0.14, seed: i * 5.13 });
    scene.add(g);
  }

  const islandMat = mat(138, 0.3, opts.light ? 0.46 : 0.24);
  const islands: { m: THREE.Mesh; seed: number; s: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(sphere, islandMat);
    const s = 0.9 + ((i * 1.7) % 1.2);
    m.scale.set(s * 1.9, s * 0.7, s);
    islands.push({ m, seed: i * 9.4, s });
    scene.add(m);
  }

  // The splash: droplets thrown up where the bird goes in. It exists so
  // drowning has a moment to it rather than the bird simply being gone by the
  // time the result screen arrives.
  //
  // This was a flat expanding ring first. The camera looks along the water
  // almost edge-on, so a ring lying on the surface is seen as a hairline and
  // the whole beat was invisible. Droplets have height, which is the one axis
  // this camera can actually see.
  const splashMat = mat(196, 0.5, 0.9);
  splashMat.transparent = true;
  const dropGeo = geo(new THREE.SphereGeometry(0.11, 8, 6));
  const drops: { m: THREE.Mesh; vx: number; vy: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(dropGeo, splashMat);
    m.visible = false;
    scene.add(m);
    // Fanned out and up, biggest throw in the middle of the fan.
    const a = -0.9 + (i / 8) * 1.8;
    drops.push({ m, vx: Math.sin(a) * 2.6, vy: 2.5 + Math.cos(a) * 1.6 });
  }

  // ---------- frame loop ----------
  let birdX = -2.1;
  let visW = 8;
  let wingT = 0;
  let lastFlap = 0;
  let deadSpin = 0;
  let splashT = -1;
  let t = 0;
  let raf = 0;
  let last = 0;
  let running = false;
  let disposed = false;

  const wrap = (v: number, span: number): number => ((v % span) + span) % span;

  function swell(now: number, scroll: number): void {
    const pos = seaGeo.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = seaBase[i];
      const y = seaBase[i + 1];
      // Rolling in the direction of travel, so the water reads as being flown
      // over rather than as a texture sitting still under a moving bird.
      // Purely decorative: the game drowns you at the flat waterline, so a
      // swell can never reach up and take a bird that looked safe.
      arr[i + 2] = seaBase[i + 2]
        + Math.sin((x + scroll * 0.9) * 0.55 + now * 1.6) * 0.08
        + Math.sin((x + scroll * 0.6) * 0.23 - y * 0.4 + now * 0.9) * 0.11;
    }
    pos.needsUpdate = true;
    seaGeo.computeVertexNormals();
  }

  function frame(now: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    t += dt;

    const f = opts.tick(dt);
    const scroll = f.dist / DIV;

    // Wing-beat: the pulse comes from the frame's counter so a beat is never
    // missed or doubled across a pause.
    if (f.flapN !== lastFlap) { lastFlap = f.flapN; wingT = 1; }
    wingT = Math.max(0, wingT - dt * 5);
    const idleFlap = f.launched ? 0 : Math.sin(t * 4) * 0.25 + 0.25;
    const beat = Math.sin(wingT * Math.PI) * 1.1 + idleFlap;
    wings[0].rotation.x = -beat;
    wings[1].rotation.x = beat;

    const bobY = !f.launched && !opts.calm ? Math.sin(t * 2.2) * 0.12 : 0;
    const jit = f.turb > 0.25 && !opts.calm ? f.turb : 0;
    const birdY = altY(f.alt);
    bird.position.set(
      birdX + (jit ? Math.sin(t * 43) * 0.05 * jit : 0),
      birdY + bobY + (jit ? Math.sin(t * 51) * 0.07 * jit : 0),
      0,
    );
    if (f.dead) {
      // The death is a tumble into the water, not a disappearance: the bird
      // you were is the thing that goes in, and it goes in where you can see.
      deadSpin += dt * (opts.calm ? 0 : 8);
      bird.rotation.z = -0.6 - deadSpin;
    } else {
      deadSpin = 0;
      bird.rotation.z = Math.max(-0.7, Math.min(0.45, f.vy * 1.1));
    }

    const seaY = altY(f.seaAlt);
    sea.position.y = seaY;
    crest.position.set(birdX, seaY + 0.04, 0);
    swell(t, scroll);

    // The splash fires once, when the bird actually reaches the water, rather
    // than when the game declared it dead: the two are a beat apart and the
    // ring belongs to the impact.
    if (f.dead && splashT < 0 && birdY <= seaY + 0.15) {
      splashT = 0;
      for (const d of drops) {
        d.m.position.set(bird.position.x, seaY + 0.08, 0.15);
        d.m.visible = true;
      }
    }
    if (splashT >= 0) {
      splashT += dt;
      for (const d of drops) {
        d.m.position.x += d.vx * dt;
        d.m.position.y += (d.vy - 6 * splashT) * dt;
        d.m.scale.setScalar(Math.max(0.2, 1 - splashT));
      }
      splashMat.opacity = Math.max(0, 1 - splashT / 0.8);
      if (splashT > 0.8) {
        for (const d of drops) d.m.visible = false;
        splashT = -1;
      }
    }

    // Buoys: create what the game invented, bob what exists, gild what was
    // passed, drop what scrolled away.
    const seen = new Set<number>();
    for (const b of f.buoys) {
      seen.add(b.id);
      let bm = buoyMap.get(b.id);
      if (!bm) { bm = buildBuoy(); buoyMap.set(b.id, bm); }
      const x = birdX + (b.at - f.dist) / DIV;
      bm.group.position.set(x, seaY + 0.18 + Math.sin(t * 2 + b.id) * 0.1, 0.4);
      bm.group.rotation.z = Math.sin(t * 1.6 + b.id) * 0.12;
      if (b.passed !== bm.passed) {
        bm.passed = b.passed;
        bm.ball.material = b.passed ? buoyPassedMat : buoyMat;
      }
    }
    for (const [id, bm] of buoyMap) {
      if (!seen.has(id)) { scene.remove(bm.group); buoyMap.delete(id); }
    }

    for (const c of clouds) {
      const span = visW + 4;
      c.m.position.set(wrap(c.seed - scroll * c.par, span) - span / 2 + birdX, c.y + 1.2, c.z);
    }
    for (const is of islands) {
      const span = visW + 10;
      // Just beyond the far edge of the water, so they sit on the horizon
      // rather than floating in front of it.
      is.m.position.set(wrap(is.seed - scroll * 0.4, span) - span / 2 + birdX, seaY - is.s * 0.3, -7.5);
    }

    renderer.render(scene, camera);
  }

  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    // The bird holds the left third of whatever shape the panel is, so the
    // player always sees more of what is coming than of where they have been.
    visW = 2 * 10.4 * Math.tan((44 * Math.PI) / 360) * camera.aspect;
    birdX = Math.max(-2.6, Math.min(-1.1, -visW * 0.31)) + 0.3;
    if (!running && !disposed) renderer.render(scene, camera);
  };

  resize();
  window.addEventListener('resize', resize);
  renderer.render(scene, camera);

  return {
    start(): void {
      if (running || disposed) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose(): void {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      for (const g of geos) g.dispose();
      seaGeo.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
    },
  };
}
