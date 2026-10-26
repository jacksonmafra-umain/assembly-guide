import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { creaseLines } from './lines';
import { THEMES, accentHex, load, store, type ThemeName } from './themes';

// The iso-glow 3D shell (vendor/iso-glow/gallery-3d.html) as a reusable stage: hairline drawing in three line
// tiers, dark/light themes, one accent colour on what is live, true isometric view and revolve.

/** 100 mm = 1 three.js unit, as iso-glow's W(). */
export const MM = 0.01;

export type Stage = {
  scene: THREE.Scene;
  /** Product frame (mm, z up, +y towards the viewer). Add product geometry here. */
  root: THREE.Group;
  addMesh(m: THREE.Mesh, parent?: THREE.Object3D): void;
  finalizeLines(): void;
  setLive(obj: THREE.Object3D, on: boolean): void;
  frame(box: THREE.Box3, animate?: boolean): void;
  setIsoView(on: boolean): void;
  setRevolve(on: boolean): void;
  setTheme(t: ThemeName): void;
  setAccent(name: string): void;
  readonly theme: ThemeName;
  readonly accent: string;
  readonly isoView: boolean;
  readonly revolve: boolean;
  onTick(fn: (now: number, dt: number) => void): () => void;
  onThemeChange(fn: () => void): () => void;
  dispose(): void;
};

const NOISE = 'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }';
const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();
const MINOR_ANGLE = 30, MAJOR_ANGLE = 60, MIN_LINE_MM = 20;

export function createStage(host: HTMLElement): Stage {
  const size = () => ({ w: Math.max(1, host.clientWidth), h: Math.max(1, host.clientHeight) });
  let { w, h } = size();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.domElement.classList.add('stage-canvas');
  host.prepend(renderer.domElement);
  const devRes = () => renderer.getDrawingBufferSize(new THREE.Vector2());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEMES.dark.bg);
  const persp = new THREE.PerspectiveCamera(28, w / h, 0.1, 400);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  let orthoH = 10;
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = persp;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 1; controls.maxDistance = 200;

  const hemi = new THREE.HemisphereLight(0xdde4ff, 0x080808, 0.7); scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(6, 14, 10); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8899bb, 0.2); fill.position.set(-10, 4, -8); scene.add(fill);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType }));
  const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; ${NOISE}
      void main() { vec4 c = texture2D(tDiffuse, vUv); c.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0; gl_FragColor = c; }`,
  }));
  composer.setSize(w, h);

  // ── materials ──
  const accent = new THREE.Color(accentHex('ember'));
  const LINE_COL = new THREE.Color(THEMES.dark.line), MAJOR_COL = new THREE.Color(THEMES.dark.major);
  const EDGE_COL = new THREE.Color(THEMES.dark.edge), BG_COL = new THREE.Color(THEMES.dark.bg);
  const surface = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } as const;
  const bodyMat = new THREE.MeshStandardMaterial({ color: THEMES.dark.body, roughness: 0.9, metalness: 0.05, ...surface });
  const liveMat = new THREE.MeshStandardMaterial({ color: THEMES.dark.body, roughness: 0.6, emissive: accent.clone(), emissiveIntensity: 0.9, ...surface });
  const lineOpts = { linewidth: 1, resolution: devRes(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 };
  const lineMat = new LineMaterial({ color: EDGE_COL.getHex(), ...lineOpts });
  const majorMat = new LineMaterial({ color: MAJOR_COL.getHex(), ...lineOpts });
  const liveLineMat = new LineMaterial({ color: accent.getHex(), ...lineOpts });
  const outlineMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: LINE_COL.clone() }, thickness: { value: 1 }, res: { value: devRes() } },
    vertexShader: `uniform float thickness; uniform vec2 res;
      void main() {
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 n = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
        vec2 d = length(n.xy) > 1e-5 ? normalize(n.xy) : vec2(0.0);
        p.xy += d * thickness * 2.0 / res * p.w;
        gl_Position = p;
      }`,
    fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
    side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 24,
  });
  const shadowMat = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: THEMES.dark.shadow } },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float opacity; varying vec2 vUv; ${NOISE}
      void main() { float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a *= a;
        a = a * opacity + (hash(gl_FragCoord.xy) - 0.5) / 255.0; gl_FragColor = vec4(0.0, 0.0, 0.0, max(a, 0.0)); }`,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.visible = false; scene.add(shadow);

  // ── product frame: (x, y, z) mm, z up, +y towards the viewer → three (x, z, y) ──
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  root.matrix.set(MM, 0, 0, 0, 0, 0, MM, 0, 0, MM, 0, 0, 0, 0, 0, 1);
  root.matrixWorldNeedsUpdate = true;
  scene.add(root);

  const meshes: THREE.Mesh[] = [];
  let lined = 0;
  const lines = new Map<THREE.Mesh, LineSegments2[]>();
  const fat = (arr: number[], mat: LineMaterial) => new LineSegments2(new LineSegmentsGeometry().setPositions(arr), mat);

  function addMesh(m: THREE.Mesh, parent: THREE.Object3D = root) {
    m.material = bodyMat;
    const o = new THREE.Mesh(m.geometry, outlineMat); o.userData.outline = true; m.add(o);
    meshes.push(m); parent.add(m);
  }
  function finalizeLines() {
    for (const m of meshes.slice(lined)) {
      const minor = fat(creaseLines(m.geometry, MINOR_ANGLE, MIN_LINE_MM), lineMat);
      const major = fat(creaseLines(m.geometry, MAJOR_ANGLE, MIN_LINE_MM), majorMat); major.renderOrder = 1;
      m.add(minor, major); lines.set(m, [minor, major]);
    }
    lined = meshes.length;
  }
  function setLive(obj: THREE.Object3D, on: boolean) {
    obj.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.outline) return;
      if (o.material === bodyMat || o.material === liveMat) o.material = on ? liveMat : bodyMat;
      const ls = lines.get(o); if (ls) ls[1]!.material = on ? liveLineMat : majorMat;
    });
  }

  // ── view ──
  let target = new THREE.Vector3(), fitDist = 10;
  let camAnim: { from: THREE.Vector3; fromT: THREE.Vector3; to: THREE.Vector3; toT: THREE.Vector3; t: number; zoom0?: number } | null = null;
  const fovK = () => 2 * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
  function orthoFrustum() { const a = w / h; ortho.top = orthoH / 2; ortho.bottom = -orthoH / 2; ortho.left = -orthoH * a / 2; ortho.right = orthoH * a / 2; ortho.updateProjectionMatrix(); }

  function frame(box: THREE.Box3, animate = true) {
    if (box.isEmpty()) return;
    target = box.getCenter(new THREE.Vector3());
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    fitDist = (r * 2.3) / fovK() * Math.max(1, 1.2 / persp.aspect);
    const s = box.getSize(new THREE.Vector3());
    shadow.visible = true; shadow.scale.set(s.x * 1.3 + 0.4, s.z * 1.3 + 0.4, 1); shadow.position.set(target.x, box.min.y - 0.005, target.z);
    const to = target.clone().addScaledVector(ISO_DIR, fitDist);
    if (animate) camAnim = { from: camera.position.clone(), fromT: controls.target.clone(), to, toT: target.clone(), t: 0, zoom0: camera === ortho ? ortho.zoom : undefined };
    else { controls.target.copy(target); camera.position.copy(to); if (camera === ortho) { orthoH = fitDist * fovK(); ortho.zoom = 1; orthoFrustum(); } }
  }

  let isoView = false;
  function setIsoView(on: boolean) {
    if (on === isoView) return;
    isoView = on;
    if (on) {
      orthoH = fitDist * fovK();
      ortho.position.copy(camera.position); ortho.quaternion.copy(camera.quaternion); ortho.zoom = 1; orthoFrustum();
      camera = ortho;
      camAnim = { from: camera.position.clone(), fromT: controls.target.clone(), to: target.clone().addScaledVector(ISO_DIR, fitDist), toT: target.clone(), t: 0, zoom0: 1 };
    } else {
      const d = orthoH / fovK() / ortho.zoom;
      persp.position.copy(controls.target).add(ortho.position.clone().sub(controls.target).setLength(d));
      persp.quaternion.copy(ortho.quaternion); camera = persp;
    }
    (controls as { object: THREE.Camera }).object = camera; (renderPass as { camera: THREE.Camera }).camera = camera; controls.update(); appliedKey = '';
    store('iso', on ? '1' : '0');
  }

  let revolve = false;
  function setRevolve(on: boolean) { revolve = on; controls.autoRotate = on; controls.autoRotateSpeed = 1.2; store('revolve', on ? '1' : '0'); }

  // ── theme and accent ──
  const themeHooks = new Set<() => void>();
  let theme: ThemeName = 'dark', accentName = 'ember', appliedKey = '';
  function paintLive() {
    const light = theme === 'light';
    liveMat.emissive.copy(accent); liveMat.emissiveIntensity = light ? 0 : 0.55;
    liveMat.color.set(light ? accent : new THREE.Color(THEMES.dark.body));
    liveLineMat.color.copy(accent);
  }
  function setTheme(t: ThemeName) {
    theme = t; const T = THEMES[t];
    document.documentElement.dataset.theme = t;
    (scene.background as THREE.Color).set(T.bg); BG_COL.set(T.bg);
    bodyMat.color.set(T.body);
    LINE_COL.set(T.line); MAJOR_COL.set(T.major); EDGE_COL.set(T.edge); appliedKey = '';
    hemi.color.set(T.sky); hemi.groundColor.set(T.ground); hemi.intensity = T.hemi; ambient.intensity = T.amb; sun.intensity = T.sun; fill.intensity = T.fill;
    shadowMat.uniforms.opacity!.value = T.shadow;
    paintLive();
    store('theme', t);
    themeHooks.forEach((f) => f());
  }
  function setAccent(name: string) {
    accentName = name.toLowerCase(); accent.set(accentHex(name));
    document.documentElement.style.setProperty('--accent', '#' + accent.getHexString());
    paintLive();
    store('accent', accentName);
    themeHooks.forEach((f) => f());
  }

  function applyWeight() {
    const dist = camera.position.distanceTo(controls.target);
    const ppu = camera === ortho ? h * ortho.zoom / orthoH : h / (dist * fovK());
    const k = THREE.MathUtils.clamp((ppu / 40 - 0.35) / 0.65, 0, 1);
    const fm = THEMES[theme].fadeMin, fade = fm + (1 - fm) * k, dpr = renderer.getPixelRatio();
    const key = `${fade.toFixed(2)}|${dpr}|${theme}|${camera === ortho}`; if (key === appliedKey) return; appliedKey = key;
    lineMat.linewidth = majorMat.linewidth = dpr; liveLineMat.linewidth = 1.4 * dpr;
    lineMat.color.copy(BG_COL).lerp(EDGE_COL, fade);
    majorMat.color.copy(BG_COL).lerp(MAJOR_COL, fade);
    outlineMat.uniforms.thickness!.value = 0.5 * dpr;
    (outlineMat.uniforms.color!.value as THREE.Color).copy(BG_COL).lerp(LINE_COL, fade);
  }

  // ── loop ──
  const ticks = new Set<(now: number, dt: number) => void>();
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  let last = performance.now(), raf = 0;
  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (camAnim) {
      if (camAnim.t === 0) controls.enableDamping = false;
      camAnim.t = Math.min(1, camAnim.t + dt / 0.8); const k = ease(camAnim.t);
      controls.target.lerpVectors(camAnim.fromT, camAnim.toT, k);
      camera.position.lerpVectors(camAnim.from, camAnim.to, k);
      if (camera === ortho && camAnim.zoom0 !== undefined) { ortho.zoom = THREE.MathUtils.lerp(camAnim.zoom0, 1, k); orthoH = fitDist * fovK(); orthoFrustum(); }
      if (camAnim.t >= 1) { controls.enableDamping = true; camAnim = null; }
    }
    ticks.forEach((f) => f(now, dt));
    controls.update();
    applyWeight();
    composer.render();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  const resize = new ResizeObserver(() => {
    ({ w, h } = size());
    persp.aspect = w / h; persp.updateProjectionMatrix(); orthoFrustum();
    renderer.setSize(w, h); composer.setSize(w, h);
    const res = devRes();
    (outlineMat.uniforms.res!.value as THREE.Vector2).copy(res);
    for (const m of [lineMat, majorMat, liveLineMat]) m.resolution.copy(res);
    appliedKey = '';
  });
  resize.observe(host);

  setTheme((load('theme') as ThemeName | null) ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  setAccent(load('accent') ?? 'ember');
  setRevolve(load('revolve') === '1');
  const startIso = load('iso') === '1';

  const stage: Stage = {
    scene, root, addMesh, finalizeLines, setLive, frame, setIsoView, setRevolve, setTheme, setAccent,
    get theme() { return theme; }, get accent() { return accentName; }, get isoView() { return isoView; }, get revolve() { return revolve; },
    onTick(fn) { ticks.add(fn); return () => ticks.delete(fn); },
    onThemeChange(fn) { themeHooks.add(fn); return () => themeHooks.delete(fn); },
    dispose() { cancelAnimationFrame(raf); resize.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
  if (startIso) queueMicrotask(() => setIsoView(true));
  return stage;
}
