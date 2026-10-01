// 渲染核心：渲染器、后期、天空、水面、粒子、合批与各种程序化贴图
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };

export const G = {
  time: 0, dt: 0, entities: [], state: 'boot',
  settings: { bloom: true, shadows: true, music: 0.5, sfx: 0.8 },
};

// ---------- 数学 / 随机 ----------
import { clamp, lerp, smooth, rand, randi, pick, angDiff, rng, vnoise, fbm } from './mathutil.js';
export { clamp, lerp, smooth, rand, randi, pick, angDiff, rng, vnoise, fbm };

// ---------- 材质 / 贴图 ----------
const matCache = new Map();
export function M(color, o = {}) {
  const key = color + '|' + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.85, metalness: o.m ?? 0,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    flatShading: !!o.flat, map: o.map || null, transparent: !!o.t, opacity: o.o ?? 1,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.dw ?? true,
    vertexColors: !!o.vc,
  });
  matCache.set(key, m);
  return m;
}
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(w, h, draw, repeat = true) {
  const c = canvas(w, h); draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4; return t;
}
function speckle(ctx, w, h, n, alpha, dark = true) {
  for (let i = 0; i < n; i++) {
    const v = Math.random();
    ctx.fillStyle = dark ? `rgba(60,50,40,${alpha * v})` : `rgba(255,255,255,${alpha * v})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
export const TEX = {};
export function textures() {
  if (TEX.ready) return TEX;
  TEX.stone = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e4dcc8'; c.fillRect(0, 0, w, h);
    const rows = 8, bh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 32;
      for (let x = -off; x < w; x += 64) {
        const t = 214 + Math.random() * 30;
        c.fillStyle = `rgb(${t},${t - 6},${t - 22})`;
        c.fillRect(x + 1.5, r * bh + 1.5, 61, bh - 3);
      }
    }
    speckle(c, w, h, 1800, 0.25);
  });
  TEX.facade = canvasTex(256, 256, (c, w, h) => {
    c.drawImage(TEX.stone.image, 0, 0);
    // 拱形窗
    const wx = w / 2, wy = h * 0.58, ww = 58, wh = 100;
    c.fillStyle = '#b9ad94'; c.beginPath(); c.moveTo(wx - ww / 2 - 8, wy + wh / 2 + 6); c.lineTo(wx - ww / 2 - 8, wy - wh / 2 + 20);
    c.arc(wx, wy - wh / 2 + 20, ww / 2 + 8, Math.PI, 0); c.lineTo(wx + ww / 2 + 8, wy + wh / 2 + 6); c.fill();
    const g = c.createLinearGradient(0, wy - wh / 2, 0, wy + wh / 2); g.addColorStop(0, '#26303d'); g.addColorStop(1, '#3d4a5a');
    c.fillStyle = g; c.beginPath(); c.moveTo(wx - ww / 2, wy + wh / 2); c.lineTo(wx - ww / 2, wy - wh / 2 + 20);
    c.arc(wx, wy - wh / 2 + 20, ww / 2, Math.PI, 0); c.lineTo(wx + ww / 2, wy + wh / 2); c.fill();
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 4; c.beginPath(); c.moveTo(wx, wy - wh / 2 - 8); c.lineTo(wx, wy + wh / 2); c.moveTo(wx - ww / 2, wy + 5); c.lineTo(wx + ww / 2, wy + 5); c.stroke();
    c.fillStyle = '#8a6a48'; c.fillRect(wx - ww / 2 - 10, wy + wh / 2 + 2, ww + 20, 8);
    c.fillStyle = '#5c8a3a'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(wx - ww / 2 + i * 7.5, wy + wh / 2 - 1, 5, 0, 7); c.fill(); }
    c.fillStyle = '#d04a5a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(wx - ww / 2 + 4 + i * 13, wy + wh / 2 - 4, 2.5, 0, 7); c.fill(); }
  });
  TEX.cobble = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#9d968a'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 21) for (let x = (y / 21 % 2) * 12; x < w + 20; x += 25) {
      const t = 170 + Math.random() * 45; c.fillStyle = `rgb(${t},${t - 5},${t - 14})`;
      c.beginPath(); c.roundRect(x - 11 + Math.random() * 2, y + 1.5, 21 + Math.random() * 2, 18, 6); c.fill();
    }
    speckle(c, w, h, 1500, 0.2);
  });
  TEX.plaza = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#cfc5ae'; c.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    for (let ring = 0; ring < 14; ring++) {
      const r0 = 60 + ring * 32, n = 12 + ring * 6;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const t = 196 + Math.random() * 40 - (ring % 3 === 0 ? 30 : 0);
        c.fillStyle = `rgb(${t},${t - 8},${t - 26})`;
        c.beginPath(); c.arc(cx, cy, r0 + 30, a0 + 0.004, a1 - 0.004); c.arc(cx, cy, r0 + 2, a1 - 0.004, a0 + 0.004, true); c.fill();
      }
    }
    // 罗盘星纹
    c.fillStyle = '#3f6e9a'; c.globalAlpha = 0.55;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, L = i % 2 ? 150 : 250;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      c.lineTo(cx + Math.cos(a + 0.25) * 60, cy + Math.sin(a + 0.25) * 60); c.lineTo(cx + Math.cos(a - 0.25) * 60, cy + Math.sin(a - 0.25) * 60); c.fill();
    }
    c.globalAlpha = 1; speckle(c, w, h, 6000, 0.18);
  }, false);
  TEX.wood = canvasTex(256, 256, (c, w, h) => {
    for (let x = 0; x < w; x += 32) {
      const t = 110 + Math.random() * 30; c.fillStyle = `rgb(${t},${t * 0.72},${t * 0.48})`; c.fillRect(x, 0, 32, h);
      c.strokeStyle = 'rgba(40,25,10,0.25)'; c.lineWidth = 1;
      for (let i = 0; i < 6; i++) { c.beginPath(); const gx = x + 4 + Math.random() * 24; c.moveTo(gx, 0); c.bezierCurveTo(gx + 4, h * 0.3, gx - 4, h * 0.6, gx + 2, h); c.stroke(); }
      c.fillStyle = 'rgba(30,18,8,0.7)'; c.fillRect(x, 0, 2, h);
      c.fillRect(x, Math.random() * h, 32, 2);
    }
  });
  TEX.roof = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#7d2f22'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 10; x < w + 20; x += 20) {
      const t = Math.random() * 30; c.fillStyle = `rgb(${160 + t},${62 + t * 0.5},${44})`;
      c.beginPath(); c.arc(x, y + 12, 10, Math.PI, 0); c.fill();
    }
  });
  TEX.rock = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5b5550'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { const t = 60 + Math.random() * 50; c.fillStyle = `rgba(${t},${t - 4},${t - 8},0.5)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 0, 7); c.fill(); }
    speckle(c, w, h, 3000, 0.3); speckle(c, w, h, 800, 0.15, false);
  });
  TEX.sand = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#8f8068'; c.fillRect(0, 0, w, h); speckle(c, w, h, 6000, 0.35); speckle(c, w, h, 2000, 0.2, false); });
  TEX.stripeRed = canvasTex(128, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f1eadc' : '#b8322c'; c.fillRect(i * 16, 0, 16, h); } });
  TEX.stripeBlue = canvasTex(128, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f1eadc' : '#2d5d8f'; c.fillRect(i * 16, 0, 16, h); } });
  TEX.banner = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#9a2a22'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8c56a'; c.fillRect(6, 6, w - 12, 4); c.fillRect(6, h - 30, w - 12, 4);
    // 锚与罗盘的徽记
    c.strokeStyle = '#f1e2b0'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(64, 60); c.lineTo(64, 170); c.stroke();
    c.beginPath(); c.arc(64, 130, 40, 0.15, Math.PI - 0.15); c.stroke();
    c.beginPath(); c.moveTo(40, 80); c.lineTo(88, 80); c.stroke();
    c.beginPath(); c.arc(64, 50, 12, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(0, h); c.lineTo(w / 2, h - 26); c.lineTo(w, h); c.fillStyle = '#000'; c.globalCompositeOperation = 'destination-out'; c.fill();
  }, false);
  TEX.ready = true;
  return TEX;
}
export function signTex(text, sub, opts = {}) {
  return canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = opts.bg || '#5a3a22'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d9b36a'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#f3dfae'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 64px "Noto Serif SC", serif'; c.fillText(text, w / 2, sub ? 64 : h / 2);
    if (sub) { c.font = '500 28px Cinzel, serif'; c.fillText(sub, w / 2, 122); }
  }, false);
}

// 按面尺寸设置 UV 的盒子，使贴图按真实米数平铺
export function boxGeo(w, h, d, unit = 4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / unit, uv.getY(i) * dims[f][1] / unit); }
  return g;
}
export function planeGeo(w, d, unit = 4) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / unit, uv.getY(i) * d / unit);
  return g;
}
export function quadGeo(a, b, c, d, uScale = 1, vScale = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, uScale, 0, uScale, vScale, 0, 0, uScale, vScale, 0, vScale], 2));
  g.computeVertexNormals(); return g;
}

// ---------- 静态合批 ----------
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export class Batcher {
  constructor() { this.b = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
    const m = new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    this.addM(geo, mat, m, shadow);
  }
  addM(geo, mat, matrix, shadow = true) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    const key = mat.uuid + (shadow ? 's' : 'n');
    if (!this.b.has(key)) this.b.set(key, { mat, shadow, list: [] });
    this.b.get(key).list.push(g);
  }
  addMesh(mesh, shadow = true) { mesh.updateMatrixWorld(true); this.addM(mesh.geometry, mesh.material, mesh.matrixWorld, shadow); }
  build(parent) {
    for (const { mat, shadow, list } of this.b.values()) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = shadow; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh);
    }
    this.b.clear();
  }
}

// ---------- 天空 ----------
const skyVS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const skyFS = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float time; uniform float cloudAmt; uniform float stars;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = h > 0. ? mix(horizon, top, pow(clamp(h,0.,1.), 0.55)) : mix(horizon, bottom, pow(clamp(-h,0.,1.), 0.35));
  float sd = max(dot(d, normalize(sunDir)), 0.);
  col += sunColor * (pow(sd, 1200.) * 12. + pow(sd, 14.) * 0.35 + pow(sd, 3.) * 0.08);
  if (stars > 0. && h > 0.) { vec2 sp = d.xz / (h + 0.6) * 260.; vec2 cell = floor(sp); vec2 fc = fract(sp) - 0.5; float rnd = hash(cell); float s = step(0.985, rnd) * smoothstep(0.22, 0.0, length(fc)) * (0.6 + 0.4 * sin(time * 2. + rnd * 50.)); col += vec3(0.9, 0.95, 1.) * s * stars * 1.6 * smoothstep(0.,0.25,h); }
  if (h > 0.0 && cloudAmt > 0.) {
    vec2 uv = d.xz / (h + 0.12) * 1.3 + vec2(time*0.006, time*0.002);
    float c = fbm(uv * 1.1); c = smoothstep(0.62 - cloudAmt*0.22, 0.95, c);
    vec3 cc = mix(vec3(1.02), horizon, 0.3) + sunColor * pow(sd, 5.) * 0.4;
    col = mix(col, cc, c * smoothstep(0.0, 0.18, h) * 0.9);
  }
  gl_FragColor = vec4(col, 1.);
}`;

// ---------- 水面 ----------
const waterVS = `
uniform float time; uniform float amp; varying vec3 vW;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += (sin(wp.x*0.07 + time*0.9)*0.35 + sin(wp.z*0.09 - time*1.1)*0.25 + sin((wp.x+wp.z)*0.045 + time*0.6)*0.4) * amp;
  vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const waterFS = `
uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyCol; uniform vec3 sunDir; uniform vec3 sunColor; uniform float glow;
varying vec3 vW;
#include <fog_pars_fragment>
vec2 wg(vec2 p, vec2 d, float f, float s, float a){ float ph = dot(d,p)*f + time*s; return d * (a*f*cos(ph)); }
void main(){
  vec2 p = vW.xz; vec2 g = vec2(0.);
  g += wg(p, normalize(vec2(1.,0.3)), 0.35, 1.3, 0.12);
  g += wg(p, normalize(vec2(-0.4,1.)), 0.6, 1.9, 0.07);
  g += wg(p, normalize(vec2(0.7,-0.8)), 1.3, 2.7, 0.035);
  g += wg(p, normalize(vec2(-1.,-0.2)), 2.6, 3.9, 0.018);
  g += wg(p, normalize(vec2(0.2,1.)), 5.1, 5.3, 0.008);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1. - max(dot(n, v), 0.), 3.5);
  vec3 col = mix(deep, shallow, clamp(0.35 + n.x*1.5 + n.z*0.8, 0., 1.));
  col = mix(col, skyCol, fres * 0.75 + 0.05);
  vec3 hv = normalize(v + normalize(sunDir));
  col += sunColor * pow(max(dot(n, hv), 0.), 320.) * 5.0;
  col += shallow * glow * (0.5 + 0.5*sin(time*2. + vW.x*0.3 + vW.z*0.2)) * 0.3;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;
export function makeWater(size, o = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, amp: { value: o.amp ?? 1 },
    deep: { value: new THREE.Color(o.deep || '#0e3c5a') }, shallow: { value: new THREE.Color(o.shallow || '#2a8aa0') },
    skyCol: { value: new THREE.Color(o.sky || '#a8d4ee') }, sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3) },
    sunColor: { value: new THREE.Color('#fff4d8') }, glow: { value: o.glow ?? 0 },
  }]);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: waterVS, fragmentShader: waterFS, fog: true });
  const seg = o.seg ?? 96;
  const geo = new THREE.PlaneGeometry(size, o.depth || size, seg, seg); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = false;
  mesh.userData.water = true;
  G.waters = G.waters || []; G.waters.push(mat);
  return mesh;
}

// ---------- 粒子 ----------
const pVS = `attribute float size; attribute vec4 pc; varying vec4 vC; uniform float scale;
void main(){ vC = pc; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(size * scale / max(-mv.z, 0.1), 90.0); gl_Position = projectionMatrix * mv; }`;
const pFS = `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a = a*a; gl_FragColor = vec4(vC.rgb * (0.6 + a*0.8), a * vC.a); }`;
export class Particles {
  constructor(max = 5000) {
    this.max = max; this.n = 0;
    const F = (k) => new Float32Array(max * k);
    this.p = F(3); this.v = F(3); this.c = F(4); this.s = F(1); this.life = F(1); this.ml = F(1); this.grav = F(1); this.drag = F(1); this.ss = F(1); this.se = F(1); this.a0 = F(1);
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(F(3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(F(4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(F(1), 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos); this.geo.setAttribute('pc', this.aCol); this.geo.setAttribute('size', this.aSize);
    this.mat = new THREE.ShaderMaterial({ uniforms: { scale: { value: 400 } }, vertexShader: pVS, fragmentShader: pFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  emit(x, y, z, vx, vy, vz, col, size, life, o = {}) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 4] = col.r; this.c[i * 4 + 1] = col.g; this.c[i * 4 + 2] = col.b; this.a0[i] = o.alpha ?? 1;
    this.ss[i] = size; this.se[i] = o.endSize ?? size * 0.3;
    this.life[i] = life; this.ml[i] = life; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0;
  }
  burst(pos, col, n, o = {}) {
    const sp = o.speed ?? 4, up = o.up ?? 1;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * 0.6, s = sp * (0.4 + Math.random() * 0.6);
      this.emit(pos.x + (Math.random() - 0.5) * (o.spread ?? 0.3), pos.y + (Math.random() - 0.5) * (o.spread ?? 0.3), pos.z + (Math.random() - 0.5) * (o.spread ?? 0.3),
        Math.cos(a) * Math.cos(e) * s, Math.abs(Math.sin(e)) * s * up + (o.lift ?? 0), Math.sin(a) * Math.cos(e) * s,
        col, (o.size ?? 0.5) * (0.6 + Math.random() * 0.8), (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), o);
    }
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.copy(this.n - 1, i); this.n--; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= d; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      i++;
    }
    const P = this.aPos.array, C = this.aCol.array, S = this.aSize.array;
    for (let k = 0; k < this.n; k++) {
      const t = this.life[k] / this.ml[k];
      P[k * 3] = this.p[k * 3]; P[k * 3 + 1] = this.p[k * 3 + 1]; P[k * 3 + 2] = this.p[k * 3 + 2];
      C[k * 4] = this.c[k * 4]; C[k * 4 + 1] = this.c[k * 4 + 1]; C[k * 4 + 2] = this.c[k * 4 + 2];
      C[k * 4 + 3] = this.a0[k] * Math.min(1, t * 3) * Math.min(1, (1 - t) * 8 + 0.2);
      S[k] = this.se[k] + (this.ss[k] - this.se[k]) * t;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    this.mat.uniforms.scale.value = innerHeight * 0.9 * G.renderer.getPixelRatio();
  }
  copy(from, to) {
    for (let k = 0; k < 3; k++) { this.p[to * 3 + k] = this.p[from * 3 + k]; this.v[to * 3 + k] = this.v[from * 3 + k]; }
    for (let k = 0; k < 4; k++) this.c[to * 4 + k] = this.c[from * 4 + k];
    this.life[to] = this.life[from]; this.ml[to] = this.ml[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
    this.ss[to] = this.ss[from]; this.se[to] = this.se[from]; this.a0[to] = this.a0[from];
  }
  clear() { this.n = 0; }
}

// ---------- 初始化 ----------
export function initEngine(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2400);
  camera.position.set(0, 5, 10);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 0.86);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  Object.assign(G, { renderer, scene, camera, composer, bloom });

  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5a48, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  G.sun = sun; G.hemi = hemi; G.sunDir = new THREE.Vector3(0.45, 0.75, 0.35).normalize();

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#2d6fc7') }, horizon: { value: new THREE.Color('#bfe1f5') }, bottom: { value: new THREE.Color('#5a7a90') },
      sunDir: { value: G.sunDir.clone() }, sunColor: { value: new THREE.Color('#fff0d0') }, time: { value: 0 }, cloudAmt: { value: 0.6 }, stars: { value: 0 },
    }, vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky); G.sky = sky; G.skyMat = skyMat;
  G.particles = new Particles(6000); scene.add(G.particles.points);
  scene.fog = new THREE.Fog(0xbfe1f5, 60, 600);
  G.waters = [];
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
}

export function setEnvironment(env) {
  const u = G.skyMat.uniforms;
  u.top.value.set(env.top); u.horizon.value.set(env.horizon); u.bottom.value.set(env.bottom || env.horizon);
  u.sunColor.value.set(env.sunColor || '#fff0d0'); u.cloudAmt.value = env.clouds ?? 0.5; u.stars.value = env.stars ?? 0;
  if (env.sunDir) G.sunDir.set(...env.sunDir).normalize();
  u.sunDir.value.copy(G.sunDir);
  G.sun.color.set(env.sunLight || '#fff1dc'); G.sun.intensity = env.sunInt ?? 2.6;
  G.hemi.color.set(env.hemiSky || '#cfe6ff'); G.hemi.groundColor.set(env.hemiGround || '#6a5a48'); G.hemi.intensity = env.hemiInt ?? 1.0;
  G.scene.fog.color.set(env.fog[0]); G.scene.fog.near = env.fog[1]; G.scene.fog.far = env.fog[2];
  G.renderer.toneMappingExposure = env.exposure ?? 1.0;
  G.bloom.strength = env.bloom ?? 0.5;
  G.sky.visible = env.sky !== false;
  G.scene.background = env.sky === false ? new THREE.Color(env.fog[0]) : null;
  G.sun.castShadow = G.settings.shadows && env.shadows !== false;
}

export function updateEngine(dt, focus) {
  G.skyMat.uniforms.time.value = G.time;
  G.sky.position.copy(G.camera.position);
  for (const w of G.waters) { w.uniforms.time.value = G.time; w.uniforms.sunDir.value.copy(G.sunDir); }
  if (focus) {
    G.sun.position.set(focus.x + G.sunDir.x * 110, focus.y + G.sunDir.y * 110, focus.z + G.sunDir.z * 110);
    G.sun.target.position.copy(focus);
  }
  G.particles.update(dt);
}

export function render() {
  if (G.settings.bloom) G.composer.render(); else G.renderer.render(G.scene, G.camera);
}

export function disposeGroup(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.userData.ownMat) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
}
