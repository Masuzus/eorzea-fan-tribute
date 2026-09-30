// 地图构建：利姆萨·罗敏萨（城镇）、拉诺西亚低地（野外）、天然要害沙斯塔夏溶洞（副本）
import { THREE, G, M, textures, boxGeo, planeGeo, Batcher, makeWater, fbm, vnoise, rng, smooth, lerp, clamp, canvasTex, signTex, rand } from './engine.js';

const PI = Math.PI;

// ---------- 可行走区域 ----------
class Walk {
  constructor() { this.a = []; this.blk = []; this.grid = new Map(); }
  rect(x0, z0, x1, z1, y) { this.a.push({ t: 'r', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y }); }
  circ(x, z, r, y) { this.a.push({ t: 'c', x, z, r, y }); }
  ramp(x0, z0, x1, z1, ya, yb) { this.a.push({ t: 'p', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), za: z0, zb: z1, ya, yb }); }
  height(x, z) {
    let best = null;
    for (const a of this.a) {
      let y = null;
      if (a.t === 'c') { const dx = x - a.x, dz = z - a.z; if (dx * dx + dz * dz <= a.r * a.r) y = a.y; }
      else if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) y = a.t === 'r' ? a.y : lerp(a.ya, a.yb, clamp((z - a.za) / (a.zb - a.za), 0, 1));
      if (y !== null && (best === null || y > best)) best = y;
    }
    return best;
  }
  key(cx, cz) { return cx * 10007 + cz; }
  addBlock(b) {
    const x0 = Math.floor((b.t === 'c' ? b.x - b.r : b.x0) / 10), x1 = Math.floor((b.t === 'c' ? b.x + b.r : b.x1) / 10);
    const z0 = Math.floor((b.t === 'c' ? b.z - b.r : b.z0) / 10), z1 = Math.floor((b.t === 'c' ? b.z + b.r : b.z1) / 10);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = this.key(i, j); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(b); }
    this.blk.push(b); return b;
  }
  box(x0, z0, x1, z1) { return this.addBlock({ t: 'b', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), on: true }); }
  cb(x, z, r) { return this.addBlock({ t: 'c', x, z, r, on: true }); }
  blocked(x, z, rad = 0.35) {
    const l = this.grid.get(this.key(Math.floor(x / 10), Math.floor(z / 10))); if (!l) return false;
    for (const b of l) {
      if (!b.on) continue;
      if (b.t === 'c') { const dx = x - b.x, dz = z - b.z, r = b.r + rad; if (dx * dx + dz * dz < r * r) return true; }
      else if (x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) return true;
    }
    return false;
  }
}

function rockGeo(seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.72 + vnoise(x * 1.9 + seed * 7.1, y * 1.7 + z * 1.3 + seed) * 0.5; p.setXYZ(i, x * n, y * n * 0.9, z * n); }
  g.computeVertexNormals(); return g;
}
const ROCKS = []; function rockVariant(i) { if (!ROCKS.length) for (let k = 0; k < 5; k++) ROCKS.push(rockGeo(k + 1)); return ROCKS[i % ROCKS.length]; }
let roofTex = null;
function roofT() {
  if (roofTex) return roofTex;
  roofTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#cfcfcf'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 10; x < w + 20; x += 20) { const t = 190 + Math.random() * 50; c.fillStyle = `rgb(${t},${t},${t})`; c.beginPath(); c.arc(x, y + 12, 10, PI, 0); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.stroke(); }
  });
  roofTex.repeat.set(0.3, 0.3); return roofTex;
}
function roofGeo(w, d, h) { const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.4, 0); s.lineTo(w / 2 + 0.4, 0); s.lineTo(0, h); s.lineTo(-w / 2 - 0.4, 0); const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false }); g.translate(0, 0, -(d + 0.8) / 2); return g; }

// 石造建筑
function building(B, W, x0, z0, x1, z1, h, o = {}) {
  const T = textures(), w = x1 - x0, d = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2, y0 = o.y0 || 0;
  B.add(boxGeo(w, h, d, 4), M('#ffffff', { map: T.facade, r: 0.92 }), x, y0 + h / 2, z);
  B.add(boxGeo(w + 0.5, 1.4, d + 0.5, 4), M('#bdb29a', { map: T.stone }), x, y0 + 0.7, z);
  B.add(boxGeo(w + 0.7, 0.55, d + 0.7, 4), M('#f4ecd8', { map: T.stone }), x, y0 + h + 0.27, z);
  const roof = o.roof || 'flat';
  if (roof === 'pitched') {
    const col = o.roofColor || '#b8503a'; const alongX = w >= d;
    const g = roofGeo(alongX ? d : w, alongX ? w : d, Math.min(w, d) * 0.45);
    B.add(g, M(col, { map: roofT(), r: 0.8 }), x, y0 + h + 0.5, z, 0, alongX ? PI / 2 : 0, 0);
  } else if (roof === 'dome') {
    B.add(new THREE.SphereGeometry(Math.min(w, d) * 0.4, 20, 10, 0, PI * 2, 0, PI / 2), M(o.roofColor || '#3a6a9a', { r: 0.5, m: 0.3 }), x, y0 + h + 0.5, z);
  } else {
    const m = M('#efe6d0', { map: T.stone });
    B.add(boxGeo(w + 0.7, 1, 0.5, 4), m, x, y0 + h + 1, z0 - 0.1); B.add(boxGeo(w + 0.7, 1, 0.5, 4), m, x, y0 + h + 1, z1 + 0.1);
    B.add(boxGeo(0.5, 1, d + 0.7, 4), m, x0 - 0.1, y0 + h + 1, z); B.add(boxGeo(0.5, 1, d + 0.7, 4), m, x1 + 0.1, y0 + h + 1, z);
    if (o.garden) for (let i = 0; i < 3; i++) B.add(new THREE.IcosahedronGeometry(1.2, 1), M('#4a7a3a', { flat: true }), x + (i - 1) * w * 0.25, y0 + h + 1.3, z, 0, 0, 0, 1, 0.8, 1);
  }
  if (o.chimney) B.add(boxGeo(1, 3, 1, 2), M('#8a7a6a', { map: T.stone }), x + w * 0.3, y0 + h + 1.5, z - d * 0.2);
  if (o.awning) {
    const [side, col] = o.awning; const aw = new THREE.PlaneGeometry(Math.min(w, d) * 0.7, 2.2); const mat = M('#ffffff', { map: col === 'blue' ? T.stripeBlue : T.stripeRed, ds: true });
    if (side === 'n') B.add(aw, mat, x, y0 + 3.6, z0 - 1, -PI / 2 + 0.5, 0, 0);
    if (side === 's') B.add(aw, mat, x, y0 + 3.6, z1 + 1, -PI / 2 - 0.5 + PI, 0, 0);
    if (side === 'e') B.add(aw, mat, x1 + 1, y0 + 3.6, z, -PI / 2 + 0.5, -PI / 2, 0);
    if (side === 'w') B.add(aw, mat, x0 - 1, y0 + 3.6, z, -PI / 2 + 0.5, PI / 2, 0);
  }
  if (o.door) {
    const [side] = o.door; const dm = M('#3a2618', { r: 0.8 });
    if (side === 'n') B.add(boxGeo(2.2, 3.2, 0.3), dm, x, y0 + 1.6, z0 - 0.05);
    if (side === 's') B.add(boxGeo(2.2, 3.2, 0.3), dm, x, y0 + 1.6, z1 + 0.05);
    if (side === 'e') B.add(boxGeo(0.3, 3.2, 2.2), dm, x1 + 0.05, y0 + 1.6, z);
    if (side === 'w') B.add(boxGeo(0.3, 3.2, 2.2), dm, x0 - 0.05, y0 + 1.6, z);
  }
  if (W && o.block !== false) W.box(x0, z0, x1, z1);
}
function tower(B, x, z, r, h, y0 = 0, roofCol = '#3a6a9a') {
  const T = textures();
  const g = new THREE.CylinderGeometry(r, r * 1.08, h, 20, 1); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 6.28 / 4, uv.getY(i) * h / 4);
  B.add(g, M('#ffffff', { map: T.facade }), x, y0 + h / 2, z);
  B.add(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 0.6, 20), M('#f4ecd8', { map: T.stone }), x, y0 + h + 0.3, z);
  B.add(new THREE.ConeGeometry(r + 0.8, r * 2.2, 20), M(roofCol, { map: roofT(), r: 0.6 }), x, y0 + h + 0.6 + r * 1.1, z);
}
function lamp(B, x, z, y = 0, lights) {
  B.add(new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8), M('#2a2622', { r: 0.4, m: 0.7 }), x, y + 1.8, z);
  B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), M('#2a2622', { m: 0.7 }), x + 0.35, y + 3.5, z, 0, 0, PI / 2);
  B.add(new THREE.BoxGeometry(0.34, 0.5, 0.34), M('#ffd890', { e: '#ffb040', ei: 2.2 }), x + 0.7, y + 3.2, z, 0, 0, 0, 1, 1, 1, false);
  B.add(new THREE.ConeGeometry(0.3, 0.3, 4), M('#2a2622', { m: 0.7 }), x + 0.7, y + 3.6, z, 0, PI / 4, 0);
  if (lights) lights.push([x + 0.7, y + 3.2, z]);
}
function crate(B, x, y, z, s = 1, r = 0) { B.add(boxGeo(s, s, s, 1), M('#ffffff', { map: textures().wood }), x, y + s / 2, z, 0, r, 0); }
function barrel(B, x, y, z, s = 1) {
  B.add(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 1.1 * s, 12), M('#7a5234', { r: 0.8 }), x, y + 0.55 * s, z);
  for (const k of [0.2, 0.9]) B.add(new THREE.TorusGeometry(0.44 * s, 0.03, 4, 16), M('#3a3430', { m: 0.6 }), x, y + k * s, z, PI / 2);
}
function rail(B, x0, z0, x1, z1, y = 0, mat) {
  const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), m = mat || M('#e8dfca', { map: textures().stone });
  B.add(boxGeo(0.35, 0.25, len, 2), m, (x0 + x1) / 2, y + 1.1, (z0 + z1) / 2, 0, a, 0);
  B.add(boxGeo(0.3, 0.2, len, 2), m, (x0 + x1) / 2, y + 0.1, (z0 + z1) / 2, 0, a, 0);
  const n = Math.max(1, Math.floor(len / 1.2));
  for (let i = 0; i <= n; i++) { const t = i / n; B.add(new THREE.CylinderGeometry(0.1, 0.12, 1, 6), m, lerp(x0, x1, t), y + 0.6, lerp(z0, z1, t)); }
}
function cloth(grp, x0, y0, z0, x1, y1, z1, width, map, sag = 1.2) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.PlaneGeometry(width, len, 1, 10); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len + 0.5; p.setZ(i, -Math.sin(t * PI) * sag); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, M('#ffffff', { map, ds: true, r: 0.9 }));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(x1 - x0, z1 - z0); m.rotation.x = -PI / 2 + Math.atan2(y1 - y0, len);
  m.castShadow = true; grp.add(m); return m;
}
function ship(grp, x, z, ry, s = 1) {
  const T = textures(); const sh = new THREE.Group(); sh.position.set(x, -2.2, z); sh.rotation.y = ry; sh.scale.setScalar(s);
  const outline = new THREE.Shape(); outline.moveTo(-3.2, -11); outline.lineTo(3.2, -11); outline.quadraticCurveTo(4, 2, 0, 13); outline.quadraticCurveTo(-4, 2, -3.2, -11);
  const hull = new THREE.ExtrudeGeometry(outline, { depth: 3.6, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2 }); hull.rotateX(-PI / 2);
  const hm = new THREE.Mesh(hull, M('#5a3a24', { map: T.wood, r: 0.8 })); hm.castShadow = true; sh.add(hm);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(outline).rotateX(-PI / 2), M('#c09a6a', { map: T.wood })); deck.position.y = 3.65; sh.add(deck);
  const stripe = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.4, bevelEnabled: false }).rotateX(-PI / 2), M('#a8322c')); stripe.position.y = 2.6; stripe.scale.set(1.03, 1, 1.02); sh.add(stripe);
  for (const [mz, mh] of [[-4, 16], [4, 19]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, mh, 8), M('#4a3020')); mast.position.set(0, 3.6 + mh / 2, mz); mast.castShadow = true; sh.add(mast);
    for (const [sy, sw] of [[0.45, 9], [0.75, 7]]) {
      const g = new THREE.PlaneGeometry(sw, mh * 0.28, 8, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / sw; p.setZ(i, (1 - 4 * u * u) * 1.2); } g.computeVertexNormals();
      const sail = new THREE.Mesh(g, M('#f1eadc', { ds: true, r: 0.95 })); sail.position.set(0, 3.6 + mh * sy, mz + 0.4); sail.castShadow = true; sh.add(sail);
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, sw + 1, 6), M('#4a3020')); yard.rotation.z = PI / 2; yard.position.set(0, 3.6 + mh * sy + mh * 0.14, mz + 0.2); sh.add(yard);
    }
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), M('#ffffff', { map: T.banner, ds: true })); flag.position.set(0, 25, 4); sh.add(flag);
  grp.add(sh); return sh;
}
function seagulls(grp, cx, cz, n, h) {
  const birds = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(); const wm = M('#f4f4f0', { ds: true });
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), wm); wl.position.x = 0.45; const wr = wl.clone(); wr.position.x = -0.45;
    const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); b.add(pl); b.add(pr);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), wm); body.rotation.x = PI / 2; b.add(body);
    grp.add(b); birds.push({ b, pl, pr, r: rand(15, 45), sp: rand(0.15, 0.3) * (Math.random() < 0.5 ? -1 : 1), a: rand(0, 6.28), h: h + rand(-4, 8), ph: rand(0, 6) });
  }
  return (dt) => { for (const s of birds) { s.a += s.sp * dt; const x = cx + Math.cos(s.a) * s.r, z = cz + Math.sin(s.a) * s.r; s.b.position.set(x, s.h + Math.sin(G.time + s.ph) * 1.5, z); s.b.rotation.y = -s.a + (s.sp > 0 ? 0 : PI); s.b.rotation.z = s.sp > 0 ? -0.3 : 0.3; const f = Math.sin(G.time * 6 + s.ph) * 0.5; s.pl.rotation.z = f; s.pr.rotation.z = -f; } };
}
function aetheryte(grp, x, y, z, big = true) {
  const g = new THREE.Group(); g.position.set(x, y, z); grp.add(g);
  const T = textures(); const s = big ? 1 : 0.55;
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry((4 - i * 0.8) * s, (4.2 - i * 0.8) * s, 0.45, 32), M('#ffffff', { map: T.stone })); m.position.y = 0.22 + i * 0.45; m.castShadow = m.receiveShadow = true; g.add(m); }
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#2a9aff', emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1.2 * s, 0), crystalMat); cr.scale.set(1, 2.8, 1); cr.position.y = 6 * s; g.add(cr);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 * s, 0), new THREE.MeshBasicMaterial({ color: '#dff6ff' })); core.scale.set(1, 2.6, 1); cr.add(core);
  const arcs = [];
  const arcMat = M('#d8c89a', { m: 0.7, r: 0.35, e: '#3a6a9a', ei: 0.4 });
  for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(2.4 * s, 0.14 * s, 6, 24, PI * 0.55), arcMat); const p = new THREE.Group(); p.add(a); p.position.y = 6 * s; p.rotation.y = (i / 4) * PI * 2; a.rotation.z = -PI * 0.27 + PI / 2; a.position.x = 0; g.add(p); arcs.push(p); }
  const small = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * s, 0), crystalMat); m.scale.set(1, 2, 1); g.add(m); small.push(m); }
  const light = new THREE.PointLight('#6ac8ff', big ? 40 : 15, big ? 22 : 12, 1.6); light.position.y = 6 * s; g.add(light);
  return {
    g, cr, update(dt) {
      const t = G.time; cr.rotation.y = t * 0.4; cr.position.y = 6 * s + Math.sin(t * 1.2) * 0.25 * s;
      arcs.forEach((p, i) => { p.rotation.y = (i / 4) * PI * 2 + t * 0.25; p.position.y = 6 * s + Math.sin(t + i) * 0.2; });
      small.forEach((m, i) => { const a = t * 0.8 + (i / 6) * PI * 2; m.position.set(Math.cos(a) * 3.2 * s, 5 * s + Math.sin(t * 2 + i) * 0.8 * s, Math.sin(a) * 3.2 * s); m.rotation.y = t * 2; });
      if (Math.random() < (big ? 0.6 : 0.25)) { const a = rand(0, 6.28), r = rand(0.5, 3.5) * s; G.particles.emit(x + Math.cos(a) * r, y + 1.4, z + Math.sin(a) * r, 0, rand(1.2, 3), 0, new THREE.Color('#8ae0ff').multiplyScalar(1.6), 0.3, rand(1.5, 3)); }
      crystalMat.emissiveIntensity = 1.4 + Math.sin(t * 2) * 0.3;
    },
  };
}

// =====================================================================
// 利姆萨·罗敏萨
// =====================================================================
function buildTown() {
  const grp = new THREE.Group(), B = new Batcher(), W = new Walk(), T = textures(), lights = [];
  const stone = M('#ffffff', { map: T.stone, r: 0.95 }), cobble = M('#ffffff', { map: T.cobble, r: 0.95 }), wood = M('#ffffff', { map: T.wood, r: 0.85 });
  // --- 可行走区域 ---
  W.rect(-40, -17, 40, 12, 0);   // 下层甲板（以太之光广场）
  W.rect(-52, -7, -40, 7, 0);    // 西街
  W.rect(-70, -14, -52, 14, 0);  // 西风门广场
  W.rect(40, -7, 46, 7, 0);      // 东街
  W.rect(46, -5, 90, 5, 0);      // 主码头
  W.rect(62, -30, 68, -5, 0);    // 侧码头
  W.rect(-22, 12, 22, 34, 0);    // 南观景台
  W.ramp(-5, -15, 5, -36, 0, 6); // 北坡道
  W.rect(-34, -66, 34, -36, 6);  // 上层甲板
  W.rect(-34, -36, -5, -20, 6); W.rect(5, -36, 34, -20, 6); // 上层观景平台
  // --- 地面 ---
  B.add(planeGeo(80, 29, 3), cobble, 0, 0.01, -2.5);
  B.add(new THREE.CircleGeometry(17, 64).rotateX(-PI / 2), M('#ffffff', { map: T.plaza, r: 0.9 }), 0, 0.03, 0);
  B.add(new THREE.TorusGeometry(17, 0.22, 6, 64), stone, 0, 0.05, 0, PI / 2);
  B.add(planeGeo(12, 14, 3), cobble, -46, 0.01, 0); B.add(planeGeo(18, 28, 3), cobble, -61, 0.01, 0); B.add(planeGeo(6, 14, 3), cobble, 43, 0.01, 0);
  B.add(planeGeo(44, 22, 3), cobble, 0, 0.01, 23);
  B.add(boxGeo(44.6, 14, 22.6, 4), M('#d8cfb8', { map: T.stone }), 0, -7, 23.3);
  B.add(boxGeo(46, 0.5, 11, 4), wood, 68, -0.25, 0); B.add(boxGeo(7, 0.5, 26, 4), wood, 65, -0.25, -17.5);
  for (let x = 48; x <= 90; x += 4) for (const z of [-5, 5]) B.add(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), M('#4a3020'), x, -3, z);
  for (let z = -28; z <= -6; z += 4) for (const x of [62, 68]) B.add(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), M('#4a3020'), x, -3, z);
  B.add(planeGeo(68, 30, 3), cobble, 0, 6.01, -51); B.add(planeGeo(29, 16, 3), cobble, -19.5, 6.01, -28); B.add(planeGeo(29, 16, 3), cobble, 19.5, 6.01, -28);
  // 坡道（台阶视觉）
  for (let i = 0; i < 21; i++) { const z = -15 - i - 0.5, y = (i + 1) * 6 / 21; B.add(boxGeo(10, y, 1.05, 2), stone, 0, y / 2, z); }
  for (const sx of [-1, 1]) B.add(boxGeo(1, 7, 21, 4), stone, sx * 5.5, 3.5, -25.5);
  // 下层甲板与上层之间的挡土墙
  for (const [x0, x1] of [[-40, -6], [6, 40]]) {
    const w = x1 - x0, x = (x0 + x1) / 2; B.add(boxGeo(w, 6, 19, 4), M('#ffffff', { map: T.facade }), x, 3, -26.5);
    for (let k = 0; k < Math.floor(w / 7); k++) { const ax = x0 + 3.5 + k * 7; B.add(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 16, 1, false, 0, PI), M('#3a3228'), ax, 2.4, -16.95, PI / 2, 0, 0); B.add(boxGeo(3.2, 2.4, 0.4), M('#3a3228'), ax, 1.2, -16.95); }
  }
  // 栏杆
  rail(B, -34, -20, -6, -20, 6); rail(B, 6, -20, 34, -20, 6); rail(B, -22, 34, 22, 34, 0);
  rail(B, -5.3, -36, -5.3, -20, 6); rail(B, 5.3, -36, 5.3, -20, 6);
  rail(B, 46, 5, 90, 5, 0, M('#6a4a2e')); rail(B, 90, -5, 90, 5, 0, M('#6a4a2e')); rail(B, 68, -30, 68, -5, 0, M('#6a4a2e'));
  // --- 建筑群 ---
  building(B, W, -52, -30, -40, -7, 14, { roof: 'pitched', roofColor: '#3a6a9a', awning: ['s', 'blue'], door: ['s'] });
  building(B, W, -52, 7, -40, 30, 12, { roof: 'flat', garden: true, awning: ['n', 'red'], door: ['n'] });
  building(B, W, -76, -30, -52, -14, 10, { roof: 'pitched', roofColor: '#b8503a', chimney: true, door: ['s'] });
  building(B, W, -76, 14, -62, 30, 9, { roof: 'pitched', roofColor: '#b8503a' });
  building(B, W, 40, -30, 58, -7, 12, { roof: 'pitched', roofColor: '#b8503a', door: ['s'], awning: ['s', 'red'] });
  building(B, W, 40, 7, 56, 28, 14, { roof: 'flat', chimney: true, door: ['n'] });
  building(B, W, -44, 12, -22, 34, 12, { roof: 'flat', garden: true, door: ['e'], awning: ['e', 'blue'] });
  building(B, W, 22, 12, 40, 32, 13, { roof: 'pitched', roofColor: '#3a6a9a', door: ['w'], awning: ['w', 'red'] });
  building(B, W, -52, -80, -34, -40, 18, { roof: 'flat', y0: 6, chimney: true });
  building(B, W, 34, -80, 52, -40, 16, { roof: 'pitched', roofColor: '#3a6a9a', y0: 6 });
  building(B, W, -60, -40, -40, -30, 20, { roof: 'flat', block: false });
  building(B, W, 40, -40, 60, -30, 18, { roof: 'dome', roofColor: '#3a6a9a', block: false });
  building(B, null, -24, -95, 24, -80, 26, { roof: 'flat', y0: 6 });
  building(B, null, -70, -70, -52, -40, 24, { roof: 'pitched', roofColor: '#b8503a' });
  building(B, null, 52, -70, 72, -40, 22, { roof: 'flat' });
  tower(B, -36, -38, 3.5, 22, 6); tower(B, 36, -38, 3.5, 20, 6, '#b8503a'); tower(B, -45, 32, 3, 20, 0); tower(B, 58, 26, 3, 24, 0, '#b8503a');
  W.cb(-36, -38, 3.8); W.cb(36, -38, 3.8);
  // 溺水海豚亭
  building(B, W, -16, -78, 16, -66, 9, { roof: 'pitched', roofColor: '#b8503a', y0: 6, chimney: true });
  for (let i = -2; i <= 2; i++) B.add(boxGeo(2.2, 3.4, 0.3), M('#3a2618'), i * 6, 7.7, -65.9);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshStandardMaterial({ map: signTex('溺水海豚亭', 'THE DROWNING WENCH'), roughness: 0.8 }));
  sign.position.set(0, 12.6, -65.7); grp.add(sign);
  B.add(boxGeo(10, 1.1, 1, 1), wood, 0, 6.55, -59.1); B.add(boxGeo(10.4, 0.15, 1.3, 1), M('#5a3a22'), 0, 7.15, -59.1); W.box(-5, -59.6, 5, -58.6);
  for (let i = -3; i <= 3; i++) barrel(B, i * 1.4, 6, -63.5, 0.9);
  B.add(boxGeo(12, 0.3, 4, 2), wood, 0, 9.6, -61, 0.2);
  for (const [tx, tz] of [[-12, -50], [12, -50], [-12, -42], [12, -42], [-22, -56], [22, -56]]) {
    B.add(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 16), wood, tx, 7.1, tz); B.add(new THREE.CylinderGeometry(0.12, 0.2, 1.1, 8), M('#3a2618'), tx, 6.55, tz);
    for (let k = 0; k < 3; k++) { const a = k * 2.1; B.add(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 10), wood, tx + Math.cos(a) * 1.7, 6.3, tz + Math.sin(a) * 1.7); }
    B.add(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), M('#3a2618'), tx, 8.6, tz); B.add(new THREE.ConeGeometry(2.2, 1, 8, 1, true), M('#ffffff', { map: T.stripeRed, ds: true }), tx, 10.2, tz);
    W.cb(tx, tz, 1.2);
  }
  // 横幅与帆布
  for (const x of [-30, -18, 18, 30]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), M('#ffffff', { map: T.banner, ds: true })); b.position.set(x, 3.2, -16.7); grp.add(b); }
  for (const x of [-14, 14]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.6), M('#ffffff', { map: T.banner, ds: true })); b.position.set(x, 11.5, -65.8); grp.add(b); }
  cloth(grp, -46, 11, -7.5, -46, 11, 7.5, 5, T.stripeRed, 1.3); cloth(grp, 43, 10, -7.5, 43, 10, 7.5, 5, T.stripeBlue, 1.2);
  cloth(grp, -30, 13, -17, -38, 13, 12, 4, T.stripeBlue, 2); cloth(grp, 30, 13, -17, 38, 13, 12, 4, T.stripeRed, 2);
  // 拱门
  for (const ax of [-47]) { for (const z of [-8, 8]) B.add(boxGeo(1.6, 9, 1.6, 4), stone, ax, 4.5, z); B.add(boxGeo(2, 1.6, 17.6, 4), stone, ax, 9.8, 0); }
  // 西风门
  B.add(boxGeo(5, 16, 10, 4), stone, -72.5, 8, -11); B.add(boxGeo(5, 16, 10, 4), stone, -72.5, 8, 11); B.add(boxGeo(5, 5, 12, 4), stone, -72.5, 13.5, 0);
  B.add(new THREE.CylinderGeometry(6, 6, 5, 20, 1, false, 0, PI), M('#3a3228'), -72.5, 10.9, 0, 0, 0, PI / 2);
  const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(12, 11), new THREE.MeshBasicMaterial({ color: '#9ad8ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  gateGlow.position.set(-71.5, 5.5, 0); gateGlow.rotation.y = PI / 2; grp.add(gateGlow);
  const gsign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshStandardMaterial({ map: signTex('西风门', 'ZEPHYR GATE', { bg: '#2a3a4a' }) })); gsign.position.set(-70, 13.8, 0); gsign.rotation.y = PI / 2; grp.add(gsign);
  B.add(planeGeo(60, 12, 3), cobble, -105, 0.01, 0);
  W.box(-76, -30, -70, -6); W.box(-76, 6, -70, 30);
  // 陆行鸟房
  B.add(boxGeo(8, 0.2, 5, 2), M('#c8a860'), -57, 0.1, 12.5); for (const [fx, fz, fw, fd] of [[-61, 12.5, 0.2, 3], [-57, 10.2, 8, 0.2]]) B.add(boxGeo(fw, 1.1, fd, 1), wood, fx, 0.55, fz);
  for (let i = 0; i < 4; i++) B.add(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 12), M('#d8c070'), -54 + i * 0.1, 0.6, 13.5 + (i % 2) * 0.6, PI / 2, i, 0);
  W.box(-61.5, 10.4, -53, 14);
  // 广场装饰
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; if (i === 2 || i === 6) continue; lamp(B, Math.cos(a) * 13.5, Math.sin(a) * 13.5, 0, lights); W.cb(Math.cos(a) * 13.5, Math.sin(a) * 13.5, 0.3); }
  for (const [bx, bz, br] of [[-8, 13, 0], [8, 13, 0], [-15, -4, PI / 2], [15, 4, PI / 2]]) { B.add(boxGeo(3, 0.15, 0.8, 1), wood, bx, 0.55, bz, 0, br, 0); B.add(boxGeo(3, 0.5, 0.15, 1), wood, bx, 0.9, bz + (br ? 0 : 0.35), 0, br, 0); W.box(bx - (br ? 0.5 : 1.6), bz - (br ? 1.6 : 0.5), bx + (br ? 0.5 : 1.6), bz + (br ? 1.6 : 0.5)); }
  for (const [px, pz] of [[-24, -10], [24, -10], [-24, 8], [24, 8]]) {
    B.add(new THREE.CylinderGeometry(1.4, 1.5, 0.9, 12), stone, px, 0.45, pz); B.add(new THREE.CylinderGeometry(0.15, 0.2, 2.5, 6), M('#5a3a22'), px, 1.9, pz);
    B.add(new THREE.IcosahedronGeometry(1.4, 1), M('#4f8a3a', { flat: true }), px, 3.6, pz); W.cb(px, pz, 1.5);
  }
  // 市场摊位
  for (const [sx, sz, col] of [[13, -12, T.stripeRed], [19, -8, T.stripeBlue], [-20, -12, T.stripeBlue]]) {
    B.add(boxGeo(3.4, 1, 1.4, 1), wood, sx, 0.5, sz); for (const dx of [-1.6, 1.6]) for (const dz of [-0.6, 0.6]) B.add(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 5), M('#4a3020'), sx + dx, 1.4, sz + dz);
    B.add(boxGeo(3.8, 0.1, 2, 1), M('#ffffff', { map: col, ds: true }), sx, 2.8, sz, 0.12);
    for (let k = 0; k < 6; k++) B.add(new THREE.SphereGeometry(0.16, 8, 6), M(['#e04a2a', '#f0c030', '#6ab04a'][k % 3]), sx - 1.2 + k * 0.5, 1.12, sz);
    W.box(sx - 1.8, sz - 0.8, sx + 1.8, sz + 0.8);
  }
  // 码头货物
  for (const [cx, cz, s] of [[50, -3.5, 1.2], [51.3, -3.4, 1], [50.5, -3.6, 0.8], [74, 3.6, 1.1], [80, -3.5, 1.2], [64, -24, 1]]) { crate(B, cx, 0, cz, s, rand(0, 1)); W.cb(cx, cz, s * 0.7); }
  for (const [bx, bz] of [[56, 3.8], [57, 3.5], [86, -3.8], [66.5, -12]]) { barrel(B, bx, 0, bz); W.cb(bx, bz, 0.5); }
  for (let x = 50; x <= 88; x += 9.5) { B.add(new THREE.CylinderGeometry(0.2, 0.25, 1, 8), M('#2a2622', { m: 0.6 }), x, 0.5, 4.7); B.add(new THREE.TorusGeometry(0.4, 0.08, 6, 12), M('#b8a070'), x, 0.1, 4.2, PI / 2); }
  lamp(B, 55, -4.5, 0, lights); lamp(B, 75, -4.5, 0, lights); lamp(B, 65, -29, 0, lights);
  // 起重机
  B.add(boxGeo(0.6, 9, 0.6, 1), M('#4a3020'), 84, 4.5, -3.8); B.add(boxGeo(0.4, 0.4, 7, 1), M('#4a3020'), 84, 8.8, -1, 0); W.cb(84, -3.8, 0.5);
  // 远景：悬崖、灯塔、岛屿
  const rockM = M('#bcb2a0', { flat: true, r: 1 });
  for (let i = 0; i < 22; i++) { const x = -120 + i * 12 + rand(-4, 4), z = -115 + rand(-15, 10); const s = rand(14, 26); B.add(rockVariant(i), rockM, x, s * 0.35, z, rand(0, 3), rand(0, 3), 0, s, s * rand(1.6, 2.6), s); }
  for (let i = 0; i < 8; i++) { const x = -150 + rand(-10, 10), z = -60 + i * 18; const s = rand(12, 22); B.add(rockVariant(i + 2), rockM, x, s * 0.3, z, 0, rand(0, 3), 0, s, s * 2, s); }
  B.add(rockVariant(3), rockM, 80, -2, 150, 0, 0, 0, 14, 7, 12);
  const lh = new THREE.Group(); lh.position.set(80, 4, 150); grp.add(lh);
  const lhTex = canvasTex(64, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f2ede0' : '#b8322c'; c.fillRect(0, i * 32, w, 32); } });
  const lht = new THREE.Mesh(new THREE.CylinderGeometry(2, 3.2, 26, 20), new THREE.MeshStandardMaterial({ map: lhTex })); lht.position.y = 13; lh.add(lht);
  const lamp2 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 12), new THREE.MeshStandardMaterial({ color: '#fff4c0', emissive: '#ffd060', emissiveIntensity: 3 })); lamp2.position.y = 27.2; lh.add(lamp2);
  const lroof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.4, 12), M('#2a3a4a')); lroof.position.y = 29.6; lh.add(lroof);
  for (let i = 0; i < 6; i++) { const a = rand(-0.6, 0.9) + PI / 2, r = rand(380, 520), s = rand(30, 60); B.add(rockVariant(i), M('#8a9a8a', { flat: true }), Math.cos(a) * r, -2, Math.sin(a) * r, 0, rand(0, 3), 0, s * 2, s * 0.6, s); }
  // 船
  const shp = ship(grp, 70, 13.5, PI / 2, 1);
  const shp2 = ship(grp, 110, -40, 0.3, 0.9);
  W.box(55, 9.5, 86, 17.5);
  // 海
  const sea = makeWater(2400, { deep: '#0b3a5c', shallow: '#1f8ab0', sky: '#bfe1f5', seg: 120 }); sea.position.y = -2.5; grp.add(sea);
  // 灯光
  const lanternLights = [];
  for (const [x, y, z] of lights.slice(0, 4)) { const l = new THREE.PointLight('#ffb050', 6, 12, 1.5); l.position.set(x, y, z); grp.add(l); lanternLights.push(l); }
  B.build(grp);
  const aeth = aetheryte(grp, 0, 0, 0, true); W.cb(0, 0, 3.6);
  const gulls = seagulls(grp, 30, 20, 9, 22);
  return {
    id: 'town', name: '利姆萨·罗敏萨', sub: '下层甲板', en: 'LIMSA LOMINSA', music: 'town', group: grp, walk: W,
    env: { top: '#2f6fc0', horizon: '#c4e2f4', bottom: '#4a7a9a', sunDir: [0.45, 0.7, 0.4], sunColor: '#fff0d0', clouds: 0.55, fog: ['#c4e2f4', 90, 700], hemiSky: '#d8ecff', hemiGround: '#8a7a64', hemiInt: 1.05, sunInt: 2.7, exposure: 1.0, bloom: 0.45 },
    heightAt: (x, z) => W.height(x, z), canWalk: (x, z, r) => W.height(x, z) !== null && !W.blocked(x, z, r),
    spawns: { start: [52, 0, -1.6], fromField: [-64, 0, PI / 2], aetheryte: [0, 6.5, 0], wench: [0, -48, PI] },
    transitions: [{ x0: -80, z0: -6, x1: -69.5, z1: 6, to: 'field', spawn: 'fromTown' }],
    interacts: [{ id: 'aetheryte', x: 0, z: 0, r: 8, label: '以太之光' }],
    aetheryte: { id: 'limsa', name: '利姆萨·罗敏萨', x: 0, z: 6.5 },
    labels: [['以太之光广场', 0, 3], ['溺水海豚亭', 0, -58], ['码头', 70, 0], ['西风门', -64, 0], ['观景台', 0, 26], ['上层甲板', -20, -45], ['陆行鸟房', -57, 14]],
    bounds: [-90, -100, 100, 50], camMax: 16,
    update(dt) { aeth.update(dt); gulls(dt); gateGlow.material.opacity = 0.18 + Math.sin(G.time * 2) * 0.06; shp.position.y = -2.2 + Math.sin(G.time * 0.8) * 0.15; shp.rotation.z = Math.sin(G.time * 0.6) * 0.015; shp2.position.y = -2.2 + Math.sin(G.time * 0.7 + 1) * 0.2; lanternLights.forEach((l, i) => { l.intensity = 5.5 + Math.sin(G.time * 7 + i * 2) * 0.5; }); },
    wander: { x0: -38, z0: -15, x1: 38, z1: 10 },
  };
}

// =====================================================================
// 拉诺西亚低地
// =====================================================================
const ROAD = [[-205, 0], [-150, 5], [-110, -4], [-60, 4], [-20, 8], [0, 14], [20, 6], [50, -10], [80, -30], [105, -60], [122, -82]];
const ROAD2 = [[50, -10], [72, 18], [96, 46]];
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
function dRoad(x, z) { let d = 1e9; for (const R of [ROAD, ROAD2]) for (let i = 0; i < R.length - 1; i++) d = Math.min(d, segDist(x, z, R[i][0], R[i][1], R[i + 1][0], R[i + 1][1])); return d; }
function fieldH(x, z) {
  let h = (fbm(x * 0.011 + 3.1, z * 0.011 + 7.7, 4) - 0.45) * 20 + Math.sin(x * 0.013) * 2 + Math.cos(z * 0.017) * 2;
  const dr = dRoad(x, z), flat = Math.max(1 - smooth(4, 18, dr), 1 - smooth(20, 42, Math.hypot(x + 22, z - 48)), 1 - smooth(10, 22, Math.hypot(x, z - 20)));
  h = lerp(h, h * 0.2 + 1.2, flat);
  const coast = 112 + (vnoise(z * 0.02, 5.3) - 0.5) * 30;
  h = lerp(h, -7, smooth(coast - 28, coast + 12, x));
  const beach = 1 - smooth(12, 30, Math.hypot(x - 100, z - 55)); h = lerp(h, 1.0 - (x - 100) * 0.07, beach);
  const cave = 1 - smooth(8, 22, Math.hypot(x - 122, z + 84)); h = lerp(h, 1.2, cave);
  const r = Math.hypot(x, z * 1.05); h += smooth(175, 210, r) * 32 * (x > 90 ? 0.3 : 1) * (x < -150 ? smooth(6, 16, Math.abs(z)) : 1);
  return h;
}
function buildField() {
  const grp = new THREE.Group(), B = new Batcher(), W = new Walk(), T = textures(), R = rng(42);
  // 地形
  const size = 440, seg = 150, geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-PI / 2);
  const p = geo.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  const grassA = new THREE.Color('#5f8f3a'), grassB = new THREE.Color('#86a24a'), dirt = new THREE.Color('#9a7f58'), sand = new THREE.Color('#d8c89c'), rock = new THREE.Color('#8a8272'), field = new THREE.Color('#8a6a40'), under = new THREE.Color('#6a7a6a');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = fieldH(x, z); p.setY(i, h);
    const n = fbm(x * 0.05, z * 0.05, 3); c.copy(grassA).lerp(grassB, clamp(n * 1.6 - 0.4, 0, 1));
    const dr = dRoad(x, z); if (dr < 4.5) c.lerp(dirt, 1 - smooth(2.2, 4.5, dr));
    if (h < 1.6) c.lerp(sand, 1 - smooth(0.6, 1.6, h)); if (h < -1.5) c.lerp(under, 0.6);
    const s = Math.abs(fieldH(x + 1.5, z) - h) + Math.abs(fieldH(x, z + 1.5) - h); if (s > 1.6) c.lerp(rock, clamp((s - 1.6) / 1.5, 0, 1));
    if ((x > -52 && x < -28 && z > 26 && z < 40) || (x > -20 && x < -2 && z > 30 && z < 42)) c.lerp(field, 0.6);
    const v = 0.92 + vnoise(x * 0.3, z * 0.3) * 0.16; cols[i * 3] = c.r * v; cols[i * 3 + 1] = c.g * v; cols[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); terrain.receiveShadow = true; grp.add(terrain);
  const sea = makeWater(2400, { deep: '#0c4060', shallow: '#2a9ab8', sky: '#c4e2f4', seg: 120 }); sea.position.y = -2; grp.add(sea);
  // 实例化植被
  const inst = (g, m, arr, shadow = true) => { const mesh = new THREE.InstancedMesh(g, m, arr.length); const d = new THREE.Object3D(); arr.forEach((a, i) => { d.position.set(a[0], a[1], a[2]); d.rotation.set(0, a[3] || 0, 0); d.scale.set(a[4], a[5] ?? a[4], a[6] ?? a[4]); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); if (a[7]) mesh.setColorAt(i, c.set(a[7])); }); mesh.castShadow = shadow; mesh.receiveShadow = true; grp.add(mesh); return mesh; };
  const ok = (x, z, pad = 6) => { const h = fieldH(x, z); return h > 1.4 && dRoad(x, z) > pad && Math.hypot(x, z) < 190 && !(x > -56 && x < 16 && z > 22 && z < 72) && Math.hypot(x - 100, z - 55) > 24 && Math.hypot(x - 122, z + 84) > 16 && Math.hypot(x + 195, z) > 16; };
  const pines = [], oaks = [], trunks = [];
  for (let i = 0; i < 520 && pines.length + oaks.length < 230; i++) {
    const x = (R() - 0.5) * 390, z = (R() - 0.5) * 390; if (!ok(x, z, 7)) continue; const h = fieldH(x, z), s = 0.8 + R() * 0.7;
    const pine = R() < 0.5; trunks.push([x, h, z, R() * 6, s, s * (pine ? 1.3 : 1), s]);
    (pine ? pines : oaks).push([x, h + (pine ? 2.2 : 3.2) * s, z, R() * 6, s, s, s, pine ? ['#2f5a2a', '#3a6a30', '#2a4f26'][i % 3] : ['#4f8a34', '#5f9a3a', '#6a8a2a', '#3f7a2e'][i % 4]]);
    W.cb(x, z, 0.5 * s);
  }
  inst(new THREE.CylinderGeometry(0.18, 0.3, 3, 6).translate(0, 1.5, 0), M('#5a3e28'), trunks);
  const pineG = (() => { const gs = [0, 1, 2].map((k) => new THREE.ConeGeometry(1.9 - k * 0.5, 2.4, 8).translate(0, k * 1.3, 0)); const m = mergeG(gs); return m; })();
  inst(pineG, M('#ffffff', { flat: true, r: 0.9 }), pines);
  const oakG = mergeG([new THREE.IcosahedronGeometry(1.8, 1), new THREE.IcosahedronGeometry(1.3, 1).translate(1.2, -0.3, 0.4), new THREE.IcosahedronGeometry(1.4, 1).translate(-1, 0.2, -0.6), new THREE.IcosahedronGeometry(1.2, 1).translate(0.2, 1.1, 0.2)]);
  inst(oakG, M('#ffffff', { flat: true, r: 0.9 }), oaks);
  const rocks = []; for (let i = 0; i < 300 && rocks.length < 90; i++) { const x = (R() - 0.5) * 380, z = (R() - 0.5) * 380; if (!ok(x, z, 5)) continue; const s = 0.5 + R() * 1.8; rocks.push([x, fieldH(x, z) + s * 0.2, z, R() * 6, s * 1.3, s * 0.8, s, R() < 0.5 ? '#9a9282' : '#8a8478']); if (s > 1) W.cb(x, z, s * 0.9); }
  inst(rockVariant(1), M('#ffffff', { flat: true, r: 1 }), rocks);
  const grass = [], bladeG = mergeG([0, 1, 2].map((k) => { const g = new THREE.PlaneGeometry(0.12, 0.7); g.translate(0, 0.35, 0); g.rotateY(k * 1.05); g.rotateZ((k - 1) * 0.25); return g; }));
  for (let i = 0; i < 9000 && grass.length < 4200; i++) { const x = (R() - 0.5) * 360, z = (R() - 0.5) * 360; const h = fieldH(x, z); if (h < 1.5 || dRoad(x, z) < 3 || Math.hypot(x, z) > 180) continue; const s = 0.6 + R() * 0.9; grass.push([x, h - 0.05, z, R() * 6, s, s, s, ['#6a9a3a', '#7aaa44', '#5a8a30', '#8aa84a'][i % 4]]); }
  const gm = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1 }); inst(bladeG, gm, grass, false);
  const flowers = []; for (let i = 0; i < 1500 && flowers.length < 500; i++) { const x = (R() - 0.5) * 340, z = (R() - 0.5) * 340; const h = fieldH(x, z); if (h < 1.6 || dRoad(x, z) < 4) continue; flowers.push([x, h + 0.35, z, 0, 0.09, 0.09, 0.09, ['#f4f0e0', '#f0d040', '#b080e0', '#f08090'][i % 4]]); }
  inst(new THREE.IcosahedronGeometry(1, 0), M('#ffffff', { e: '#222222' }), flowers, false);
  // 麦田
  const wheat = [];
  for (const [x0, z0, x1, z1] of [[-50, 28, -30, 38], [-18, 32, -4, 40]]) for (let x = x0; x < x1; x += 0.55) for (let z = z0; z < z1; z += 0.55) { const jx = x + (R() - 0.5) * 0.4, jz = z + (R() - 0.5) * 0.4; wheat.push([jx, fieldH(jx, jz), jz, R() * 3, 1, 0.8 + R() * 0.5, 1, R() < 0.5 ? '#e0c060' : '#d0a848']); }
  inst(new THREE.ConeGeometry(0.06, 1.3, 4).translate(0, 0.65, 0), M('#ffffff', { r: 0.9 }), wheat, false);
  // 栅栏
  const fenceM = M('#7a5a3a', { r: 0.9 });
  for (const [x0, z0, x1, z1] of [[-51, 27, -29, 39], [-19, 31, -3, 41]]) {
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
    for (const [ax, az, bx, bz] of edges) { const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 2.5); for (let i = 0; i <= n; i++) { const x = lerp(ax, bx, i / n), z = lerp(az, bz, i / n); B.add(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 5), fenceM, x, fieldH(x, z) + 0.65, z); } const mx = (ax + bx) / 2, mz = (az + bz) / 2; for (const y of [0.5, 1]) B.add(boxGeo(0.08, 0.1, len, 2), fenceM, mx, fieldH(mx, mz) + y, mz, 0, Math.atan2(bx - ax, bz - az), 0); }
    W.box(x0, z0, x1, z1);
  }
  // 农舍与风车
  const fh0 = fieldH(-28, 61);
  building(B, W, -34, 57, -22, 65, 5, { y0: fh0 - 0.5, roof: 'pitched', roofColor: '#b8503a', door: ['n'], chimney: true });
  building(B, W, -14, 60, -6, 68, 4.5, { y0: fieldH(-10, 64) - 0.5, roof: 'pitched', roofColor: '#7a5a3a', door: ['w'] });
  for (let i = 0; i < 5; i++) { const x = -18 + i * 1.6, z = 56; B.add(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 12), M('#d8c070'), x, fieldH(x, z) + 0.6, z, PI / 2, 0.3 * i, 0); }
  const wmx = 12, wmz = 62, wmh = fieldH(wmx, wmz);
  B.add(new THREE.CylinderGeometry(2.2, 3.2, 11, 12), M('#ffffff', { map: T.stone }), wmx, wmh + 5.5, wmz); B.add(new THREE.ConeGeometry(3, 3, 12), M('#7a5a3a', { map: roofT() }), wmx, wmh + 12.5, wmz); W.cb(wmx, wmz, 3.2);
  const blades = new THREE.Group(); blades.position.set(wmx, wmh + 10, wmz - 3); grp.add(blades);
  for (let i = 0; i < 4; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 0.1), M('#ffffff', { map: T.stripeRed })); bl.position.y = 3.6; const piv = new THREE.Group(); piv.rotation.z = (i / 4) * PI * 2; piv.add(bl); blades.add(piv); bl.castShadow = true; }
  // 以太之晶（盛夏农庄）
  const ae = aetheryte(grp, 0, fieldH(0, 20), 20, false); W.cb(0, 20, 2.4);
  // 西风门（通往城镇）
  const gx = -198;
  B.add(boxGeo(6, 18, 12, 4), M('#ffffff', { map: T.stone }), gx, fieldH(gx, -12) + 7, -13); B.add(boxGeo(6, 18, 12, 4), M('#ffffff', { map: T.stone }), gx, fieldH(gx, 12) + 7, 13); B.add(boxGeo(6, 5, 16, 4), M('#ffffff', { map: T.stone }), gx, fieldH(gx, 0) + 13, 0);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.MeshBasicMaterial({ color: '#9ad8ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.set(gx + 1, fieldH(gx, 0) + 6, 0); glow.rotation.y = PI / 2; grp.add(glow);
  W.box(gx - 3, -19, gx + 3, -7); W.box(gx - 3, 7, gx + 3, 19);
  // 沙哈金族营地（东部海滩）
  const camp = [];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.4, x = 100 + Math.cos(a) * 11, z = 55 + Math.sin(a) * 11; B.add(new THREE.ConeGeometry(2, 3, 6), M('#6a8a7a', { flat: true }), x, fieldH(x, z) + 1.4, z); W.cb(x, z, 1.8); }
  const crystals = new THREE.Group(); crystals.position.set(100, fieldH(100, 55), 55); grp.add(crystals);
  const cmat = new THREE.MeshStandardMaterial({ color: '#7ad0ff', emissive: '#2a8aff', emissiveIntensity: 1.8, flatShading: true, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 + Math.random() * 0.3, 0), cmat); m.scale.y = 2; m.position.set(rand(-1.2, 1.2), 0.5, rand(-1.2, 1.2)); m.rotation.set(rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4)); crystals.add(m); camp.push(m); }
  W.cb(100, 55, 1.8);
  for (let i = 0; i < 6; i++) { const x = 90 + rand(-15, 20), z = 40 + rand(-10, 40); B.add(new THREE.CylinderGeometry(0.2, 0.25, 4, 6), M('#8a7a60'), x, fieldH(x, z) + 0.2, z, PI / 2 - 0.1, rand(0, 3), 0); }
  // 沙斯塔夏溶洞入口
  const cx = 124, cz = -88, ch = fieldH(cx, cz);
  const caveRock = M('#7a7266', { flat: true });
  for (let i = 0; i < 9; i++) { const a = PI * 0.15 + (i / 8) * PI * 1.1, r = 7; B.add(rockVariant(i), caveRock, cx + Math.cos(a) * r, ch + 2 + Math.sin(i) * 1.5, cz - Math.sin(a) * r * 0.7 - 2, rand(0, 3), rand(0, 3), 0, rand(3, 5), rand(4, 7), rand(3, 5)); }
  B.add(rockVariant(2), caveRock, cx, ch + 9, cz - 3, 0, 0, 0, 9, 4, 6);
  const hole = new THREE.Mesh(new THREE.SphereGeometry(4.5, 20, 10, 0, PI * 2, 0, PI / 2), new THREE.MeshBasicMaterial({ color: '#05080a', side: THREE.BackSide })); hole.position.set(cx, ch - 0.2, cz - 5); hole.scale.set(1, 1.2, 0.8); grp.add(hole);
  const caveGlow = new THREE.PointLight('#4ac8ff', 20, 18, 1.5); caveGlow.position.set(cx, ch + 2, cz - 3); grp.add(caveGlow);
  W.cb(cx, cz - 5, 3.5);
  const csign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.6), new THREE.MeshStandardMaterial({ map: signTex('沙斯塔夏溶洞', 'SASTASHA', { bg: '#2a3a4a' }) })); csign.position.set(cx - 5, ch + 2.5, cz + 2); csign.rotation.y = 0.4; grp.add(csign);
  B.add(new THREE.CylinderGeometry(0.1, 0.12, 2.5, 6), M('#5a3a22'), cx - 5, ch + 1.25, cz + 1.9);
  // 远山
  for (let i = 0; i < 26; i++) { const a = (i / 26) * PI * 2; if (Math.cos(a) > 0.55) continue; const r = rand(240, 300), s = rand(40, 70); B.add(rockVariant(i), M('#7a8a6a', { flat: true }), Math.cos(a) * r, rand(-5, 5), Math.sin(a) * r, 0, rand(0, 3), 0, s * 1.5, s * rand(0.6, 1.1), s); }
  B.build(grp);
  const gulls = seagulls(grp, 120, 20, 7, 18);
  const heightAt = (x, z) => fieldH(x, z);
  return {
    id: 'field', name: '拉诺西亚低地', sub: '盛夏农庄', en: 'LOWER LA NOSCEA', music: 'field', group: grp, walk: W,
    env: { top: '#3274c4', horizon: '#cfe6f2', bottom: '#5a8aa0', sunDir: [0.5, 0.65, 0.3], sunColor: '#fff0d0', clouds: 0.65, fog: ['#cfe6f2', 120, 520], hemiSky: '#d8ecff', hemiGround: '#6a7a4a', hemiInt: 1.0, sunInt: 2.8, exposure: 1.0, bloom: 0.45 },
    heightAt, canWalk: (x, z, r) => { const h = fieldH(x, z); return h > -1.1 && (Math.hypot(x, z * 1.05) < 188 || (x < -150 && x > -212 && Math.abs(z) < 6.5)) && !W.blocked(x, z, r); },
    spawns: { fromTown: [-186, 0, PI / 2], aetheryte: [3, 25, PI], cave: [118, -76, PI * 0.8] },
    transitions: [{ x0: -215, z0: -7, x1: -196, z1: 7, to: 'town', spawn: 'fromField' }],
    interacts: [{ id: 'aetheryte2', x: 0, z: 20, r: 5, label: '以太之晶' }, { id: 'sastasha', x: 124, z: -84, r: 7, label: '沙斯塔夏溶洞' }],
    gather: [[-26, 24], [-56, 46], [2, 46], [-40, 70], [-10, 76]],
    mobSpawns: [
      { mob: 'ladybug', lv: [2, 4], x: -70, z: 50, r: 16, n: 6 }, { mob: 'ladybug', lv: [2, 3], x: -80, z: -30, r: 14, n: 4 },
      { mob: 'rat', lv: [3, 5], x: 60, z: 30, r: 14, n: 5 }, { mob: 'rat', lv: [4, 5], x: 88, z: -12, r: 10, n: 3 },
      { mob: 'sahagin', lv: [5, 7], x: 104, z: 66, r: 15, n: 4 },
    ],
    fate: { x: 100, z: 55, r: 20 },
    aetheryte: { id: 'summerford', name: '盛夏农庄', x: 3, z: 25 },
    labels: [['盛夏农庄', -20, 50], ['东部海滩', 100, 60], ['沙斯塔夏溶洞', 118, -92], ['西风门', -186, 8], ['风车', 12, 68]],
    bounds: [-210, -200, 170, 190], camMax: 18,
    update(dt) { ae.update(dt); gulls(dt); blades.rotation.z += dt * 0.5; glow.material.opacity = 0.18 + Math.sin(G.time * 2) * 0.06; camp.forEach((m, i) => { m.position.y = 0.6 + Math.sin(G.time * 1.5 + i) * 0.15; }); caveGlow.intensity = 18 + Math.sin(G.time * 3) * 4; },
  };
}
function mergeG(list) {
  const gs = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; });
  const out = new THREE.BufferGeometry(); let total = 0; gs.forEach((g) => (total += g.attributes.position.count));
  for (const attr of ['position', 'normal', 'uv']) { const sz = attr === 'uv' ? 2 : 3; const arr = new Float32Array(total * sz); let off = 0; gs.forEach((g) => { arr.set(g.attributes[attr].array, off); off += g.attributes[attr].array.length; }); out.setAttribute(attr, new THREE.BufferAttribute(arr, sz)); }
  return out;
}

// =====================================================================
// 天然要害沙斯塔夏溶洞
// =====================================================================
function buildDungeon() {
  const grp = new THREE.Group(), B = new Batcher(), W = new Walk(), T = textures();
  const areas = [
    ['r', -8, -26, 8, 0], ['r', -4, -40, 4, -24], ['c', 0, -50, 13], ['r', -4, -80, 4, -60], ['c', 0, -94, 16], ['r', -4, -124, 4, -107],
    ['c', 0, -134, 12], ['r', -4, -162, 4, -143], ['c', 0, -176, 16], ['r', -4, -207, 4, -189], ['c', 0, -222, 17],
  ];
  const sandM = M('#ffffff', { map: T.sand, r: 1 }), rockM = M('#6a625a', { map: T.rock, flat: true, r: 1 });
  B.add(planeGeo(120, 290, 6), M('#2a2622', { map: T.sand }), 0, -0.05, -120);
  for (const a of areas) {
    if (a[0] === 'r') { W.rect(a[1], a[2], a[3], a[4], 0); B.add(planeGeo(a[3] - a[1], a[4] - a[2], 4), sandM, (a[1] + a[3]) / 2, 0.01, (a[2] + a[4]) / 2); }
    else { W.circ(a[1], a[2], a[3], 0); const g = new THREE.CircleGeometry(a[3], 48).rotateX(-PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * a[3] / 2, uv.getY(i) * a[3] / 2); B.add(g, sandM, a[1], 0.02, a[2]); }
  }
  // 岩壁
  const inside = (x, z, pad) => { for (const a of areas) { if (a[0] === 'r') { if (x > a[1] - pad && x < a[3] + pad && z > a[2] - pad && z < a[4] + pad) return true; } else if (Math.hypot(x - a[1], z - a[2]) < a[3] + pad) return true; } return false; };
  let k = 0;
  for (let z = 6; z > -250; z -= 2.6) for (let x = -34; x <= 34; x += 2.6) {
    const jx = x + Math.sin(z * 1.3 + x) * 1.2, jz = z + Math.cos(x * 1.7 + z) * 1.2;
    if (inside(jx, jz, 0.5) || !inside(jx, jz, 5.5)) continue;
    const s = 2.2 + vnoise(jx * 0.3, jz * 0.3) * 3.5; k++;
    B.add(rockVariant(k), rockM, jx, s * 0.6 - 0.5, jz, k, k * 0.7, 0, s, s * (1.6 + vnoise(jz, jx) * 1.8), s);
  }
  // 钟乳石
  for (let i = 0; i < 90; i++) { const a = areas[i % areas.length]; const x = a[0] === 'c' ? a[1] + rand(-a[3], a[3]) : rand(a[1], a[3]), z = a[0] === 'c' ? a[2] + rand(-a[3], a[3]) : rand(a[2], a[4]); B.add(new THREE.ConeGeometry(rand(0.4, 1.2), rand(3, 8), 6), rockM, x, rand(11, 15), z, PI, 0, 0); }
  // 发光珊瑚与水晶
  const glowMats = [M('#7ae0ff', { e: '#2ac0ff', ei: 2.2 }), M('#ff8ad0', { e: '#ff3aa0', ei: 1.8 }), M('#9aff9a', { e: '#3aff6a', ei: 1.6 })];
  for (let i = 0; i < 70; i++) {
    let x, z, tries = 0; do { x = rand(-26, 26); z = rand(-245, 4); tries++; } while ((inside(x, z, -0.2) || !inside(x, z, 3)) && tries < 40);
    const m = glowMats[i % 3];
    if (i % 2) B.add(new THREE.OctahedronGeometry(rand(0.2, 0.5), 0), m, x, rand(0.2, 2), z, rand(0, 1), rand(0, 3), 0, 1, 2.2, 1, false);
    else for (let j = 0; j < 4; j++) B.add(new THREE.CylinderGeometry(0.04, 0.08, rand(0.5, 1.2), 5), m, x + rand(-0.3, 0.3), 0.4, z + rand(-0.3, 0.3), rand(-0.4, 0.4), 0, rand(-0.4, 0.4), 1, 1, 1, false);
  }
  // 海盗营地
  const wood = M('#ffffff', { map: T.wood });
  for (const [x, z] of [[-9, -44], [8, -58], [-6, -128], [7, -140], [-5, -8], [6, -18]]) { crate(B, x, 0, z, 1.1, rand(0, 1)); crate(B, x + 1.2, 0, z + 0.3, 0.8, 0.3); barrel(B, x - 0.4, 0, z + 1.4); W.cb(x + 0.4, z + 0.4, 1.6); }
  for (const [x, z] of [[-10, -56], [10, -48]]) { B.add(new THREE.ConeGeometry(2.2, 3, 4), M('#8a6a4a', { flat: true }), x, 1.5, z, 0, PI / 4, 0); W.cb(x, z, 1.8); }
  // Boss2 甲板
  B.add(new THREE.CylinderGeometry(15.5, 15.5, 0.4, 40), wood, 0, 0.05, -176);
  B.add(new THREE.CylinderGeometry(0.5, 0.6, 16, 10), M('#4a3020'), 8, 8, -186); W.cb(8, -186, 0.8);
  { const g = new THREE.PlaneGeometry(10, 6, 6, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (1 - Math.pow(p.getX(i) / 5, 2)) * 1.2); g.computeVertexNormals(); B.add(g, M('#e8dcc8', { ds: true }), 8, 11, -185.5); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; const x = Math.cos(a) * 14.5, z = -176 + Math.sin(a) * 14.5; B.add(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 10), M('#2a2a30', { m: 0.7, r: 0.4 }), x, 0.9, z, PI / 2, -a + PI / 2, 0); W.cb(x, z, 0.8); }
  // 水池
  const pool = makeWater(40, { deep: '#04202a', shallow: '#1a8a9a', sky: '#0a3a4a', glow: 1, seg: 40, amp: 0.25 }); pool.position.set(0, -0.35, -248); grp.add(pool);
  const pool2 = makeWater(30, { deep: '#04202a', shallow: '#1a8a9a', sky: '#0a3a4a', glow: 1, seg: 20, amp: 0.2 }); pool2.position.set(22, -0.4, -94); grp.add(pool2);
  W.cb(0, -250, 13);
  // 封锁墙
  const seals = {};
  const mkSeal = (id, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshBasicMaterial({ color: '#ff7a3a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(0, 3.5, z); grp.add(m); const b = W.box(-4.5, z - 0.4, 4.5, z + 0.4); b.on = false; seals[id] = seals[id] || []; seals[id].push({ m, b });
  };
  mkSeal('b1', -78.5); mkSeal('b1', -109.5); mkSeal('b2', -159.5); mkSeal('b2', -191.5); mkSeal('b3', -204.5);
  // 灯光
  const lts = [];
  for (const [x, y, z, col, i] of [[0, 6, -8, '#ffb060', 30], [0, 7, -50, '#ffb060', 40], [0, 9, -94, '#6ad0ff', 55], [0, 8, -176, '#ffb060', 55], [0, 10, -226, '#4ae0ff', 70]]) { const l = new THREE.PointLight(col, i, 40, 1.3); l.position.set(x, y, z); grp.add(l); lts.push(l); }
  for (const [x, z] of [[-6, -30], [6, -30], [-5, -66], [5, -66], [-5, -150], [5, -150], [-5, -196], [5, -196]]) { B.add(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), M('#3a2618'), x, 1.1, z); B.add(new THREE.SphereGeometry(0.22, 8, 6), M('#ffd080', { e: '#ff9a30', ei: 3 }), x, 2.3, z, 0, 0, 0, 1, 1, 1, false); W.cb(x, z, 0.3); }
  B.build(grp);
  return {
    id: 'dungeon', name: '天然要害沙斯塔夏溶洞', sub: '', en: 'SASTASHA', music: 'dungeon', group: grp, walk: W, dungeon: true,
    env: { sky: false, top: '#000', horizon: '#000', fog: ['#061218', 18, 95], hemiSky: '#7aa8c8', hemiGround: '#2a2018', hemiInt: 0.95, sunInt: 0.9, sunLight: '#9ac8e8', sunDir: [0.2, 1, 0.3], exposure: 1.15, bloom: 0.75, shadows: true },
    heightAt: (x, z) => W.height(x, z), canWalk: (x, z, r) => W.height(x, z) !== null && !W.blocked(x, z, r),
    spawns: { start: [0, -4, PI] },
    transitions: [], interacts: [],
    seals, setSeal(id, on) { for (const s of seals[id] || []) { s.b.on = on; s.target = on ? 0.35 : 0; } },
    labels: [['入口', 0, -8], ['隐秘码头', 0, -94], ['海盗甲板', 0, -176], ['虎鲸之穴', 0, -222]],
    bounds: [-40, -255, 40, 10], camMax: 13,
    update(dt) { for (const id in seals) for (const s of seals[id]) { const t = s.target ?? 0; s.m.material.opacity += (t - s.m.material.opacity) * Math.min(1, dt * 4); s.m.visible = s.m.material.opacity > 0.01; } lts[4].intensity = 65 + Math.sin(G.time * 2) * 8; },
  };
}

export function buildZone(id) {
  if (id === 'town') return buildTown();
  if (id === 'field') return buildField();
  return buildDungeon();
}
export { fieldH, dRoad, aetheryte, rockVariant };
