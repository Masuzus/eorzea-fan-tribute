// 角色系统：八大种族的程序化人形骨架、捏脸贴图、发型、装备、武器、动作，以及魔物与陆行鸟
import { THREE, clamp, lerp, canvas } from './engine.js';

const PI = Math.PI;
export const RACE_BODY = {
  hyur: { h: [1.8, 1.66], w: [1.0, 0.9], head: 1.0, leg: 1.0, torso: 1.0, ears: 'human' },
  elezen: { h: [2.02, 1.9], w: [0.94, 0.85], head: 0.95, leg: 1.1, torso: 1.02, ears: 'elf' },
  lalafell: { h: [0.95, 0.93], w: [1.12, 1.08], head: 1.6, leg: 0.6, torso: 0.66, ears: 'lala' },
  miqote: { h: [1.62, 1.55], w: [0.92, 0.85], head: 1.02, leg: 1.02, torso: 0.97, ears: 'cat', tail: 'cat' },
  roegadyn: { h: [2.2, 2.02], w: [1.42, 1.15], head: 0.92, leg: 1.0, torso: 1.06, ears: 'human' },
  aura: { h: [1.78, 1.5], w: [1.08, 0.86], head: 1.0, leg: 1.0, torso: 1.0, ears: 'none', horns: true, tail: 'dragon', scales: true },
  viera: { h: [1.92, 1.86], w: [0.95, 0.87], head: 0.98, leg: 1.1, torso: 1.0, ears: 'bunny' },
  hrothgar: { h: [2.12, 1.96], w: [1.38, 1.2], head: 1.28, leg: 0.95, torso: 1.06, ears: 'lion', tail: 'lion', mane: true },
};
export const DEFAULT_APP = {
  race: 'hyur', gender: 'f', height: 0.5, build: 0.5, skin: '#f0d2b8', hairStyle: 1, hairColor: '#3b2a22', eyeColor: '#3f7fc0',
  eyeShape: 0, brows: 0, mouth: 0, facePaint: 0, paintColor: '#b8323a', scaleColor: '#5d7aa8', feature: 0.5,
};
export const JOB_GEAR = {
  gla: { top: '#8c6c4c', top2: '#d8d0bc', pants: '#4a3b30', boots: '#3a2a1e', gloves: '#5b4131', accent: '#a8322c', metal: '#c0c4cc', shoulder: 'metal', tabard: true, belt: '#3b2a1c', weapon: 'sword', shield: true },
  mrd: { top: '#6b4a36', top2: '#8a6040', pants: '#3a3028', boots: '#2e2419', gloves: '#3e2c20', accent: '#7a2a1a', metal: '#8a8d93', shoulder: 'fur', belt: '#2a1c12', weapon: 'axe' },
  lnc: { top: '#2f4f7a', top2: '#c8b27a', pants: '#303848', boots: '#2a2a33', gloves: '#2a2a33', accent: '#c9a74f', metal: '#b0b6c0', shoulder: 'metal', tabard: true, belt: '#3b2a1c', weapon: 'spear' },
  arc: { top: '#4f6b3a', top2: '#9a8a60', pants: '#5a4a33', boots: '#3a2d20', gloves: '#5a4028', accent: '#a0b860', metal: '#9a8a70', belt: '#4a3420', weapon: 'bow', scarf: '#a0b860' },
  cnj: { robe: '#ece6d4', top: '#ece6d4', top2: '#6a9a58', pants: '#8a7a5a', boots: '#6a5030', gloves: '#ece6d4', accent: '#5a8a4a', belt: '#6a8a4a', weapon: 'cane', hood: '#5a8a4a' },
  thm: { robe: '#2e2238', top: '#2e2238', top2: '#6a4a7a', pants: '#221a22', boots: '#221a22', gloves: '#3a2a3a', accent: '#b0404a', belt: '#8a6a3a', weapon: 'scepter', hood: '#2e2238' },
};

function shade(hex, amt) { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, h.s, clamp(h.l + amt, 0, 1)); return '#' + c.getHexString(); }
const GEO = new Map();
function cg(k, fn) { let g = GEO.get(k); if (!g) { g = fn(); GEO.set(k, g); } return g; }
const r3 = (v) => Math.round(v * 1000);
const capsule = (r, len) => cg(`c${r3(r)}_${r3(len)}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 5, 12));
const sphere = (r, ws = 18, hs = 12) => cg(`s${r3(r)}_${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
const cyl = (r1, r2, h, s = 12, open = false) => cg(`y${r3(r1)}_${r3(r2)}_${r3(h)}_${s}_${open}`, () => new THREE.CylinderGeometry(r1, r2, h, s, 1, open));
const cone = (r, h, s = 12) => cg(`o${r3(r)}_${r3(h)}_${s}`, () => new THREE.ConeGeometry(r, h, s));
const box = (w, h, d) => cg(`b${r3(w)}_${r3(h)}_${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
const torus = (r, t, arc = PI * 2) => cg(`t${r3(r)}_${r3(t)}_${r3(arc)}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc));

function headGeometry(r) {
  const g = new THREE.SphereGeometry(r, 44, 30); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ny = y / r;
    if (ny < 0) { const t = -ny; x *= 1 - 0.3 * Math.pow(t, 1.5); z *= 1 - 0.1 * t; if (z > 0) z *= 1 + 0.05 * t; y *= 1 + 0.14 * t; }
    if (z < 0) z *= 0.94;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}
const HEAD_GEO = headGeometry(1);

// ---------- 捏脸贴图 ----------
export function drawFace(ctx, W, H, app, closed) {
  const k = W / 512; ctx.save(); ctx.scale(k, k);
  const sp = app.special, fem = app.gender === 'f';
  ctx.fillStyle = app.skin; ctx.fillRect(0, 0, 512, 256);
  const g0 = ctx.createLinearGradient(0, 0, 0, 256); g0.addColorStop(0, 'rgba(0,0,0,0.08)'); g0.addColorStop(0.45, 'rgba(0,0,0,0)'); g0.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, 512, 256);
  const cx = 128, ey = 138;
  if (sp === 'sahagin') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#e8d24a'; ctx.beginPath(); ctx.arc(cx + s * 34, 132, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(cx + s * 34, 132, 3, 8, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,40,30,0.5)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + s * (52 + i * 6), 150); ctx.lineTo(cx + s * (50 + i * 6), 170); ctx.stroke(); }
    }
    ctx.strokeStyle = '#1b2a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 30, 178); ctx.quadraticCurveTo(cx, 186, cx + 30, 178); ctx.stroke();
    ctx.fillStyle = '#eee'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 8 - 3, 180); ctx.lineTo(cx + i * 8, 188); ctx.lineTo(cx + i * 8 + 3, 180); ctx.fill(); }
    for (let i = 0; i < 200; i++) { ctx.fillStyle = 'rgba(20,60,50,0.25)'; ctx.beginPath(); ctx.arc(Math.random() * 512, Math.random() * 256, 3, 0, PI); ctx.fill(); }
    ctx.restore(); return;
  }
  // 腮红
  for (const s of [-1, 1]) {
    const g = ctx.createRadialGradient(cx + s * 32, 160, 1, cx + s * 32, 160, 16);
    g.addColorStop(0, 'rgba(255,110,110,0.22)'); g.addColorStop(1, 'rgba(255,110,110,0)'); ctx.fillStyle = g; ctx.fillRect(cx + s * 32 - 18, 142, 36, 36);
  }
  // 敖龙族鳞片
  if (app.race === 'aura') {
    for (const s of [-1, 1]) for (let i = 0; i < 16; i++) {
      const x = cx + s * (44 + (i % 4) * 5 + Math.floor(i / 4) * 2), y = 118 + Math.floor(i / 4) * 11 + (i % 2) * 4;
      const g = ctx.createLinearGradient(x, y - 5, x, y + 5); g.addColorStop(0, shade(app.scaleColor, 0.18)); g.addColorStop(1, shade(app.scaleColor, -0.12));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.fill();
    }
  }
  // 面部彩绘
  const pc = app.paintColor; ctx.strokeStyle = pc; ctx.fillStyle = pc; ctx.lineCap = 'round';
  if (app.facePaint === 1) { ctx.lineWidth = 3; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + s * 36, 150 + i * 7); ctx.lineTo(cx + s * 52, 147 + i * 8); ctx.stroke(); } }
  if (app.facePaint === 2) { ctx.lineWidth = 3.5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 36, 142); ctx.quadraticCurveTo(cx + s * 46, 150, cx + s * 44, 172); ctx.stroke(); } }
  if (app.facePaint === 3) { ctx.beginPath(); ctx.moveTo(cx, 92); ctx.lineTo(cx + 6, 102); ctx.lineTo(cx, 112); ctx.lineTo(cx - 6, 102); ctx.fill(); }
  if (app.facePaint === 4) { ctx.fillStyle = 'rgba(150,80,50,0.55)'; for (let i = 0; i < 26; i++) { const s = i % 2 ? 1 : -1; ctx.beginPath(); ctx.arc(cx + s * (10 + Math.random() * 24), 148 + Math.random() * 12, 1.2, 0, 7); ctx.fill(); } }
  if (app.facePaint === 5) { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, 178); ctx.lineTo(cx, 205); ctx.stroke(); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 20, 104); ctx.lineTo(cx + s * 34, 112); ctx.stroke(); } }
  // 眼睛
  const slit = app.race === 'miqote' || app.race === 'hrothgar';
  const es = app.race === 'lalafell' ? 1.2 : 1, shp = [1, 0.74, 1.14][app.eyeShape || 0];
  for (const s of [-1, 1]) {
    const ex = cx + s * 24, rx = 12.5 * es, ry = 13.5 * es * shp, rot = s * -0.08;
    if (app.eyepatch && s === 1) {
      ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.ellipse(ex, ey, rx + 3, ry + 3, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - rx, ey - 6); ctx.lineTo(ex + 80, ey - 30); ctx.moveTo(ex - rx, ey - 6); ctx.lineTo(cx - 60, ey - 36); ctx.stroke();
      continue;
    }
    if (closed) {
      ctx.strokeStyle = '#2a1812'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ex, ey + 2, rx, ry * 0.35, rot, 0.08 * PI, 0.92 * PI); ctx.stroke();
    } else {
      ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, rot, 0, PI * 2); ctx.fillStyle = '#fbf7f2'; ctx.fill(); ctx.clip();
      const ix = ex + s * 0.8, iy = ey + 1.5, irx = rx * 0.74, iry = ry * 0.88;
      const g = ctx.createRadialGradient(ix, iy + 3, 1, ix, iy, iry);
      g.addColorStop(0, shade(app.eyeColor, 0.25)); g.addColorStop(0.55, app.eyeColor); g.addColorStop(1, shade(app.eyeColor, -0.25));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ix, iy, irx, iry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = shade(app.eyeColor, -0.35); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#0d0808'; ctx.beginPath(); ctx.ellipse(ix, iy + 0.5, slit ? 1.8 : irx * 0.42, slit ? iry * 0.82 : iry * 0.45, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(ix - 3.5, iy - 5, 3.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ix + 3, iy + 5, 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(70,40,30,0.22)'; ctx.fillRect(ex - rx, ey - ry, rx * 2, ry * 0.4);
      ctx.restore();
      ctx.strokeStyle = '#21140f'; ctx.lineWidth = fem ? 3.6 : 2.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(ex, ey + 0.5, rx + 1, ry + 0.6, rot, PI * 1.06, PI * 1.94); ctx.stroke();
      if (fem) { ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(ex + s * (rx - 1), ey - ry * 0.45); ctx.lineTo(ex + s * (rx + 5), ey - ry * 0.75); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(60,35,30,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, rot, 0.2 * PI, 0.8 * PI); ctx.stroke();
    }
    // 眉毛
    const by = ey - ry - 7 * es, bt = [2.6, 4.2, 1.8][app.brows || 0];
    ctx.strokeStyle = shade(app.hairColor, -0.08); ctx.lineWidth = bt; ctx.beginPath();
    ctx.moveTo(ex - s * rx * 0.9, by + 3 + (app.brows === 2 ? -2 : 0)); ctx.quadraticCurveTo(ex, by - (app.brows === 1 ? 1 : 4), ex + s * rx * 1.1, by + 2); ctx.stroke();
  }
  // 鼻与嘴
  if (app.race !== 'hrothgar') {
    ctx.fillStyle = 'rgba(130,70,60,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 1, 153, 2.2, 1.3, 0, 0, 7); ctx.fill();
    const my = app.race === 'lalafell' ? 166 : 170;
    ctx.strokeStyle = '#8a4a44'; ctx.lineWidth = 1.8;
    if (app.mouth === 1) { ctx.beginPath(); ctx.moveTo(cx - 5, my); ctx.lineTo(cx + 5, my); ctx.stroke(); }
    else if (app.mouth === 2) { ctx.fillStyle = '#7a2f33'; ctx.beginPath(); ctx.moveTo(cx - 7, my - 1); ctx.quadraticCurveTo(cx, my + 9, cx + 7, my - 1); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(cx - 5, my - 1, 10, 2); }
    else { ctx.beginPath(); ctx.moveTo(cx - 6, my - 1); ctx.quadraticCurveTo(cx, my + 4, cx + 6, my - 1); ctx.stroke(); }
    if (fem) { ctx.fillStyle = 'rgba(200,90,100,0.25)'; ctx.beginPath(); ctx.ellipse(cx, my + 2, 5, 2, 0, 0, 7); ctx.fill(); }
  }
  if (app.beard) {
    ctx.fillStyle = app.hairColor;
    ctx.beginPath(); ctx.moveTo(cx - 40, 150); ctx.quadraticCurveTo(cx - 44, 215, cx, 235); ctx.quadraticCurveTo(cx + 44, 215, cx + 40, 150);
    ctx.lineTo(cx + 30, 160); ctx.quadraticCurveTo(cx, 190, cx - 30, 160); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 18, 166); ctx.quadraticCurveTo(cx, 158, cx + 18, 166); ctx.quadraticCurveTo(cx, 164, cx - 18, 166); ctx.lineWidth = 5; ctx.strokeStyle = app.hairColor; ctx.stroke();
  }
  ctx.restore();
}

function stdMat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.75, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, flatShading: !!o.flat, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, transparent: !!o.t, opacity: o.o ?? 1 });
}

// ---------- 武器 ----------
export function buildWeapon(type, gear = {}, mk = stdMat) {
  const g = new THREE.Group();
  const metal = mk(gear.metal || '#c3c7cf', { r: 0.3, m: 0.85 }), gold = mk('#c9a44f', { r: 0.35, m: 0.9 }), leather = mk('#4a3222', { r: 0.9 }), wood = mk('#6b4a2e', { r: 0.8 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  if (type === 'sword' || type === 'gunblade' || type === 'cutlass') {
    add(cyl(0.02, 0.02, 0.2), leather, 0, 0, 0); add(sphere(0.032), gold, 0, -0.11, 0);
    add(box(type === 'cutlass' ? 0.16 : 0.24, 0.035, 0.05), gold, 0, 0.11, 0);
    const bw = type === 'gunblade' ? 0.08 : 0.06, bl = type === 'cutlass' ? 0.66 : 0.8;
    add(box(bw, bl, 0.014), type === 'gunblade' ? mk('#3a3d44', { r: 0.35, m: 0.8 }) : metal, 0, 0.13 + bl / 2, 0, 0, 0, type === 'cutlass' ? 0.08 : 0);
    add(cone(bw * 0.7, 0.12, 4), metal, type === 'cutlass' ? -0.05 : 0, 0.19 + bl, 0, 0, PI / 4, type === 'cutlass' ? 0.08 : 0, 1, 1, 0.3);
    if (type === 'gunblade') add(cyl(0.045, 0.045, 0.07, 10), mk('#555a63', { r: 0.4, m: 0.9 }), 0, 0.18, 0, 0, 0, PI / 2);
    if (type === 'cutlass') add(sphere(0.07, 12, 8), gold, 0, 0.08, 0.02, 0, 0, 0, 1, 0.6, 0.6);
  } else if (type === 'axe') {
    add(cyl(0.024, 0.028, 1.2), wood, 0, 0.35, 0);
    const sh = new THREE.Shape(); sh.moveTo(0, -0.12); sh.lineTo(0.28, -0.27); sh.quadraticCurveTo(0.4, 0, 0.28, 0.27); sh.lineTo(0, 0.12); sh.lineTo(0, -0.12);
    const eg = cg('axehead', () => { const e = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }); e.translate(0, 0, -0.015); return e; });
    add(eg, metal, 0.02, 0.82, 0); add(cone(0.035, 0.18, 6), metal, -0.1, 0.82, 0, 0, 0, PI / 2);
    add(cyl(0.035, 0.035, 0.1), gold, 0, 0.82, 0);
  } else if (type === 'spear' || type === 'trident') {
    add(cyl(0.018, 0.022, 1.95), wood, 0, 0.45, 0); add(cyl(0.03, 0.03, 0.07), gold, 0, 1.4, 0);
    if (type === 'trident') { for (const x of [-0.07, 0, 0.07]) add(cone(0.02, 0.26, 4), metal, x, 1.58, 0); add(box(0.18, 0.03, 0.03), metal, 0, 1.45, 0); }
    else { add(cone(0.05, 0.32, 4), metal, 0, 1.6, 0, 0, PI / 4, 0, 1, 1, 0.45); add(cone(0.04, 0.1, 8), mk('#a8322c'), 0, 1.33, 0, PI, 0, 0); }
  } else if (type === 'bow') {
    const arc = add(torus(0.55, 0.02, PI * 0.9), wood, 0, 0, -0.55, 0, -PI / 2, -0.45 * PI);
    arc.rotation.order = 'XYZ';
    add(cyl(0.004, 0.004, 1.09, 4), mk('#e8e0cc'), 0, 0, -0.47);
    add(cyl(0.03, 0.03, 0.14), leather, 0, 0, 0);
  } else if (type === 'cane') {
    add(cyl(0.02, 0.03, 1.5), wood, 0, 0.3, 0); add(torus(0.08, 0.016), wood, 0, 1.12, 0);
    add(new THREE.IcosahedronGeometry(0.055, 0), mk('#6dff9a', { e: '#2dff7a', ei: 2.2, r: 0.2 }), 0, 1.12, 0);
  } else if (type === 'scepter') {
    add(cyl(0.015, 0.02, 1.3), mk('#2a2430', { r: 0.4, m: 0.6 }), 0, 0.2, 0);
    add(new THREE.OctahedronGeometry(0.075, 0), mk('#c77dff', { e: '#9a4dff', ei: 2.4, r: 0.2 }), 0, 0.95, 0, 0, 0, 0, 1, 1.5, 1);
    for (const s of [-1, 1]) add(cone(0.02, 0.16, 4), gold, s * 0.08, 0.86, 0, 0, 0, s * -0.9);
  } else if (type === 'book') {
    add(box(0.2, 0.26, 0.05), mk('#6a2a2a'), 0, 0, 0); add(box(0.18, 0.24, 0.052), mk('#efe6cc'), 0.012, 0, 0);
  }
  return g;
}
export function buildShield(gear, mk = stdMat) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); };
  add(cyl(0.3, 0.3, 0.035, 24), mk(gear.accent || '#a8322c', { r: 0.6 }), 0, 0, 0, PI / 2);
  add(torus(0.3, 0.022), mk(gear.metal || '#c0c4cc', { r: 0.3, m: 0.85 }), 0, 0, 0);
  add(sphere(0.06, 12, 8), mk('#c9a44f', { r: 0.3, m: 0.9 }), 0, 0, 0.03);
  return g;
}

const DRAWN = { sword: ['R', [0, -0.07, 0.02], [PI / 2, 0, 0]], gunblade: ['R', [0, -0.07, 0.02], [PI / 2, 0, 0]], cutlass: ['R', [0, -0.07, 0.02], [PI / 2, 0, 0]], axe: ['R', [0, -0.07, 0], [PI / 2, 0, 0]], spear: ['R', [0, -0.07, 0], [PI / 2, 0, 0]], trident: ['R', [0, -0.07, 0], [PI / 2, 0, 0]], bow: ['L', [0, -0.07, 0], [PI / 2, 0, 0]], cane: ['R', [0, -0.06, 0.03], [0.1, 0, 0]], scepter: ['R', [0, -0.06, 0.03], [0.1, 0, 0]], book: ['L', [0, -0.12, 0.05], [0.3, 0, 0]] };
const SHEATH = { sword: [[0.06, 0.05, -0.16], [0, 0, PI + 0.28]], gunblade: [[0.06, 0.05, -0.16], [0, 0, PI + 0.28]], cutlass: [[0.12, -0.2, -0.1], [0, 0, PI - 0.2]], axe: [[0, -0.05, -0.19], [0, 0, -0.6]], spear: [[0, -0.1, -0.18], [0, 0, 0.7]], trident: [[0, -0.1, -0.18], [0, 0, 0.7]], bow: [[0, 0.05, -0.17], [0, PI, 0.35]], cane: [[0, -0.05, -0.17], [0, 0, 0.6]], scepter: [[0, -0.05, -0.17], [0, 0, 0.6]], book: [[0.2, -0.3, 0], [0, PI / 2, 0]] };

const JOINTS = ['body', 'hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR', 'thL', 'knL', 'ftL', 'thR', 'knR', 'ftR'];

// ---------- 人形角色 ----------
export class Humanoid {
  constructor(app, gear, opts = {}) {
    this.root = new THREE.Group(); this.opts = opts;
    this.t = Math.random() * 10; this.phase = 0; this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    this.act = null; this.loop = null; this.loopW = 0; this.drawn = false; this.dead = false; this.deadT = 0; this.mounted = false; this.opacity = 1;
    this.P = {}; this.T = {}; for (const k of JOINTS) { this.P[k] = [0, 0, 0]; this.T[k] = [0, 0, 0]; }
    this.build(app, gear);
  }
  mk(color, o) { const m = stdMat(color, o); this.mats.push(m); return m; }
  dispose() {
    for (const m of this.mats || []) { if (m.map && m.map.userData.own) m.map.dispose(); m.dispose(); }
    this.faceTex && this.faceTex.forEach((t) => t.dispose());
    for (const g of this.ownGeo || []) g.dispose();
  }
  build(app, gear) {
    this.dispose(); this.mats = []; this.ownGeo = [];
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    app = this.app = { ...DEFAULT_APP, ...app }; gear = this.gear = { ...(gear || JOB_GEAR.gla) };
    const rb = RACE_BODY[app.race] || RACE_BODY.hyur, fem = app.gender === 'f';
    const w = (fem ? rb.w[1] : rb.w[0]) * (0.9 + app.build * 0.2); this.w = w;
    const L = rb.leg, T = rb.torso, Hs = rb.head, A = (L + T) / 2;
    const thigh = 0.43 * L, shin = 0.42 * L, footH = 0.07;
    const hipY = thigh + shin + footH, spineLen = 0.2 * T, chestLen = 0.3 * T, neckLen = 0.075 * T, headR = 0.118 * Hs;
    const total = hipY + spineLen + chestLen + neckLen + headR * 2.05;
    const targetH = (app.fixedHeight || (fem ? rb.h[1] : rb.h[0]) * (0.92 + app.height * 0.16));
    const s = targetH / total; this.scale = s; this.height = targetH; this.hipY = hipY; this.headR = headR;
    this.root.scale.setScalar(s);
    const skin = this.mk(app.skin, { r: 0.6 }), hair = this.mk(app.hairColor, { r: 0.5, ds: true });
    const top = this.mk(gear.top || '#777', { r: 0.85 }), top2 = this.mk(gear.top2 || gear.top || '#999', { r: 0.85 }), pants = this.mk(gear.pants || '#444', { r: 0.9 });
    const boots = this.mk(gear.boots || '#332', { r: 0.7 }), gloves = this.mk(gear.gloves || '#433', { r: 0.8 }), accent = this.mk(gear.accent || '#933', { r: 0.8, ds: true });
    const metal = this.mk(gear.metal || '#bbb', { r: 0.3, m: 0.85 }), belt = this.mk(gear.belt || '#3b2a1c', { r: 0.7 });
    this.hairMat = hair; this.skinMat = skin;
    const j = this.j = {};
    const J = (parent, x, y, z, name) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); j[name] = g; return g; };
    const P = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };
    const bare = gear.bare, sahagin = app.special === 'sahagin';
    const body = J(this.root, 0, 0, 0, 'body');
    const hips = J(body, 0, hipY, 0, 'hips');
    P(hips, sphere(1), pants, 0, -0.02, 0, 0, 0, 0, 0.15 * w, 0.11, 0.11 * w);
    const spine = J(hips, 0, 0.02, 0, 'spine');
    // 躯干（车削曲面）
    const TT = spineLen + chestLen, prof = fem
      ? [[0.001, 0], [0.13, 0], [0.12, 0.08], [0.112, 0.17], [0.15, 0.3], [0.158, 0.36], [0.148, 0.43], [0.09, 0.48], [0.045, 0.5], [0.001, 0.5]]
      : [[0.001, 0], [0.13, 0], [0.13, 0.07], [0.142, 0.17], [0.168, 0.29], [0.178, 0.37], [0.162, 0.44], [0.1, 0.485], [0.05, 0.5], [0.001, 0.5]];
    const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y * TT / 0.5)), 20); this.ownGeo.push(lg);
    P(spine, lg, bare || sahagin ? skin : top, 0, 0, 0, 0, 0, 0, w, 1, 0.66 * w);
    if (fem && !sahagin) for (const sx of [-1, 1]) P(spine, sphere(0.05), bare ? skin : top, sx * 0.055 * w, TT * 0.66, 0.072 * w, 0, 0, 0, 1.05, 0.85, 0.7);
    if (bare && !sahagin) P(spine, cyl(0.11 * w, 0.13 * w, 0.06, 14), top, 0, TT * 0.8, -0.01, 0.1, 0, 0, 1, 1, 0.7); // 皮毛披肩底
    P(hips, torus(0.135 * w, 0.022), belt, 0, 0.035, 0, PI / 2, 0, 0, 1, 0.68, 1);
    const chest = J(spine, 0, spineLen, 0, 'chest');
    if (gear.tabard) { const tg = cyl(0.001, 0.001, 0.001); void tg; P(hips, box(0.17 * w, 0.36, 0.012), accent, 0, -0.17, 0.1 * w + 0.01, 0.06); P(hips, box(0.17 * w, 0.3, 0.012), accent, 0, -0.15, -0.1 * w - 0.01, -0.06); }
    if (gear.robe) {
      const rl = hipY * 0.86; const rg = new THREE.LatheGeometry([[0.001, 0.04], [0.14, 0.04], [0.17, -0.1], [0.24, -rl * 0.6], [0.3, -rl], [0.001, -rl]].map(([r, y]) => new THREE.Vector2(r, y)), 22); this.ownGeo.push(rg);
      P(hips, rg, top, 0, 0, 0, 0, 0, 0, w, 1, 0.85 * w);
      P(hips, torus(0.3, 0.015), accent, 0, -rl + 0.02, 0, PI / 2, 0, 0, w, 0.85 * w, 1);
      P(spine, box(0.05 * w, TT * 0.9, 0.01), accent, 0, TT * 0.45, 0.115 * w);
    }
    if (gear.hood) { const hg = new THREE.SphereGeometry(0.16, 16, 10, 0, PI * 2, PI * 0.35, PI * 0.5); this.ownGeo.push(hg); P(chest, hg, this.mk(gear.hood, { r: 0.9, ds: true }), 0, chestLen - 0.02, -0.08 * w, 0.4, 0, 0, w, 1, 0.8); }
    if (gear.scarf) P(chest, torus(0.075 * w, 0.03), this.mk(gear.scarf, { r: 0.9 }), 0, chestLen - 0.02, 0.005, PI / 2 + 0.15, 0, 0);
    const neck = J(chest, 0, chestLen, 0, 'neck');
    P(neck, cyl(0.042, 0.05, neckLen + 0.04), skin, 0, neckLen / 2, 0);
    const head = J(neck, 0, neckLen + headR * 0.86, 0, 'head');
    // 脸部贴图
    const res = this.opts.faceRes || 256, fc = canvas(res * 2, res), fc2 = canvas(res * 2, res);
    drawFace(fc.getContext('2d'), res * 2, res, app, false); drawFace(fc2.getContext('2d'), res * 2, res, app, true);
    const t1 = new THREE.CanvasTexture(fc), t2 = new THREE.CanvasTexture(fc2);
    for (const t of [t1, t2]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    this.faceTex = [t1, t2];
    const faceMat = new THREE.MeshStandardMaterial({ map: t1, roughness: 0.6 }); this.mats.push(faceMat); this.faceMat = faceMat;
    const hz = sahagin ? 1.18 : 1.02;
    P(head, HEAD_GEO, faceMat, 0, 0, 0, 0, 0, 0, headR, headR * 1.08, headR * hz);
    const r = headR;
    if (!sahagin && app.race !== 'hrothgar') P(head, sphere(0.011, 8, 6), skin, 0, -0.3 * r, 0.955 * r * hz, 0, 0, 0, 0.8, 1, 0.9);
    // 耳朵
    const ears = sahagin ? 'fin' : rb.ears, fs = 0.7 + app.feature * 0.6;
    for (const sx of [-1, 1]) {
      if (ears === 'human' || ears === 'lala') P(head, sphere(0.1, 10, 8), skin, sx * 0.98 * r, -0.1 * r, -0.05 * r, 0, 0, 0, 0.28 * r * 10, 0.5 * r * 10, 0.22 * r * 10);
      if (ears === 'lala') P(head, cone(0.25 * r, 0.6 * r, 8), skin, sx * 1.1 * r, 0.02 * r, -0.05 * r, 0, 0, sx * -(PI / 2 - 0.35));
      if (ears === 'elf') P(head, cone(0.18 * r, 1.2 * r * fs, 8), skin, sx * 1.25 * r, 0.05 * r, -0.1 * r, 0, 0, sx * -(PI / 2 - 0.3), 1, 1, 0.5);
      if (ears === 'cat') { P(head, cone(0.36 * r, 0.8 * r * fs, 12), hair, sx * 0.55 * r, 0.95 * r, -0.05 * r, 0, 0, sx * -0.35, 1, 1, 0.55); P(head, cone(0.22 * r, 0.55 * r * fs, 10), this.mk('#e8a8a0'), sx * 0.53 * r, 0.92 * r, 0.06 * r, 0, 0, sx * -0.35, 1, 1, 0.3); }
      if (ears === 'bunny') { const e = P(head, capsule(0.24 * r, 2.0 * r * fs), hair, sx * 0.38 * r, 1.0 * r + r * fs, -0.15 * r, -0.2, 0, sx * -0.14, 1, 1, 0.42); e.position.y = 0.95 * r + fs * r; }
      if (ears === 'lion') P(head, sphere(0.22 * r, 10, 8), hair, sx * 0.7 * r, 0.8 * r, -0.1 * r, 0, 0, 0, 1, 1, 0.5);
      if (ears === 'fin') P(head, cone(0.35 * r, 0.9 * r, 4), this.mk('#2d6b62', { ds: true }), sx * 1.05 * r, 0, -0.1 * r, 0, 0, sx * -(PI / 2 - 0.5), 1, 1, 0.15);
    }
    if (sahagin) for (let i = 0; i < 3; i++) P(head, cone(0.28 * r, 0.9 * r - i * 0.15 * r, 4), this.mk('#2d6b62'), 0, 0.9 * r, (0.4 - i * 0.55) * r, -0.3 - i * 0.2, 0, 0, 0.15, 1, 1);
    if (rb.horns) for (const sx of [-1, 1]) {
      const hm = this.mk('#26262c', { r: 0.25, m: 0.3 });
      P(head, cone(0.16 * r, 1.4 * r * fs, 10), hm, sx * 0.62 * r, 0.62 * r, -0.05 * r, -1.2, 0, sx * -0.35);
    }
    if (rb.mane) { P(head, sphere(0.1 * 10 * r * 0.13, 12, 8), skin, 0, -0.25 * r, 0.9 * r, 0, 0, 0, 3.2, 2.2, 3); P(head, sphere(0.02 * 10 * r * 0.1, 8, 6), this.mk('#2a1a18'), 0, -0.12 * r, 1.25 * r, 0, 0, 0, 5, 3, 3); }
    // 头发
    this.buildHair(head, r, hair, app, P, sahagin, rb);
    // 特殊头饰
    if (app.hat === 'tricorne') {
      const hm = this.mk('#1c1a20', { r: 0.8 });
      P(head, cyl(1.5 * r, 1.6 * r, 0.25 * r, 3), hm, 0, 0.72 * r, -0.05 * r, 0, PI, 0);
      P(head, cyl(0.85 * r, 1.0 * r, 0.8 * r, 16), hm, 0, 0.98 * r, -0.05 * r);
      P(head, torus(1.02 * r, 0.05 * r), this.mk('#c9a44f', { m: 0.8, r: 0.3 }), 0, 0.72 * r, -0.05 * r, PI / 2);
    }
    if (app.hat === 'bandana') { const bg = new THREE.SphereGeometry(r * 1.07, 20, 10, 0, PI * 2, 0, PI * 0.5); this.ownGeo.push(bg); P(head, bg, this.mk(app.bandanaColor || '#a8322c', { r: 0.9, ds: true }), 0, 0.02 * r, -0.02 * r, -0.35); P(head, sphere(0.2 * r), this.mk(app.bandanaColor || '#a8322c'), 0, 0.2 * r, -1.02 * r); }
    // 手臂
    const shX = 0.19 * w * (fem ? 0.9 : 1), upper = 0.3 * A, fore = 0.27 * A;
    this.fore = fore;
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const sh = J(chest, sx * shX, chestLen - 0.055, 0, 'sh' + side);
      P(sh, sphere(0.064 * w), bare || sahagin ? skin : top, 0, -0.01, 0);
      if (gear.shoulder === 'metal') { const pg = cg('pad', () => new THREE.SphereGeometry(0.1, 14, 8, 0, PI * 2, 0, PI / 2)); P(sh, pg, metal, sx * 0.012, 0.0, 0, 0, 0, sx * -0.35, w, 0.8, w); }
      if (gear.shoulder === 'fur') P(sh, sphere(0.085 * w, 10, 8), this.mk('#8a7358', { r: 1, flat: true }), sx * 0.01, 0.02, 0, 0, 0, 0, 1.1, 0.8, 1.1);
      P(sh, capsule(0.047 * w, upper - 0.06), bare || sahagin ? skin : (gear.robe ? top : top2), 0, -upper / 2, 0);
      const el = J(sh, 0, -upper, 0, 'el' + side);
      P(el, capsule(0.041 * w, fore - 0.05), gear.robe ? top : (bare || sahagin ? skin : gloves), 0, -fore / 2, 0);
      if (gear.robe) P(el, cyl(0.05 * w, 0.075 * w, fore * 0.7, 12, true), this.mk(gear.top, { ds: true }), 0, -fore * 0.55, 0);
      const hand = J(el, 0, -fore, 0, 'hand' + side);
      P(hand, sphere(0.043), sahagin ? skin : (gear.robe ? skin : gloves), 0, -0.035, 0.005, 0, 0, 0, 0.95 * w, 1.2, 0.62 * w);
    }
    // 腿
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const th = J(hips, sx * 0.088 * w, -0.03, 0, 'th' + side);
      P(th, capsule(0.074 * w * (fem ? 0.96 : 1), thigh - 0.1), pants, 0, -thigh / 2, 0);
      const kn = J(th, 0, -thigh, 0, 'kn' + side);
      P(kn, capsule(0.056 * w, shin - 0.08), pants, 0, -shin / 2, 0);
      P(kn, capsule(0.064 * w, shin * 0.45), boots, 0, -shin * 0.68, 0);
      const ft = J(kn, 0, -shin, 0, 'ft' + side);
      P(ft, box(0.095 * w, footH, 0.2 * Math.max(0.8, L)), boots, 0, -footH / 2, 0.045);
    }
    // 尾巴
    this.tail = [];
    const tk = sahagin ? null : rb.tail; this.tailKind = tk;
    if (tk) {
      const n = tk === 'cat' ? 8 : 7, len = (tk === 'dragon' ? 0.12 : tk === 'lion' ? 0.1 : 0.085) * (0.8 + app.feature * 0.4);
      const r0 = tk === 'dragon' ? 0.075 : tk === 'lion' ? 0.04 : 0.028;
      const tm = tk === 'dragon' ? this.mk(shade(app.scaleColor, -0.15), { r: 0.4, m: 0.2 }) : hair;
      let parent = J(hips, 0, -0.02, -0.1 * w, 'tail0'); this.tail.push(parent); parent.rotation.x = -2.25;
      for (let i = 0; i < n; i++) {
        const rr = r0 * (1 - i / n * 0.75);
        P(parent, capsule(rr, len), tm, 0, len / 2, 0);
        const nx = new THREE.Group(); nx.position.y = len; parent.add(nx); this.tail.push(nx); parent = nx;
      }
      if (tk === 'lion') P(parent, sphere(0.05, 8, 6), this.mk(shade(app.hairColor, -0.1)), 0, 0.03, 0);
    }
    // 武器
    this.weaponType = gear.weapon;
    this.weapon = gear.weapon ? buildWeapon(gear.weapon, gear, (c, o) => this.mk(c, o)) : null;
    this.shield = gear.shield ? buildShield(gear, (c, o) => this.mk(c, o)) : null;
    this.chestLen = chestLen;
    this.setDrawn(this.drawn, true);
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  buildHair(head, r, hair, app, P, sahagin, rb) {
    this.hairJ = [];
    if (sahagin || app.hat === 'bald') return;
    const st = app.hairStyle ?? 0, S = [r * 1.08, r * 1.11, r * 1.07];
    // 头顶发冠 + 留出脸部开口的侧后发壳，保证刘海与鬓发不会遮住眼睛
    const crown = (t = 0.34) => P(head, cg('hcrown' + t, () => new THREE.SphereGeometry(1, 32, 10, 0, PI * 2, 0, PI * t)), hair, 0, 0.01 * r, -0.01 * r, 0, 0, 0, ...S);
    const shell = (a0, a1, h = 0.95) => P(head, cg(`hshell${a0}_${a1}_${h}`, () => new THREE.SphereGeometry(1, 32, 14, PI / 2 + h, PI * 2 - 2 * h, PI * a0, PI * (a1 - a0))), hair, 0, 0.01 * r, -0.01 * r, 0, 0, 0, ...S);
    const lock = (ang, y, len, w = 0.2, tilt = -0.3) => { const m = P(head, sphere(1, 12, 8), hair, Math.sin(ang) * 1.0 * r, y * r, Math.cos(ang) * 1.03 * r, 0, 0, 0, w * r, len * r, 0.09 * r); m.rotation.order = 'YXZ'; m.rotation.set(tilt, ang, 0); return m; };
    const bangs = (n, len = 0.3, spread = 0.62) => { for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; lock(t * spread, 0.38 + (1 - Math.abs(t)) * 0.02, len * (1 - Math.abs(t) * 0.25)); } };
    const sides = (len) => { for (const sx of [-1, 1]) lock(sx * 1.05, 0.12 - len * 0.35, len * 0.6, 0.2, -0.05); };
    const sway = (parentObj, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parentObj.add(g); this.hairJ.push(g); return g; };
    if (app.hat === 'tricorne') { shell(0.3, 0.62); return; }
    if (rb.mane) {
      crown(0.38); shell(0.3, 0.72, 0.9);
      P(head, torus(0.95 * r, 0.3 * r), hair, 0, -0.7 * r, -0.1 * r, PI / 2, 0, 0, 1, 1, 0.8); for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; if (Math.sin(a) > 0.55) continue; P(head, cone(0.38 * r, 1.35 * r, 6), hair, Math.cos(a) * 0.95 * r, -0.2 * r, Math.sin(a) * 0.95 * r - 0.1 * r, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); }
      return;
    }
    switch (st) {
      case 0: crown(); shell(0.3, 0.62); bangs(5, 0.28); sides(0.3); break;
      case 1: { crown(); shell(0.3, 0.68); bangs(5, 0.3); sides(0.9); const bg = cg('hback', () => new THREE.CylinderGeometry(1.04, 1.2, 1, 20, 1, true, PI * 0.5, PI)); P(head, bg, hair, 0, -1.0 * r, -0.08 * r, 0, 0, 0, r, 2.2 * r, r * 0.95); break; }
      case 2: { crown(); shell(0.3, 0.6); bangs(5, 0.28); sides(0.4); P(head, sphere(0.2 * r), this.mk('#c9a44f', { m: 0.6, r: 0.4 }), 0, 0.45 * r, -1.02 * r); const s = sway(head, 0, 0.45 * r, -1.05 * r); P(s, cone(0.3 * r, 1.9 * r, 12), hair, 0, -0.9 * r, -0.12 * r, PI - 0.15); break; }
      case 3: { crown(); shell(0.3, 0.6); bangs(5, 0.28); sides(0.3); for (const sx of [-1, 1]) { const s = sway(head, sx * 0.8 * r, 0.45 * r, -0.5 * r); P(s, sphere(0.16 * r), this.mk('#e05a7a'), 0, 0, 0); P(s, cone(0.26 * r, 1.7 * r, 12), hair, sx * 0.1 * r, -0.85 * r, -0.05 * r, PI, 0, sx * 0.15); } break; }
      case 4: crown(0.36); shell(0.3, 0.8, 0.82); bangs(7, 0.32, 0.72); sides(0.6); break;
      case 5: crown(0.4); shell(0.3, 0.55); for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2, e = 0.5 + (i % 3) * 0.25; if (Math.sin(a) > 0.6 && e < 0.8) continue; P(head, cone(0.2 * r, 0.8 * r, 6), hair, Math.cos(a) * 0.75 * r * Math.cos(e), Math.sin(e) * 0.9 * r, Math.sin(a) * 0.75 * r * Math.cos(e) - 0.1 * r, Math.sin(a) * (PI / 2 - e), 0, -Math.cos(a) * (PI / 2 - e)); } bangs(3, 0.24); break;
      case 6: crown(); shell(0.3, 0.6); bangs(5, 0.28); sides(0.45); P(head, sphere(0.42 * r), hair, 0, 0.75 * r, -0.8 * r); break;
      case 7: crown(0.42); shell(0.3, 0.6, 1.0); break;
      default: crown(); shell(0.3, 0.6);
    }
  }
  setDrawn(d, force) {
    if (this.drawn === d && !force) return; this.drawn = d;
    const w = this.weapon, type = this.weaponType; if (!w) return;
    const j = this.j;
    if (d && DRAWN[type]) { const [h, p, r] = DRAWN[type]; (h === 'R' ? j.handR : j.handL).add(w); w.position.set(...p); w.rotation.set(...r); }
    else if (SHEATH[type]) { const [p, r] = SHEATH[type]; j.chest.add(w); w.position.set(p[0], this.chestLen * 0.55 + p[1], p[2] * this.w); w.rotation.set(...r); }
    if (this.shield) {
      if (d) { j.elL.add(this.shield); this.shield.position.set(0.07 * this.w, -this.fore * 0.5, 0.02); this.shield.rotation.set(0, PI / 2, 0); }
      else { j.chest.add(this.shield); this.shield.position.set(0, this.chestLen * 0.5, -0.2 * this.w); this.shield.rotation.set(0, 0, 0); }
    }
  }
  play(name, dur = 0.6) { this.act = { name, t: 0, dur }; }
  setLoop(name) { if (this.loop !== name) { this.loop = name; this.loopT = 0; } }
  setDead(d) { this.dead = d; this.deadT = 0; }
  setOpacity(a) {
    if (Math.abs(a - this.opacity) < 0.001) return;
    const tr = a < 0.999; for (const m of this.mats) { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; }
    this.opacity = a;
  }
  update(dt, st = {}) {
    this.t += dt; const P = this.P, T = this.T, j = this.j;
    for (const k of JOINTS) { const a = P[k]; a[0] = a[1] = a[2] = 0; }
    let hipDy = 0, bodyRX = 0, bodyY = 0, bodyRY = 0;
    const br = Math.sin(this.t * 1.7);
    P.shL[2] = 0.12 + br * 0.015; P.shR[2] = -0.12 - br * 0.015; P.elL[0] = -0.15; P.elR[0] = -0.15; P.chest[0] = br * 0.015;
    const sp = st.speed || 0;
    if (this.mounted) {
      P.thL[0] = -1.25; P.thR[0] = -1.25; P.thL[2] = 0.55; P.thR[2] = -0.55; P.knL[0] = 1.5; P.knR[0] = 1.5;
      P.shL[0] = -0.7; P.shR[0] = -0.7; P.elL[0] = -0.9; P.elR[0] = -0.9; P.spine[0] = 0.12 + Math.min(sp, 12) * 0.01;
      hipDy = -this.hipY + 0.12;
    } else if (this.dead) {
      this.deadT += dt; const k = clamp(this.deadT / 0.7, 0, 1), e = 1 - Math.pow(1 - k, 3);
      bodyRX = -PI / 2 * e; bodyY = 0.12 * e / this.scale; P.shL[2] = 0.12 + 0.9 * e; P.shR[2] = -0.12 - 0.9 * e; P.knL[0] = 0.3 * e; P.head[1] = 0.4 * e;
    } else {
      const run = clamp((sp - 2.8) / 3, 0, 1), mv = clamp(sp / 1.2, 0, 1);
      this.phase += dt * sp * 1.5 / Math.max(0.5, this.scale * 1.05);
      const p = this.phase, Aa = lerp(0.5, 0.85, run) * mv, K = lerp(0.6, 1.35, run) * mv;
      P.thL[0] = -Math.sin(p) * Aa; P.thR[0] = Math.sin(p) * Aa;
      P.knL[0] = Math.max(0, Math.cos(p)) * K + 0.06 * mv; P.knR[0] = Math.max(0, -Math.cos(p)) * K + 0.06 * mv;
      P.ftL[0] = -P.knL[0] * 0.3; P.ftR[0] = -P.knR[0] * 0.3;
      P.shL[0] = Math.sin(p) * Aa * 0.85; P.shR[0] = -Math.sin(p) * Aa * 0.85;
      P.elL[0] -= lerp(0.2, 1.15, run) * mv; P.elR[0] -= lerp(0.2, 1.15, run) * mv;
      hipDy = (Math.abs(Math.cos(p)) - 0.6) * 0.05 * mv * (1 + run);
      P.hips[1] = Math.sin(p) * 0.08 * mv; P.chest[1] = -Math.sin(p) * 0.12 * mv; P.spine[0] += lerp(0.03, 0.15, run) * mv;
      if (this.drawn && mv < 0.3) this.stance(P, 1 - mv / 0.3);
      if (st.air) { P.thL[0] = -0.6; P.thR[0] = -0.2; P.knL[0] = 1.1; P.knR[0] = 0.7; P.shL[2] = 0.6; P.shR[2] = -0.6; }
      // 循环动作（咏唱 / 情感动作）
      this.loopW = clamp(this.loopW + (this.loop && mv < 0.5 ? dt * 5 : -dt * 5), 0, 1);
      if (this.loop) this.loopT = (this.loopT || 0) + dt;
      if (this.loopW > 0 && this.loop) {
        this.copyTo(T); const r = this.loopPose(T, this.loop, this.loopT); this.blend(T, this.loopW);
        if (r) hipDy = lerp(hipDy, r.hipDy || 0, this.loopW);
      }
      if (this.act) {
        const a = this.act; a.t += dt; const u = clamp(a.t / a.dur, 0, 1);
        const wgt = clamp(u / 0.12, 0, 1) * (1 - clamp((u - 0.8) / 0.2, 0, 1));
        this.copyTo(T); const r = this.actionPose(T, a.name, u); this.blend(T, wgt);
        if (r) { if (r.hipDy !== undefined) hipDy = lerp(hipDy, r.hipDy, wgt); if (r.rotY) bodyRY = r.rotY; if (r.lift) bodyY = r.lift; }
        if (a.t >= a.dur) this.act = null;
      }
    }
    // 应用
    for (const k of JOINTS) { const a = P[k], o = j[k]; if (o) o.rotation.set(a[0], a[1], a[2]); }
    j.hips.position.y = this.hipY + hipDy; j.body.rotation.x = bodyRX; j.body.rotation.y = bodyRY; j.body.position.y = bodyY;
    // 尾巴、头发摆动
    const curl = this.tailKind === 'cat' ? 0.2 : this.tailKind === 'lion' ? 0.12 : 0.05;
    for (let i = 1; i < this.tail.length; i++) { const tj = this.tail[i]; tj.rotation.x = curl + Math.sin(this.t * 2.2 - i * 0.5) * 0.05; tj.rotation.z = Math.sin(this.t * 1.6 - i * 0.6) * 0.05; }
    if (this.tail[0]) this.tail[0].rotation.x = -2.25 + Math.min(sp, 8) * 0.04;
    for (const h of this.hairJ) { h.rotation.x = 0.15 + Math.min(sp, 8) * 0.03 + Math.sin(this.t * 2.5) * 0.04; h.rotation.z = Math.sin(this.t * 1.9) * 0.05; }
    // 眨眼
    this.blinkT -= dt;
    if (this.blinkT <= 0) { if (!this.blink) { this.blink = 0.12; this.faceMat.map = this.faceTex[1]; } }
    if (this.blink) { this.blink -= dt; if (this.blink <= 0 || this.dead) { this.blink = 0; this.blinkT = 2 + Math.random() * 4; this.faceMat.map = this.faceTex[this.dead ? 1 : 0]; } }
    if (this.dead) this.faceMat.map = this.faceTex[1];
  }
  copyTo(T) { for (const k of JOINTS) { const a = this.P[k], b = T[k]; b[0] = a[0]; b[1] = a[1]; b[2] = a[2]; } }
  blend(T, w) { for (const k of JOINTS) { const a = this.P[k], b = T[k]; a[0] += (b[0] - a[0]) * w; a[1] += (b[1] - a[1]) * w; a[2] += (b[2] - a[2]) * w; } }
  stance(P, w) {
    const t = this.weaponType, s = (k, i, v) => { P[k][i] = lerp(P[k][i], v, w); };
    s('thL', 0, -0.15); s('thR', 0, 0.1); s('knL', 0, 0.25); s('knR', 0, 0.2); s('spine', 0, 0.08);
    if (t === 'sword' || t === 'gunblade' || t === 'cutlass') { s('shR', 0, -0.55); s('elR', 0, -0.8); s('handR', 0, -0.2); s('shL', 0, -0.45); s('shL', 2, 0.3); s('elL', 0, -1.3); }
    else if (t === 'axe') { s('shR', 0, -0.5); s('elR', 0, -1.1); s('shL', 0, -0.75); s('shL', 2, -0.15); s('elL', 0, -1.2); }
    else if (t === 'spear' || t === 'trident') { s('shR', 0, -0.2); s('elR', 0, -1.2); s('shL', 0, -0.8); s('elL', 0, -0.7); s('handR', 0, -0.3); }
    else if (t === 'bow') { s('shL', 0, -0.45); s('elL', 0, -0.5); }
    else { s('shR', 0, -0.35); s('elR', 0, -0.6); }
  }
  loopPose(T, name, t) {
    if (name === 'cast') {
      T.shL[0] = -1.0; T.shL[2] = 0.45; T.shR[0] = -1.0; T.shR[2] = -0.45; T.elL[0] = -0.7; T.elR[0] = -0.7; T.elL[1] = 0.3; T.elR[1] = -0.3;
      T.spine[0] = -0.05; T.head[0] = -0.1; T.handL[2] = Math.sin(t * 6) * 0.2; T.handR[2] = -Math.sin(t * 6) * 0.2; return null;
    }
    if (name === 'dance') {
      const b = t * 7;
      T.hips[2] = Math.sin(b) * 0.12; T.shL[2] = 1.3 + Math.sin(b) * 0.8; T.shR[2] = -(1.3 + Math.cos(b) * 0.8); T.elL[0] = -1.0; T.elR[0] = -1.0;
      T.knL[0] = Math.max(0, Math.sin(b)) * 0.5; T.knR[0] = Math.max(0, -Math.sin(b)) * 0.5; T.thL[0] = -Math.max(0, Math.sin(b)) * 0.3; T.thR[0] = -Math.max(0, -Math.sin(b)) * 0.3;
      T.head[2] = Math.sin(b) * 0.15; T.chest[1] = Math.sin(b * 0.5) * 0.3;
      return { hipDy: -Math.abs(Math.sin(b)) * 0.04 };
    }
    if (name === 'sit') {
      T.thL[0] = -1.5; T.thR[0] = -1.45; T.knL[0] = 0.25; T.knR[0] = 0.35; T.thL[2] = 0.1; T.thR[2] = -0.1;
      T.shL[0] = 0.45; T.shR[0] = 0.45; T.elL[0] = 0; T.elR[0] = 0; T.spine[0] = -0.12; T.head[0] = 0.05;
      return { hipDy: -this.hipY + 0.14 };
    }
    if (name === 'guard') { T.shL[0] = -1.2; T.shL[2] = -0.2; T.elL[0] = -1.4; T.spine[0] = 0.15; T.knL[0] = 0.4; T.knR[0] = 0.4; T.thL[0] = -0.25; return { hipDy: -0.05 }; }
    if (name === 'kneel') { T.thL[0] = -1.4; T.knL[0] = 1.5; T.thR[0] = 0.1; T.knR[0] = 1.5; T.ftR[0] = 0.4; T.spine[0] = 0.1; return { hipDy: -this.hipY * 0.45 }; }
    return null;
  }
  actionPose(T, name, u) {
    const ph = (a, b) => clamp((u - a) / (b - a), 0, 1);
    switch (name) {
      case 'slash': { const k = ph(0, 0.35), s = ph(0.35, 0.6); T.shR[0] = lerp(lerp(-0.5, -2.7, k), -0.3, s); T.shR[2] = lerp(-0.4, 0.2, s); T.elR[0] = lerp(-0.6, -0.1, s); T.chest[1] = lerp(0.35 * k, -0.45, s); T.spine[0] = 0.25 * s; T.thL[0] = -0.4 * s; T.knR[0] = 0.4 * s; return { hipDy: -0.05 * s }; }
      case 'slash2': { const k = ph(0, 0.3), s = ph(0.3, 0.55); T.shR[0] = -1.4; T.shR[2] = lerp(lerp(-0.2, -1.3, k), 0.8, s); T.elR[0] = -0.3; T.chest[1] = lerp(0.5 * k, -0.7, s); T.thL[0] = -0.3; T.knR[0] = 0.3; return null; }
      case 'heavy': { const k = ph(0, 0.4), s = ph(0.4, 0.62); T.shR[0] = lerp(lerp(-0.5, -3.0, k), -0.6, s); T.shL[0] = lerp(lerp(-0.5, -2.9, k), -0.6, s); T.shL[2] = -0.2; T.elR[0] = -0.3; T.elL[0] = -0.3; T.spine[0] = lerp(-0.2 * k, 0.45, s); T.knL[0] = 0.5 * s; T.knR[0] = 0.5 * s; T.thL[0] = -0.4 * s; return { hipDy: -0.12 * s }; }
      case 'thrust': { const k = ph(0, 0.35), s = ph(0.35, 0.55); T.shR[0] = lerp(-0.3, -1.3, s); T.elR[0] = lerp(-1.5 * (0.5 + k * 0.5), -0.15, s); T.handR[0] = lerp(-0.3, -0.2, s); T.shL[0] = lerp(-0.9, -1.4, s); T.elL[0] = lerp(-0.9, -0.3, s); T.chest[1] = lerp(0.4 * k, -0.2, s); T.thL[0] = -0.6 * s; T.knL[0] = 0.4 * s; T.thR[0] = 0.4 * s; T.spine[0] = 0.2 * s; return { hipDy: -0.08 * s }; }
      case 'spin': { T.shR[0] = -1.5; T.shR[2] = -0.4; T.elR[0] = -0.2; T.shL[2] = 1.0; T.knL[0] = 0.4; T.knR[0] = 0.4; return { rotY: ph(0.1, 0.8) * PI * 2, hipDy: -0.08 }; }
      case 'shoot': { const k = ph(0, 0.55), s = ph(0.55, 0.7); T.shL[0] = -1.5; T.shL[1] = 0; T.elL[0] = -0.05; T.shR[0] = -1.45; T.shR[2] = 0.2; T.elR[0] = lerp(-0.8, -2.3, k) + s * 0.8; T.elR[1] = -0.5; T.chest[1] = 0.5; T.head[1] = -0.4; return null; }
      case 'release': { const s = ph(0.2, 0.45); T.shR[0] = lerp(-1.1, -1.6, s); T.shR[2] = -0.2; T.elR[0] = lerp(-1.0, -0.05, s); T.shL[0] = -0.5; T.elL[0] = -1.0; T.chest[1] = lerp(0.3, -0.3, s); T.thL[0] = -0.25; return null; }
      case 'heal': { const s = ph(0.1, 0.4); T.shL[0] = -0.6; T.shR[0] = -0.6; T.shL[2] = lerp(0.3, 1.6, s); T.shR[2] = lerp(-0.3, -1.6, s); T.elL[0] = -0.3; T.elR[0] = -0.3; T.head[0] = -0.25 * s; T.spine[0] = -0.1 * s; return null; }
      case 'buff': { const s = ph(0.1, 0.4); T.shL[2] = 0.5; T.shR[2] = -0.5; T.elL[0] = -1.6 * s; T.elR[0] = -1.6 * s; T.spine[0] = -0.15 * s; T.head[0] = -0.2 * s; T.knL[0] = 0.3 * s; T.knR[0] = 0.3 * s; return { hipDy: -0.05 * s }; }
      case 'punch': { const k = u < 0.5 ? ph(0, 0.5) : ph(0.5, 1); const side = u < 0.5 ? 'R' : 'L'; const s = Math.sin(k * PI); T['sh' + side][0] = -1.5 * s - 0.3; T['el' + side][0] = -1.6 * (1 - s); T.chest[1] = (side === 'R' ? -0.4 : 0.4) * s; T.thL[0] = -0.3; T.knR[0] = 0.3; return null; }
      case 'hit': { const s = Math.sin(u * PI); T.spine[0] = -0.2 * s; T.head[0] = -0.25 * s; T.shL[2] = 0.4 * s; T.shR[2] = -0.4 * s; return null; }
      case 'wave': { T.shR[0] = -0.2; T.shR[2] = -2.5 + Math.sin(u * 22) * 0.25; T.elR[0] = -0.3; T.head[2] = -0.1; return null; }
      case 'bow': { const s = Math.sin(clamp(u * 1.3, 0, 1) * PI); T.spine[0] = 0.75 * s; T.head[0] = 0.3 * s; T.shR[0] = -0.5 * s; T.elR[0] = -1.4 * s; T.shL[0] = 0.2 * s; return null; }
      case 'cheer': { const s = Math.abs(Math.sin(u * PI * 3)); T.shL[2] = 2.7; T.shR[2] = -2.7; T.elL[0] = -0.3; T.elR[0] = -0.3; T.head[0] = -0.2; T.knL[0] = 0.4 * (1 - s); T.knR[0] = 0.4 * (1 - s); return { lift: s * 0.25 / this.scale, hipDy: 0 }; }
      case 'point': { T.shR[0] = -1.45; T.shR[2] = -0.25; T.elR[0] = -0.05; return null; }
      case 'nod': { T.head[0] = Math.sin(u * PI * 2) * 0.25; return null; }
      case 'talk': { T.shR[0] = -0.6; T.elR[0] = -1.2 + Math.sin(u * 12) * 0.2; T.shR[2] = -0.3; T.head[2] = Math.sin(u * 5) * 0.08; return null; }
      case 'lb': { const k = ph(0, 0.4), s = ph(0.4, 0.65); T.shR[0] = lerp(-3.0 * k, -0.4, s); T.shL[0] = lerp(-3.0 * k, -0.4, s); T.elL[0] = -0.2; T.elR[0] = -0.2; T.spine[0] = lerp(-0.3 * k, 0.5, s); T.knL[0] = 0.6 * s; T.knR[0] = 0.6 * s; return { lift: Math.sin(ph(0, 0.6) * PI) * 1.2 / this.scale }; }
      case 'jumpatk': { const k = ph(0, 0.5), s = ph(0.5, 0.7); T.shR[0] = lerp(-2.8 * k, -0.3, s); T.elR[0] = -0.3; T.knL[0] = 0.8 * k; T.knR[0] = 0.8 * k; T.thL[0] = -0.6 * k; return { lift: Math.sin(ph(0, 0.65) * PI) * 1.5 / this.scale }; }
      case 'attune': { T.shR[0] = -1.5; T.shR[2] = -0.1; T.elR[0] = -0.1; T.head[0] = -0.15; return null; }
      case 'victory': { T.shR[2] = -2.9; T.elR[0] = -0.2; T.shL[2] = 0.3; T.shL[0] = -0.3; T.head[0] = -0.2; return null; }
    }
    return null;
  }
}

// ---------- 通用魔物基类 ----------
class Creature {
  constructor() { this.root = new THREE.Group(); this.t = Math.random() * 9; this.act = null; this.dead = false; this.deadT = 0; this.mats = []; this.opacity = 1; this.loop = null; }
  mk(c, o) { const m = stdMat(c, o); this.mats.push(m); return m; }
  P(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; }
  G(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  play(name, dur = 0.6) { this.act = { name, t: 0, dur }; }
  setLoop(n) { this.loop = n; }
  setDrawn() { }
  setDead(d) { this.dead = d; this.deadT = 0; }
  setOpacity(a) { if (Math.abs(a - this.opacity) < 0.001) return; const tr = a < 0.999; for (const m of this.mats) { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; } this.opacity = a; }
  au() { return this.act ? clamp(this.act.t / this.act.dur, 0, 1) : -1; }
  update(dt, st = {}) {
    this.t += dt; if (this.act) { this.act.t += dt; }
    if (this.dead) this.deadT += dt;
    this.pose(dt, st, this.act ? this.act.name : null, this.au());
    if (this.act && this.act.t >= this.act.dur) this.act = null;
  }
  dispose() { this.mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
}

class Ladybug extends Creature {
  constructor(color = '#c8262a') {
    super(); this.height = 0.85; this.radius = 0.55; this.root.scale.setScalar(0.75);
    const spots = canvas(256, 128), c = spots.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#111'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(Math.random() * 256, 10 + Math.random() * 60, 7 + Math.random() * 6, 0, 7); c.fill(); }
    c.fillRect(126, 0, 5, 128); const tx = new THREE.CanvasTexture(spots); tx.colorSpace = THREE.SRGBColorSpace;
    this.bodyG = this.G(this.root, 0, 0.55, 0);
    const shell = this.mk('#ffffff', { r: 0.25 }); shell.map = tx;
    this.P(this.bodyG, new THREE.SphereGeometry(0.5, 24, 12, 0, PI * 2, 0, PI / 2), shell, 0, 0, 0, 0, PI / 2, 0, 1, 0.8, 1.2);
    this.P(this.bodyG, sphere(0.48), this.mk('#1a1a1a'), 0, -0.02, 0, 0, 0, 0, 1, 0.3, 1.15);
    const head = this.P(this.bodyG, sphere(0.2), this.mk('#141414', { r: 0.4 }), 0, 0.02, 0.6);
    for (const s of [-1, 1]) { this.P(head, sphere(0.05), this.mk('#f4f0e0'), s * 0.1, 0.06, 0.14); this.P(head, cyl(0.008, 0.008, 0.3, 4), this.mk('#111'), s * 0.08, 0.2, 0.08, -0.5, 0, s * -0.3); }
    this.legs = [];
    for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, z = (Math.floor(i / 2) - 1) * 0.3; const l = this.G(this.bodyG, s * 0.4, -0.08, z); this.P(l, cyl(0.02, 0.015, 0.45, 5), this.mk('#111'), s * 0.15, -0.15, 0, 0, 0, s * 0.9); this.legs.push(l); }
    this.wings = [];
    for (const s of [-1, 1]) { const wg = this.G(this.bodyG, s * 0.12, 0.3, -0.1); this.P(wg, new THREE.CircleGeometry(0.45, 12), this.mk('#eef4ff', { t: true, o: 0.35, ds: true, e: '#aaccff', ei: 0.3 }), s * 0.3, 0, -0.2, -PI / 2, 0, 0, 1, 1.6, 1); this.wings.push(wg); }
  }
  pose(dt, st, a, u) {
    const mv = clamp((st.speed || 0) / 2, 0, 1);
    this.bodyG.position.y = this.dead ? lerp(0.55, 0.2, clamp(this.deadT, 0, 1)) : 0.55 + Math.sin(this.t * 3) * 0.04 + mv * 0.15;
    this.bodyG.rotation.z = this.dead ? PI * clamp(this.deadT * 2, 0, 1) * 0.9 : 0;
    this.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (mv > 0.1 || a ? 0.6 + Math.sin(this.t * 40) * 0.5 : 0.05); });
    this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 12 + i) * 0.3 * mv; });
    if (a === 'attack') this.bodyG.rotation.x = -Math.sin(u * PI) * 0.4; else this.bodyG.rotation.x = 0;
  }
}

class Rat extends Creature {
  constructor(color = '#6b625a') {
    super(); this.height = 0.8; this.radius = 0.6;
    const fur = this.mk(color, { r: 1 }), pink = this.mk('#d99a9a');
    this.b = this.G(this.root, 0, 0.35, 0);
    this.P(this.b, sphere(0.3), fur, 0, 0, 0, 0, 0, 0, 1, 0.9, 1.6);
    this.head = this.G(this.b, 0, 0.1, 0.42);
    this.P(this.head, sphere(0.19), fur, 0, 0, 0, 0, 0, 0, 1, 0.95, 1.1);
    this.P(this.head, cone(0.12, 0.25, 10), fur, 0, -0.03, 0.2, PI / 2, 0, 0);
    this.P(this.head, sphere(0.035), this.mk('#2a1414'), 0, -0.03, 0.33);
    for (const s of [-1, 1]) { this.P(this.head, sphere(0.1), pink, s * 0.13, 0.16, -0.02, 0, 0, 0, 1, 1, 0.3); this.P(this.head, sphere(0.03), this.mk('#d02020', { e: '#600', ei: 1 }), s * 0.09, 0.06, 0.15); }
    this.legs = []; for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1, z = i < 2 ? 0.25 : -0.25; const l = this.G(this.b, s * 0.18, -0.15, z); this.P(l, capsule(0.05, 0.12), pink, 0, -0.08, 0); this.legs.push(l); }
    let p = this.G(this.b, 0, 0, -0.45); p.rotation.x = -1.9; this.tail = [];
    for (let i = 0; i < 6; i++) { this.P(p, capsule(0.03 - i * 0.004, 0.1), pink, 0, 0.06, 0); const n = this.G(p, 0, 0.12, 0); this.tail.push(n); p = n; }
  }
  pose(dt, st, a, u) {
    const mv = clamp((st.speed || 0) / 2, 0, 1);
    this.b.position.y = 0.35 + Math.abs(Math.sin(this.t * 14)) * 0.06 * mv;
    this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 14 + (i % 2) * PI) * 0.7 * mv; });
    this.tail.forEach((t, i) => { t.rotation.x = 0.15; t.rotation.z = Math.sin(this.t * 4 + i) * 0.25; });
    this.head.rotation.x = a === 'attack' ? Math.sin(u * PI) * 0.5 : Math.sin(this.t * 2) * 0.05;
    this.b.rotation.z = this.dead ? PI * clamp(this.deadT * 2, 0, 1) * 0.5 : 0;
    if (this.dead) this.b.position.y = 0.25;
  }
}

class Crab extends Creature {
  constructor(scale = 1) {
    super(); this.height = 3.2 * scale; this.radius = 3 * scale; this.root.scale.setScalar(scale);
    const shell = this.mk('#b8452c', { r: 0.45, flat: true }), dark = this.mk('#6e2418', { r: 0.6 }), belly = this.mk('#e8c49a');
    this.b = this.G(this.root, 0, 1.3, 0);
    this.P(this.b, new THREE.IcosahedronGeometry(1.5, 2), shell, 0, 0, 0, 0, 0, 0, 1.4, 0.55, 1.05);
    this.P(this.b, sphere(1.4), belly, 0, -0.25, 0, 0, 0, 0, 1.35, 0.3, 1);
    for (let i = 0; i < 9; i++) this.P(this.b, cone(0.12, 0.45, 5), dark, (Math.random() - 0.5) * 2.6, 0.7, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
    for (const s of [-1, 1]) { const e = this.G(this.b, s * 0.4, 0.5, 1.3); this.P(e, cyl(0.05, 0.05, 0.5, 6), dark, 0, 0.25, 0); this.P(e, sphere(0.12), this.mk('#101010', { r: 0.1 }), 0, 0.52, 0); }
    this.claws = [];
    for (const s of [-1, 1]) {
      const arm = this.G(this.b, s * 1.5, 0, 1.0); this.P(arm, capsule(0.22, 1.0), shell, s * 0.4, 0, 0.3, PI / 2, 0, s * 0.6);
      const pin = this.G(arm, s * 0.8, 0, 1.1); this.P(pin, sphere(0.55, 14, 10), shell, 0, 0, 0.2, 0, 0, 0, 0.9, 0.7, 1.3);
      const up = this.G(pin, 0, 0.15, 0.6); this.P(up, cone(0.25, 0.9, 6), dark, 0, 0, 0.4, PI / 2, 0, 0);
      const lo = this.G(pin, 0, -0.15, 0.6); this.P(lo, cone(0.2, 0.8, 6), dark, 0, 0, 0.35, PI / 2, 0, 0);
      this.claws.push({ arm, pin, up, lo, s });
    }
    this.legs = [];
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1, z = (Math.floor(i / 2) - 1) * 0.7 - 0.2;
      const l = this.G(this.b, s * 1.6, -0.1, z); this.P(l, capsule(0.12, 1.0), shell, s * 0.5, 0.2, 0, 0, 0, s * -1.0);
      const k = this.G(l, s * 1.0, 0.55, 0); this.P(k, cone(0.12, 1.4, 6), dark, s * 0.25, -0.65, 0, 0, 0, s * 0.35 + PI);
      this.legs.push({ l, k, s, i });
    }
  }
  pose(dt, st, a, u) {
    const mv = clamp((st.speed || 0) / 2, 0, 1);
    this.b.position.y = this.dead ? lerp(1.3, 0.6, clamp(this.deadT, 0, 1)) : 1.3 + Math.sin(this.t * 2) * 0.05;
    this.legs.forEach(({ l, s, i }) => { l.rotation.z = Math.sin(this.t * 10 + i * 1.3) * 0.25 * mv; l.rotation.x = Math.cos(this.t * 10 + i * 1.3) * 0.15 * mv; });
    this.claws.forEach(({ arm, up, lo, s }) => {
      let open = 0.15 + Math.sin(this.t * 3 + s) * 0.1, raise = 0;
      if (a === 'attack' || a === 'buster') { raise = Math.sin(u * PI) * (a === 'buster' ? 1.1 : 0.6); open = u < 0.5 ? 0.6 : 0.05; }
      if (a === 'cast') { raise = 0.8; open = 0.5 + Math.sin(this.t * 10) * 0.2; }
      if (a === 'slam') { raise = u < 0.5 ? u * 2.4 : (1 - u) * 2.4 - 0.4; }
      arm.rotation.x = -raise; up.rotation.x = -open; lo.rotation.x = open;
    });
    this.b.rotation.x = this.dead ? -0.2 : 0;
    if (a === 'sweep') this.b.rotation.y = Math.sin(u * PI * 2) * 0.6; else this.b.rotation.y = 0;
  }
}

class Denn extends Creature {
  constructor() {
    super(); this.height = 7; this.radius = 6.5;
    const skin = this.mk('#2c3f55', { r: 0.35, m: 0.1 }), belly = this.mk('#e6e4dc', { r: 0.5 }), fin = this.mk('#1c2a3a', { r: 0.4, ds: true }), tooth = this.mk('#f5f0e0', { r: 0.3 });
    this.b = this.G(this.root, 0, 0, 0);
    this.torso = this.G(this.b, 0, 3.2, 0);
    this.P(this.torso, sphere(3), skin, 0, 0, -1, 0, 0, 0, 1.25, 1.1, 1.9);
    this.P(this.torso, sphere(2.8), belly, 0, -0.9, 0.2, 0, 0, 0, 1.1, 0.8, 1.7);
    this.P(this.torso, cone(1.2, 3, 4), fin, 0, 3.3, -1.5, -0.4, 0, 0, 0.25, 1, 1);
    for (let i = 0; i < 16; i++) this.P(this.torso, sphere(0.35, 8, 6), this.mk('#48607a', { r: 0.5 }), Math.sin(i) * 2.5, 1.2 + (i % 4) * 0.4, -1.5 - (i % 5) * 0.5, 0, 0, 0, 1, 0.4, 1);
    this.headG = this.G(this.torso, 0, 0.6, 3.6);
    this.P(this.headG, sphere(2), skin, 0, 0.4, 0.3, 0, 0, 0, 1.2, 0.75, 1.2);
    this.jaw = this.G(this.headG, 0, -0.4, -0.5);
    this.P(this.jaw, sphere(1.8), belly, 0, -0.1, 1.2, 0, 0, 0, 1.1, 0.4, 1.1);
    for (let i = 0; i < 10; i++) { const a = -1.3 + (i / 9) * 2.6; this.P(this.headG, cone(0.13, 0.55, 5), tooth, Math.sin(a) * 1.9, -0.05, 0.4 + Math.cos(a) * 1.9, PI, 0, 0); this.P(this.jaw, cone(0.12, 0.45, 5), tooth, Math.sin(a) * 1.7, 0.25, 1.2 + Math.cos(a) * 1.6, 0, 0, 0); }
    for (const s of [-1, 1]) { this.P(this.headG, sphere(0.35), this.mk('#ffcc33', { e: '#ff9900', ei: 1.5 }), s * 1.6, 0.8, 1.4); this.P(this.headG, sphere(0.16), this.mk('#110000'), s * 1.78, 0.85, 1.55); }
    this.fins = [];
    for (const s of [-1, 1]) { const f = this.G(this.torso, s * 3.2, -0.8, 1); this.P(f, cone(1, 3.5, 4), fin, s * 1.4, 0, 0, 0, 0, s * -1.2, 1, 1, 0.25); this.fins.push(f); }
    this.tailG = this.G(this.torso, 0, -0.5, -5.2);
    this.P(this.tailG, cone(1.8, 4, 10), skin, 0, 0, -1.6, -PI / 2, 0, 0);
    this.P(this.tailG, cone(1.5, 2.8, 4), fin, 0, 0, -3.8, 0, 0, PI / 2, 1, 1, 0.2);
    this.torso.rotation.x = -0.35;
  }
  pose(dt, st, a, u) {
    const base = this.dead ? -1.5 * clamp(this.deadT / 2, 0, 1) : 0;
    this.b.position.y = base + Math.sin(this.t * 1.2) * 0.3;
    this.torso.rotation.z = Math.sin(this.t * 0.8) * 0.06;
    this.tailG.rotation.y = Math.sin(this.t * 1.5) * 0.3;
    this.fins.forEach((f, i) => { f.rotation.z = Math.sin(this.t * 2 + i * PI) * 0.2; });
    let jaw = 0.1 + Math.sin(this.t * 1.1) * 0.05, lean = -0.35;
    if (a === 'attack') { jaw = Math.sin(u * PI) * 0.7; lean = -0.35 + Math.sin(u * PI) * 0.25; }
    if (a === 'cast') { jaw = 0.6; lean = -0.55; }
    if (a === 'roar') { jaw = 0.9 * Math.sin(u * PI); lean = -0.6; }
    if (a === 'dive') { this.b.position.y -= Math.sin(u * PI) * 4; }
    this.jaw.rotation.x = jaw; this.torso.rotation.x = lean;
  }
}

class Clam extends Creature {
  constructor() {
    super(); this.height = 1.4; this.radius = 1.1;
    const sh = this.mk('#b8aebe', { r: 0.4, flat: true }), inner = this.mk('#f2b8c8', { e: '#ff6fa0', ei: 0.5 });
    const g = new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI / 2);
    this.P(this.root, g, sh, 0, 0.35, 0, PI, 0, 0, 1, 0.35, 0.9);
    this.top = this.G(this.root, 0, 0.35, -0.8); this.P(this.top, g, sh, 0, 0, 0.8, 0, 0, 0, 1, 0.4, 0.9);
    this.P(this.root, sphere(0.35), inner, 0, 0.45, 0, 0, 0, 0, 1, 0.5, 1);
    this.pearl = this.P(this.root, sphere(0.2), this.mk('#fff', { e: '#9ff', ei: 1.5 }), 0, 0.6, 0);
  }
  pose(dt) { this.top.rotation.x = this.dead ? 0 : -0.35 - Math.max(0, Math.sin(this.t * 2)) * 0.4; this.pearl.visible = !this.dead; }
}

// ---------- 陆行鸟 ----------
export class Chocobo extends Creature {
  constructor(color = '#f2cf3a') {
    super(); this.height = 2.3; this.radius = 0.9;
    const y = this.mk(color, { r: 0.9 }), y2 = this.mk('#ffe9a0', { r: 0.9 }), orange = this.mk('#e8932c', { r: 0.6 }), saddle = this.mk('#7a3a24', { r: 0.7 }), gold = this.mk('#c9a44f', { m: 0.8, r: 0.35 });
    this.b = this.G(this.root, 0, 1.15, 0);
    this.P(this.b, sphere(0.55), y, 0, 0, 0, 0, 0, 0, 0.85, 0.82, 1.15);
    this.P(this.b, sphere(0.5), y2, 0, -0.15, 0.2, 0, 0, 0, 0.75, 0.6, 0.9);
    this.neck = this.G(this.b, 0, 0.3, 0.45); this.neck.rotation.x = -0.45;
    this.P(this.neck, capsule(0.17, 0.5), y, 0, 0.3, 0);
    this.head = this.G(this.neck, 0, 0.7, 0); this.head.rotation.x = 0.45;
    this.P(this.head, sphere(0.23), y, 0, 0, 0.05);
    this.P(this.head, cone(0.085, 0.34, 8), orange, 0, -0.04, 0.33, PI / 2, 0, 0, 1, 1, 0.8);
    for (const s of [-1, 1]) { this.P(this.head, sphere(0.045), this.mk('#101418', { r: 0.1 }), s * 0.14, 0.06, 0.15); this.P(this.head, sphere(0.015), this.mk('#fff'), s * 0.15, 0.08, 0.18); }
    for (let i = 0; i < 3; i++) this.P(this.head, cone(0.06, 0.35, 6), y, (i - 1) * 0.07, 0.2, -0.05, -0.7 - Math.abs(i - 1) * 0.2, 0, (i - 1) * 0.3);
    for (let i = 0; i < 5; i++) this.P(this.b, cone(0.1, 0.6, 6), y, (i - 2) * 0.12, 0.15, -0.65, -2.2 + Math.abs(i - 2) * 0.1, 0, (i - 2) * 0.3);
    this.wings = [];
    for (const s of [-1, 1]) { const w = this.G(this.b, s * 0.43, 0.08, 0.05); this.P(w, sphere(0.3), y, 0, 0, -0.1, 0, 0, 0, 0.25, 0.7, 1.3); this.wings.push(w); }
    this.P(this.b, new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16, 1, true, -PI / 2, PI), saddle, 0, 0.3, 0.02, 0, 0, PI / 2);
    this.P(this.b, torus(0.5, 0.03, PI), gold, 0, 0.3, 0.26, 0, 0, 0);
    this.seat = this.G(this.b, 0, 0.42, -0.02);
    this.legs = [];
    for (const s of [-1, 1]) {
      const th = this.G(this.b, s * 0.26, -0.35, 0.05); this.P(th, capsule(0.14, 0.2), y, 0, -0.12, 0);
      const sh = this.G(th, 0, -0.3, 0); this.P(sh, capsule(0.05, 0.42), orange, 0, -0.25, 0);
      const ft = this.G(sh, 0, -0.52, 0); for (let k = -1; k <= 1; k++) this.P(ft, cone(0.04, 0.22, 5), orange, k * 0.06, -0.02, 0.1, PI / 2 - 0.1, k * 0.35, 0);
      this.legs.push({ th, sh, ft, s });
    }
  }
  pose(dt, st, a, u) {
    const sp = st.speed || 0, mv = clamp(sp / 3, 0, 1), ph = this.t * (6 + sp * 0.9);
    this.legs.forEach(({ th, sh, ft, s }) => { const p = ph + (s > 0 ? 0 : PI); th.rotation.x = -Math.sin(p) * 0.7 * mv; sh.rotation.x = 0.3 + Math.max(0, Math.cos(p)) * 0.8 * mv; ft.rotation.x = -0.3 * mv; });
    this.b.position.y = 1.15 + Math.abs(Math.sin(ph)) * 0.1 * mv + Math.sin(this.t * 2) * 0.015;
    this.neck.rotation.x = -0.45 - mv * 0.35 + Math.sin(ph * 2) * 0.05 * mv;
    this.head.rotation.x = 0.45 + mv * 0.3; this.head.rotation.y = Math.sin(this.t * 0.7) * 0.25 * (1 - mv);
    this.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.05 + (a === 'flap' ? Math.abs(Math.sin(u * PI * 6)) * 0.8 : 0)); });
    if (a === 'kweh') this.head.rotation.x = 0.45 - Math.sin(u * PI) * 0.8;
  }
}

// ---------- 工厂 ----------
export function buildModel(kind, o = {}) {
  switch (kind) {
    case 'ladybug': return new Ladybug(o.color);
    case 'rat': return new Rat(o.color);
    case 'crab': return new Crab(o.scale || 1);
    case 'denn': return new Denn();
    case 'clam': return new Clam();
    case 'chocobo': return new Chocobo(o.color);
    case 'sahagin': return new Humanoid({ race: 'hyur', gender: 'm', special: 'sahagin', skin: o.skin || '#4d8c7e', height: 0.6, build: 0.7, hat: 'bald' }, { pants: '#6a4a2a', boots: '#4d8c7e', gloves: '#4d8c7e', bare: true, top: '#3a6a5e', belt: '#5a3a1a', weapon: 'trident', metal: '#9aa0a8' }, { faceRes: 128 });
    case 'pirate': return new Humanoid({ race: o.race || 'hyur', gender: o.gender || 'm', skin: o.skin || '#d8a888', hairStyle: 0, hairColor: o.hair || '#2a1a12', hat: 'bandana', bandanaColor: o.band || '#a8322c', eyepatch: !!o.patch, build: 0.7, height: Math.random() }, { top: o.top || '#d8d0c0', top2: '#8a3a2a', pants: '#3a3a4a', boots: '#2a1a12', gloves: '#5a3a24', accent: '#a8322c', belt: '#2a1a12', weapon: o.weapon || 'cutlass', metal: '#b8bcc4' }, { faceRes: 128 });
    case 'captain': return new Humanoid({ race: 'roegadyn', gender: 'm', skin: '#c89a7a', hairColor: '#1c1410', hat: 'tricorne', beard: true, build: 1, height: 1 }, { top: '#7a1c1c', top2: '#e8dcc0', robe: true, pants: '#1c1a20', boots: '#1c1410', gloves: '#1c1410', accent: '#c9a44f', belt: '#c9a44f', weapon: 'cutlass', metal: '#d8dce4', shoulder: 'metal' }, { faceRes: 256 });
  }
  return new Ladybug();
}
