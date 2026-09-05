/**
 * The 404 scene: an archipelago with one island missing.
 *
 * KeyTopia's landing page turns a keyboard into a world. This is the same world
 * with a hole in it: keycaps scattered as islands around an empty centre, and
 * three caps reading 4, 0, 4 drifting loose in the gap where the page the
 * visitor asked for would have been. The metaphor is the site's own, which is
 * why the 404 does not look borrowed from somewhere else.
 *
 * Built from the same parts as ./landing3d: one InstancedMesh for the field, a
 * canvas-texture sprite per glyph, and the same palette. It is deliberately a
 * smaller scene. Nobody chose to come here and nobody should wait for it.
 *
 * Client-only. NotFound.tsx imports it dynamically after mount, because the
 * page itself is prerendered in Node where `window` and WebGL do not exist.
 */

import * as THREE from 'three';

/** The site's own island palette, as used by the landing scene. */
const TEAL = new THREE.Color('#14d8c4');
const VIOLET = new THREE.Color('#8b7cff');
const AMBER = new THREE.Color('#ffb454');
const DEEP = new THREE.Color('#0b1020');
const CAP_LO = new THREE.Color('#1c2547');
const CAP_HI = new THREE.Color('#2a3560');

/** Deterministic pseudo-random, so the archipelago is the same every visit. */
function hashN(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The rounded keycap, as a unit mesh lying flat. Shared by field and glyphs. */
function keycapGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const r = 0.16, s = 0.44;
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s); shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(s, s - r); shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-s + r, s); shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-s, -s + r); shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42, bevelEnabled: true, bevelThickness: 0.06,
    bevelSize: 0.05, bevelSegments: 2, curveSegments: 5,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

interface Island { x: number; z: number; y: number; phase: number; spin: number; scale: number }

const FIELD = 132;
/** Nothing is placed inside this radius. The gap is the point of the picture. */
const VOID_R = 3.4;
const FIELD_R = 13;

export class NotFoundScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private field: THREE.InstancedMesh;
  private islands: Island[] = [];
  private digits: { mesh: THREE.Mesh; sprite: THREE.Sprite; phase: number; x: number }[] = [];
  private capGeo: THREE.ExtrudeGeometry;
  private capMat: THREE.MeshStandardMaterial;
  private digitMat: THREE.MeshStandardMaterial;
  private textures: THREE.Texture[] = [];
  private dummy = new THREE.Object3D();
  private lightA: THREE.PointLight;
  private lightB: THREE.PointLight;
  private raf = 0;
  private last = 0;
  private t = 0;
  private pointer = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private disposed = false;
  /** 0 on a wide canvas, 1 on a tall one. Drives the responsive framing. */
  private narrow = 0;

  constructor(private canvas: HTMLCanvasElement, private staticMode: boolean) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90);
    this.scene.fog = new THREE.Fog(DEEP, 15, 33);

    this.capGeo = keycapGeometry();
    this.capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.22 });
    this.field = new THREE.InstancedMesh(this.capGeo, this.capMat, FIELD);
    this.field.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Islands sit on a ring, denser and lower toward the rim, so the eye is
    // pulled inward to the gap rather than out to the edge of the canvas.
    for (let i = 0; i < FIELD; i += 1) {
      const a = hashN(i) * Math.PI * 2;
      const rr = VOID_R + Math.sqrt(hashN(i + 40)) * (FIELD_R - VOID_R);
      const edge = (rr - VOID_R) / (FIELD_R - VOID_R);
      const island: Island = {
        x: Math.cos(a) * rr,
        z: Math.sin(a) * rr,
        y: -0.4 - edge * 2.6 + hashN(i + 90) * 1.1,
        phase: hashN(i + 7) * Math.PI * 2,
        spin: (hashN(i + 130) - 0.5) * 0.5,
        scale: 0.75 + hashN(i + 170) * 0.85,
      };
      this.islands.push(island);

      // Caps nearest the gap catch the light the digits give off, so the hole
      // reads as the source of the colour rather than a dark patch.
      const tint = CAP_LO.clone().lerp(CAP_HI, hashN(i + 210));
      const near = 1 - Math.min(1, edge * 1.9);
      tint.lerp(i % 7 === 0 ? AMBER : i % 3 === 0 ? VIOLET : TEAL, near * 0.34);
      this.field.setColorAt(i, tint);
    }
    if (this.field.instanceColor) this.field.instanceColor.needsUpdate = true;
    this.scene.add(this.field);

    // The three loose caps. Separate meshes rather than instances: there are
    // three of them, they carry their own glyph sprite, and they move on their
    // own timing.
    this.digitMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#233060'), roughness: 0.34, metalness: 0.3,
      emissive: TEAL.clone().multiplyScalar(0.07),
    });
    ['4', '0', '4'].forEach((ch, i) => {
      const mesh = new THREE.Mesh(this.capGeo, this.digitMat);
      const x = (i - 1) * 2.62;
      mesh.scale.setScalar(2.5);
      mesh.position.set(x, 0, 0);
      this.scene.add(mesh);

      const tex = this.glyphTexture(ch);
      this.textures.push(tex);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: false,
      }));
      sprite.scale.setScalar(1.5);
      this.scene.add(sprite);

      this.digits.push({ mesh, sprite, phase: i * 1.15, x });
    });

    this.scene.add(new THREE.AmbientLight(0xbfd0ff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.05);
    dir.position.set(4, 9, 6);
    this.scene.add(dir);
    this.lightA = new THREE.PointLight(TEAL.getHex(), 30, 20, 1.9);
    this.lightA.position.set(-3.4, 2.6, 1.6);
    this.scene.add(this.lightA);
    this.lightB = new THREE.PointLight(VIOLET.getHex(), 24, 20, 1.9);
    this.lightB.position.set(3.4, 2.2, -1.6);
    this.scene.add(this.lightB);

    this.resize();
    this.layout(0);
    this.applyCamera();

    window.addEventListener('resize', this.resize);

    if (staticMode) {
      // One frame, at rest. Everything is legible and nothing moves.
      this.renderer.render(this.scene, this.camera);
      return;
    }
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** The digit face, drawn once to a canvas and reused as a texture. */
  private glyphTexture(ch: string): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const ctx = c.getContext('2d')!;
    ctx.font = '800 108px "Manrope Variable", "Manrope", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(20,216,196,0.85)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#e6fffb';
    ctx.fillText(ch, 80, 86);
    return new THREE.CanvasTexture(c);
  }

  private onPointer = (e: PointerEvent): void => {
    this.target.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.target.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  /** Stop burning a GPU on a tab nobody is looking at. */
  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (!this.raf && !this.disposed) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || Math.round(window.innerHeight * 0.6);
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;

    // A portrait canvas is narrow, not short, so keeping the desktop framing
    // cropped the loose caps off both sides and pushed them under the button.
    // Pulling back and widening the lens fits the whole gap at any shape.
    this.narrow = Math.min(1, Math.max(0, (1.25 - aspect) / 0.75));
    this.camera.fov = 44 + this.narrow * 13;
    this.camera.updateProjectionMatrix();
    this.applyCamera();
    if (this.staticMode) this.renderer.render(this.scene, this.camera);
  };

  private applyCamera(): void {
    const n = this.narrow;
    this.camera.position.set(
      this.pointer.x * 1.5 * (1 - n * 0.6),
      6.2 + n * 2.1 + this.pointer.y * -0.8,
      12.8 + n * 5.4,
    );
    // Aimed above the scene's centre so the archipelago and the loose caps sit
    // in the lower half of the frame, leaving the top clear for the copy. On a
    // narrow canvas the copy is taller, so the aim rises with it.
    this.camera.lookAt(0, 3.1 + n * 1.5, 0);
  }

  /** Place every island and digit for time `t`. Also the single static frame. */
  private layout(t: number): void {
    for (let i = 0; i < this.islands.length; i += 1) {
      const k = this.islands[i];
      const bob = Math.sin(t * 0.5 + k.phase) * 0.24;
      this.dummy.position.set(k.x, k.y + bob, k.z);
      this.dummy.rotation.set(0, k.phase + t * 0.05 * k.spin, 0);
      this.dummy.scale.setScalar(k.scale);
      this.dummy.updateMatrix();
      this.field.setMatrixAt(i, this.dummy.matrix);
    }
    this.field.instanceMatrix.needsUpdate = true;

    for (const d of this.digits) {
      // The loose caps drift further and slower than the field, so they read as
      // detached from it rather than part of the pattern.
      const y = -0.35 + Math.sin(t * 0.62 + d.phase) * 0.4;
      d.mesh.position.set(d.x, y, 0);
      d.mesh.rotation.set(
        Math.sin(t * 0.34 + d.phase) * 0.16,
        Math.sin(t * 0.27 + d.phase) * 0.3,
        Math.cos(t * 0.31 + d.phase) * 0.11,
      );
      d.sprite.position.set(d.x, y + 0.36, 0.02);
    }

    const sway = Math.sin(t * 0.4);
    this.lightA.position.x = -3.4 + sway * 1.1;
    this.lightB.position.x = 3.4 - sway * 1.1;
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    // Clamped, so a backgrounded tab returning does not jump the animation.
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;

    this.pointer.x += (this.target.x - this.pointer.x) * 0.045;
    this.pointer.y += (this.target.y - this.pointer.y) * 0.045;

    this.layout(this.t);
    this.applyCamera();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.capGeo.dispose();
    this.capMat.dispose();
    this.digitMat.dispose();
    for (const t of this.textures) t.dispose();
    for (const d of this.digits) (d.sprite.material as THREE.SpriteMaterial).dispose();
    this.renderer.dispose();
  }
}
