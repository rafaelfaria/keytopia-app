import * as THREE from 'three';

/**
 * The tower for Block Stack, drawn isometric.
 *
 * The scene owns geometry and motion. It is told the width of each new storey
 * and how strained the tower is; it does not know what a word is or why a
 * storey came out narrow. The rules live in StackGame.tsx, and keeping the
 * arithmetic there is what stops the renderer from becoming the game.
 *
 * A storey's width is the whole story of a run: the tower is a learner's speed
 * curve stood on end, so it has to be readable as a silhouette from across a
 * room. That is why storeys are centred and square rather than offset, and why
 * the lean is exaggerated: those are the two things a player reads.
 */

/** World units. A storey of width 1 is BASE across, and every storey is H tall. */
const BASE = 2.5;
const H = 0.52;

export interface StackScene {
  start(): void;
  stop(): void;
  /**
   * Add a storey. `width` is in pace units, where 1 is the learner's own
   * baseline speed, so a run at a steady pace is a straight column.
   */
  place(width: number, cracked: boolean): void;
  /** 0..1. The tower leans and sways as it approaches failure. */
  setStrain(v: number): void;
  /** Shear above this storey. Everything higher tumbles off. */
  shear(fromIndex: number): void;
  /** Storeys standing, not counting the foundation. */
  height(): number;
  reset(): void;
  dispose(): void;
}

export interface StackSceneOpts {
  /** Base hue in degrees. Storeys sweep around it as the tower climbs. */
  hue: number;
  /** Light themes need darker, more saturated blocks to read against a pale field. */
  light: boolean;
  /** Reduced motion: no sway, no tumbling, the tower simply is what it is. */
  calm: boolean;
}

interface Falling {
  mesh: THREE.Mesh;
  vx: number; vy: number; vz: number;
  rx: number; rz: number;
}

export function createStackScene(canvas: HTMLCanvasElement, opts: StackSceneOpts): StackScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

  const scene = new THREE.Scene();
  // Orthographic, because an isometric tower should not get a perspective
  // taper: each storey has to be measurable against the one under it by eye,
  // and a perspective camera would make height look like width.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -60, 120);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.MeshLambertMaterial[] = [];

  scene.add(new THREE.AmbientLight(0xffffff, opts.light ? 0.82 : 0.6));
  const key = new THREE.DirectionalLight(0xffffff, opts.light ? 0.85 : 1.05);
  key.position.set(6, 12, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.32);
  fill.position.set(-7, 4, -3);
  scene.add(fill);

  // The tower is a group so the whole thing can lean from its foot. Rotating
  // each storey separately would bend it; a building tips.
  const tower = new THREE.Group();
  scene.add(tower);

  let meshes: THREE.Mesh[] = [];
  let falling: Falling[] = [];
  let strain = 0;
  let lean = 0;
  let t = 0;

  let camY = 0;
  let raf = 0;
  let last = 0;
  let running = false;
  let disposed = false;

  function colourFor(level: number, cracked: boolean): THREE.MeshLambertMaterial {
    // The hue breathes around the theme's accent rather than walking away from
    // it, so every storey stays a relative of the last one and of the app.
    const hue = (opts.hue + 52 * Math.sin(level * 0.34) + 360) % 360;
    const col = new THREE.Color();
    col.setHSL(
      hue / 360,
      cracked ? 0.16 : opts.light ? 0.64 : 0.58,
      cracked ? (opts.light ? 0.62 : 0.36) : opts.light ? 0.58 : 0.62 + (level % 2) * 0.035,
    );
    const mat = new THREE.MeshLambertMaterial({ color: col });
    materials.push(mat);
    return mat;
  }

  function addMesh(level: number, y: number, w: number, cracked: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, colourFor(level, cracked));
    mesh.scale.set(w, H, w);
    mesh.position.set(0, y, 0);
    tower.add(mesh);
    return mesh;
  }

  function buildFoundation(): void {
    // A plinth, not a slab: the tower needs something to stand on while the
    // camera is still low, and a foundation you can see is the promise that
    // this is a building rather than a pile.
    const mesh = new THREE.Mesh(geo, colourFor(0, false));
    mesh.scale.set(BASE * 1.35, H * 3, BASE * 1.35);
    mesh.position.set(0, -H * 1.5, 0);
    tower.add(mesh);
    meshes = [mesh];
  }

  function place(width: number, cracked: boolean): void {
    if (disposed) return;
    const level = meshes.length;
    addMeshAt(level, width, cracked);
  }

  function addMeshAt(level: number, width: number, cracked: boolean): void {
    const y = (level - 1) * H + H / 2;
    meshes.push(addMesh(level, y, Math.max(0.2, width) * BASE, cracked));
  }

  function shear(fromIndex: number): void {
    // Everything above the failed joint leaves the building. The stump keeps
    // its own history, so a run after a collapse is still the same run.
    const keep = Math.max(1, fromIndex + 1);
    const lost = meshes.slice(keep);
    meshes = meshes.slice(0, keep);
    lost.forEach((mesh, i) => {
      tower.remove(mesh);
      // Re-parented to the scene so the tower's lean stops applying to debris.
      mesh.position.y += 0;
      scene.add(mesh);
      const away = i % 2 ? 1 : -1;
      falling.push({
        mesh,
        vx: away * (1.4 + Math.random() * 1.9),
        vy: 1.4 + Math.random() * 1.6,
        vz: (Math.random() - 0.5) * 2.4,
        rx: opts.calm ? 0 : (Math.random() - 0.5) * 6,
        rz: opts.calm ? 0 : (Math.random() - 0.5) * 6,
      });
    });
  }

  function reset(): void {
    for (const m of meshes) tower.remove(m);
    for (const f of falling) scene.remove(f.mesh);
    for (const m of materials) m.dispose();
    materials.length = 0;
    falling = [];
    strain = 0; lean = 0;
    tower.rotation.set(0, 0, 0);
    buildFoundation();
    camY = 0;
    applyCamera();
    if (!running && !disposed) renderer.render(scene, camera);
  }

  function applyCamera(): void {
    camera.position.set(9, 8.4 + camY, 9);
    camera.lookAt(0, camY, 0);
    camera.updateProjectionMatrix();
  }

  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const aspect = w / h;
    // Framed on both axes. The panel beside the word is taller than it is
    // wide, and sizing on height alone cropped the widest storeys.
    const view = Math.max(9.4, 10.6 / aspect);
    camera.left = (-view * aspect) / 2;
    camera.right = (view * aspect) / 2;
    camera.top = view / 2;
    camera.bottom = -view / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (!running && !disposed) renderer.render(scene, camera);
  };

  function frame(now: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    t += dt;

    // The lean is the warning. It trails the strain so the tower looks like it
    // is settling under load rather than snapping to a number, and it sways
    // once it is genuinely in trouble.
    const target = strain * 0.13;
    lean += (target - lean) * Math.min(1, dt * 4);
    const sway = opts.calm ? 0 : Math.sin(t * 5.5) * 0.012 * Math.max(0, strain - 0.45);
    tower.rotation.z = lean + sway;

    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy -= 13 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.rotation.x += f.rx * dt;
      f.mesh.rotation.z += f.rz * dt;
      if (f.mesh.position.y < camY - 9) {
        scene.remove(f.mesh);
        falling.splice(i, 1);
      }
    }

    // The camera trails the top storey rather than snapping to it, so a run
    // reads as a climb, and a collapse reads as falling back down.
    const focusY = (meshes.length - 1) * H - 1.6;
    camY += (focusY - camY) * (opts.calm ? 1 : Math.min(1, dt * 3));
    applyCamera();

    renderer.render(scene, camera);
  }

  buildFoundation();
  resize();
  window.addEventListener('resize', resize);
  applyCamera();
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
    place,
    setStrain(v: number): void { strain = Math.max(0, Math.min(1, v)); },
    shear,
    height: () => meshes.length - 1,
    reset,
    dispose(): void {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      geo.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
    },
  };
}
