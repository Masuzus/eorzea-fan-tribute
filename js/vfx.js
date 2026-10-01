// 视觉特效：技能效果、范围预兆（AOE 预警）、目标圈、魔法阵、投射物
import { THREE, G, canvasTex, rand } from './engine.js';

const PI = Math.PI;
const C = (hex) => new THREE.Color(hex);
const list = [];
let TX = null;
function tex() {
  if (TX) return TX;
  TX = {};
  TX.radial = canvasTex(256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.8, 'rgba(255,255,255,0.55)'); g.addColorStop(0.94, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, false);
  TX.rect = canvasTex(64, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(255,255,255,0.6)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(0.92, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, false);
  TX.glow = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, false);
  TX.target = canvasTex(256, 256, (c, w, h) => {
    const cx = w / 2; c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cx, 110, 0, PI * 2); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.arc(cx, cx, 96, 0, PI * 2); c.stroke();
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) { const a = i * PI / 2; c.save(); c.translate(cx + Math.cos(a) * 118, cx + Math.sin(a) * 118); c.rotate(a); c.beginPath(); c.moveTo(8, 0); c.lineTo(-8, -9); c.lineTo(-8, 9); c.fill(); c.restore(); }
    const g = c.createRadialGradient(cx, cx, 60, cx, cx, 110); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.25)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cx, 110, 0, PI * 2); c.fill();
  }, false);
  TX.rune = canvasTex(512, 512, (c, w, h) => {
    const cx = w / 2; c.strokeStyle = '#fff'; c.fillStyle = '#fff';
    c.lineWidth = 6; c.beginPath(); c.arc(cx, cx, 240, 0, PI * 2); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(cx, cx, 205, 0, PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cx, 120, 0, PI * 2); c.stroke();
    c.lineWidth = 4; c.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i * 2 * 2 * PI) / 6 * 0.5 + PI / 2; const x = cx + Math.cos(a * 2) * 200, y = cx + Math.sin(a * 2) * 200; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    for (let t = 0; t < 2; t++) { c.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3) * PI * 2 + t * PI / 3 - PI / 2; const x = cx + Math.cos(a) * 200, y = cx + Math.sin(a) * 200; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    c.font = 'bold 26px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) { const a = (i / 24) * PI * 2; c.save(); c.translate(cx + Math.cos(a) * 222, cx + Math.sin(a) * 222); c.rotate(a + PI / 2); c.fillText(glyphs[i], 0, 0); c.restore(); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; c.beginPath(); c.arc(cx + Math.cos(a) * 160, cx + Math.sin(a) * 160, 7, 0, PI * 2); c.fill(); }
  }, false);
  TX.stack = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#ffd24a'; c.strokeStyle = '#6a4a00'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) { c.save(); c.translate(64, 64); c.rotate(i * PI / 2); c.beginPath(); c.moveTo(0, 18); c.lineTo(-14, 44); c.lineTo(-6, 44); c.lineTo(-6, 60); c.lineTo(6, 60); c.lineTo(6, 44); c.lineTo(14, 44); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  }, false);
  return TX;
}
const addMat = (color, map, op = 1) => new THREE.MeshBasicMaterial({ color, map: map || null, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

function spawn(obj, dur, fn, end) { G.scene.add(obj); const e = { obj, t: 0, dur, fn, end }; list.push(e); return e; }
const gh = (x, z) => (G.zone ? G.zone.heightAt(x, z) ?? 0 : 0);
// 直线范围的高度：起点可能在水面或场外（如甲板外的炮击），取沿线最高的地面
const ghLine = (x, z, dir, len) => { let best = null; for (let t = 0; t <= 1.001; t += 0.125) { const h = G.zone ? G.zone.heightAt(x + Math.sin(dir) * len * t, z + Math.cos(dir) * len * t) : 0; if (h !== null && (best === null || h > best)) best = h; } return best ?? 0; };

export const VFX = {
  update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i]; e.t += dt; const u = Math.min(1, e.t / e.dur);
      if (e.fn) e.fn(u, dt, e);
      if (e.t >= e.dur || e.kill) {
        G.scene.remove(e.obj); if (e.end) e.end();
        e.obj.traverse((o) => { if (o.material && !o.userData.keepMat) o.material.dispose(); if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); });
        list.splice(i, 1);
      }
    }
  },
  clear() { for (const e of list) { G.scene.remove(e.obj); } list.length = 0; },
  burst(pos, color, n = 20, o = {}) { G.particles.burst(pos, C(color), n, o); },
  flash(pos, color, size = 2, dur = 0.35) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex().glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(pos); m.scale.setScalar(size * 0.3);
    spawn(m, dur, (u) => { m.scale.setScalar(size * (0.3 + u * 0.9)); m.material.opacity = 1 - u; });
  },
  hit(pos, color = '#ffe0a0', big = false) {
    this.flash(pos, color, big ? 2.6 : 1.4, 0.25);
    G.particles.burst(pos, C(color).multiplyScalar(1.6), big ? 26 : 12, { speed: big ? 7 : 5, size: 0.28, life: 0.45, drag: 3, grav: 4 });
  },
  slash(ent, color = '#cfe8ff', dir = 1) {
    const g = new THREE.RingGeometry(0.7, 1.7, 24, 1, 0, PI * 0.9);
    const m = new THREE.Mesh(g, addMat(color, null, 0.8));
    const f = ent.forward(), p = ent.pos;
    m.position.set(p.x + f.x * 0.8, p.y + ent.height * 0.55, p.z + f.z * 0.8);
    m.rotation.set(0, ent.rot, 0); m.rotateY(PI / 2); m.rotateX(dir * 0.6);
    const base = m.rotation.z;
    spawn(m, 0.22, (u) => { m.rotation.z = base - PI * 0.4 + u * PI * 0.7 * dir; m.material.opacity = 0.9 * (1 - u); m.scale.setScalar(1 + u * 0.2); });
    G.particles.burst(m.position, C(color), 6, { speed: 3, size: 0.2, life: 0.3 });
  },
  thrust(ent, color = '#cfe0ff') {
    const g = new THREE.ConeGeometry(0.25, 3, 8, 1, true); g.rotateX(PI / 2); g.translate(0, 0, 1.8);
    const m = new THREE.Mesh(g, addMat(color, null, 0.8)); const p = ent.pos;
    m.position.set(p.x, p.y + ent.height * 0.55, p.z); m.rotation.y = ent.rot;
    spawn(m, 0.25, (u) => { m.scale.set(1 - u * 0.5, 1 - u * 0.5, 0.6 + u * 0.6); m.material.opacity = 0.9 * (1 - u); });
  },
  ring(pos, color, r = 4, dur = 0.5, y = 0.1) {
    const g = new THREE.RingGeometry(0.85, 1, 48); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, addMat(color, null, 1)); m.position.set(pos.x, gh(pos.x, pos.z) + y, pos.z);
    spawn(m, dur, (u) => { m.scale.setScalar(0.2 + u * r); m.material.opacity = 1 - u; });
  },
  disc(pos, color, r = 4, dur = 0.5) {
    const g = new THREE.CircleGeometry(1, 40); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, addMat(color, tex().glow, 0.9)); m.position.set(pos.x, gh(pos.x, pos.z) + 0.12, pos.z);
    spawn(m, dur, (u) => { m.scale.setScalar(r * (0.4 + u * 0.6)); m.material.opacity = 0.9 * (1 - u); });
  },
  pillar(pos, color, h = 6, dur = 1.2, r = 1) {
    const g = new THREE.CylinderGeometry(r, r, h, 24, 1, true); g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, addMat(color, null, 0.6)); m.position.set(pos.x, pos.y, pos.z);
    spawn(m, dur, (u) => { m.scale.set(1 - u * 0.6, 0.3 + Math.min(1, u * 4) * 0.7, 1 - u * 0.6); m.material.opacity = 0.6 * (1 - u); });
  },
  heal(ent, color = '#7dffa8') {
    const p = ent.pos.clone(); p.y += 0.1;
    this.ring(p, color, 1.6, 0.6);
    for (let i = 0; i < 26; i++) { const a = rand(0, PI * 2), r = rand(0.2, 0.8); G.particles.emit(p.x + Math.cos(a) * r, p.y + rand(0, 0.5), p.z + Math.sin(a) * r, 0, rand(1.5, 3.2), 0, C(color), 0.35, rand(0.6, 1.1)); }
    this.flash(p.clone().setY(p.y + ent.height * 0.6), color, 1.6, 0.4);
  },
  fire(pos, big = 1) {
    this.flash(pos, '#ff9a3a', 3.5 * big, 0.4);
    G.particles.burst(pos, C('#ff7a2a').multiplyScalar(2), 34 * big, { speed: 6 * big, size: 0.55, life: 0.6, drag: 2.5, lift: 1.5 });
    G.particles.burst(pos, C('#ffd060').multiplyScalar(2), 16 * big, { speed: 3, size: 0.35, life: 0.5, drag: 2, lift: 2 });
    G.particles.burst(pos, C('#3a2a2a'), 10, { speed: 1.5, size: 0.8, life: 1.2, lift: 1.5, alpha: 0.4 });
  },
  ice(pos, big = 1) {
    this.flash(pos, '#9ae0ff', 3 * big, 0.35);
    const mat = new THREE.MeshStandardMaterial({ color: '#bfefff', emissive: '#5ac8ff', emissiveIntensity: 1.5, transparent: true, opacity: 0.9, roughness: 0.1 });
    const grp = new THREE.Group(); grp.position.copy(pos);
    const shards = [];
    for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), mat); s.scale.set(0.6, rand(1.5, 3), 0.6); const a = (i / 9) * PI * 2; s.position.set(Math.cos(a) * 0.3, rand(-0.3, 0.3), Math.sin(a) * 0.3); s.rotation.set(rand(-1, 1), a, rand(-1, 1)); grp.add(s); shards.push([s, a]); }
    spawn(grp, 0.7, (u) => { shards.forEach(([s, a]) => { s.position.x = Math.cos(a) * (0.3 + u * 1.2); s.position.z = Math.sin(a) * (0.3 + u * 1.2); }); mat.opacity = 0.9 * (1 - u); });
    G.particles.burst(pos, C('#9ae8ff').multiplyScalar(1.8), 24 * big, { speed: 4, size: 0.3, life: 0.7, drag: 2 });
  },
  bolt(pos) {
    const pts = []; let x = pos.x + rand(-1, 1), z = pos.z + rand(-1, 1);
    for (let i = 0; i <= 12; i++) { const y = pos.y + 14 - i * 1.2; pts.push(new THREE.Vector3(x, y, z)); x += rand(-0.6, 0.6); z += rand(-0.6, 0.6); if (i === 11) { x = pos.x; z = pos.z; } }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.06, 5, false);
    const m = new THREE.Mesh(g, addMat('#fff6a0', null, 1));
    spawn(m, 0.35, (u) => { m.material.opacity = (1 - u) * (Math.random() > 0.3 ? 1 : 0.2); });
    this.flash(pos, '#ffe860', 3.5, 0.35); G.particles.burst(pos, C('#fff080').multiplyScalar(2), 20, { speed: 5, size: 0.25, life: 0.4 });
  },
  stone(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: '#8a7050', roughness: 1, flatShading: true, transparent: true });
    const grp = new THREE.Group(); const rocks = [];
    for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.15, 0.3), 0), mat); r.position.set(pos.x + rand(-0.5, 0.5), pos.y + 3 + i * 0.4, pos.z + rand(-0.5, 0.5)); grp.add(r); rocks.push(r); }
    spawn(grp, 0.55, (u) => { rocks.forEach((r, i) => { r.position.y -= 0.35; r.rotation.x += 0.2; }); mat.opacity = u > 0.7 ? (1 - u) / 0.3 : 1; });
    setTimeout(() => G.particles.burst(pos, C('#b8a078'), 16, { speed: 3, size: 0.5, life: 0.7, alpha: 0.6, grav: 3 }), 250);
  },
  wind(pos, color = '#8affc8') {
    for (let i = 0; i < 30; i++) { const a = (i / 30) * PI * 4, r = 0.8; G.particles.emit(pos.x + Math.cos(a) * r, pos.y - 0.6 + i * 0.05, pos.z + Math.sin(a) * r, -Math.sin(a) * 3, 1.5, Math.cos(a) * 3, C(color), 0.3, 0.6); }
    this.flash(pos, color, 1.8, 0.3);
  },
  spin(ent, color = '#cfe8ff', r = 5) {
    this.ring(ent.pos, color, r, 0.45); this.disc(ent.pos, color, r, 0.35);
    G.particles.burst(ent.pos.clone().setY(ent.pos.y + 0.8), C(color), 20, { speed: 7, size: 0.3, life: 0.4, up: 0.2 });
  },
  cone(ent, color, r = 8, angle = 120) {
    const half = (angle * PI) / 360; const g = new THREE.CircleGeometry(1, 30, -half, half * 2); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, addMat(color, tex().radial, 0.8)); m.position.set(ent.pos.x, gh(ent.pos.x, ent.pos.z) + 0.15, ent.pos.z); m.rotation.y = ent.rot - PI / 2;
    spawn(m, 0.35, (u) => { m.scale.setScalar(r * (0.3 + u * 0.7)); m.material.opacity = 0.8 * (1 - u); });
  },
  line(ent, color, len = 10, w = 4) {
    const g = new THREE.PlaneGeometry(w, len); g.translate(0, len / 2, 0); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, addMat(color, tex().rect, 0.8)); m.position.set(ent.pos.x, ghLine(ent.pos.x, ent.pos.z, ent.rot, len) + 0.15, ent.pos.z); m.rotation.y = ent.rot + PI;
    spawn(m, 0.35, (u) => { m.scale.z = 0.3 + u * 0.7; m.material.opacity = 0.8 * (1 - u); });
  },
  projectile(from, target, o = {}) {
    const color = o.color || '#ffd080', speed = o.speed || 22;
    let mesh;
    if (o.kind === 'arrow') {
      const g = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4); g.rotateX(PI / 2);
      mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#e8dcc0' }));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 4), new THREE.MeshBasicMaterial({ color: '#aaa' })); tip.rotation.x = PI / 2; tip.position.z = 0.5; mesh.add(tip);
    } else if (o.kind === 'axe' || o.kind === 'shield' || o.kind === 'spear') {
      const g = o.kind === 'shield' ? new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16) : o.kind === 'spear' ? new THREE.ConeGeometry(0.06, 1.4, 5) : new THREE.BoxGeometry(0.5, 0.05, 0.35);
      if (o.kind === 'spear') g.rotateX(PI / 2);
      mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: o.kind === 'shield' ? '#a8322c' : '#c0c4cc', metalness: 0.8, roughness: 0.3 }));
    } else {
      mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex().glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      mesh.scale.setScalar(o.size || 0.9);
    }
    mesh.position.copy(from);
    const col = C(color).multiplyScalar(1.5), to = new THREE.Vector3();
    const e = spawn(mesh, 5, (u, dt, ev) => {
      to.copy(target.pos); to.y += target.height * 0.55;
      const d = to.clone().sub(mesh.position); const dist = d.length();
      if (dist < speed * dt + 0.2) { ev.kill = true; if (o.onHit) o.onHit(); return; }
      d.normalize(); mesh.position.addScaledVector(d, speed * dt);
      if (!mesh.isSprite) { mesh.lookAt(to); if (o.kind === 'axe' || o.kind === 'shield') mesh.rotateX(ev.t * 25); }
      if (o.trail !== false) G.particles.emit(mesh.position.x, mesh.position.y, mesh.position.z, rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), col, (o.size || 0.9) * 0.45, 0.35);
    });
    return e;
  },
  castCircle(ent, color) {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, addMat(color, tex().rune, 0.85));
    const r = Math.max(1.4, ent.radius * 2.2);
    const e = spawn(m, 9999, (u, dt, ev) => {
      m.position.set(ent.pos.x, gh(ent.pos.x, ent.pos.z) + 0.08, ent.pos.z); m.rotation.y += dt * 0.8;
      const k = Math.min(1, ev.t * 4); m.scale.setScalar(r * 2 * k); m.material.opacity = 0.85 * k;
      if (Math.random() < 0.5) { const a = rand(0, PI * 2); G.particles.emit(ent.pos.x + Math.cos(a) * r * 0.8, m.position.y, ent.pos.z + Math.sin(a) * r * 0.8, 0, rand(1, 2.5), 0, C(color), 0.25, 0.8); }
    });
    return { remove: () => { e.kill = true; } };
  },
  // 橙色 AOE 预警（FF14 式地面预兆）
  telegraph(t) {
    const grp = new THREE.Group(); const T = tex();
    const color = t.color || '#ff8a2a';
    const edge = new THREE.MeshBasicMaterial({ color, map: t.shape === 'line' ? T.rect : T.radial, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
    let base, inner;
    if (t.shape === 'circle') { base = new THREE.CircleGeometry(t.r, 48); inner = base; }
    else if (t.shape === 'donut') { base = new THREE.RingGeometry(t.rin, t.r, 48); inner = base; }
    else if (t.shape === 'cone') { const half = (t.angle * PI) / 360; base = new THREE.CircleGeometry(t.r, 32, -half, half * 2); inner = base; }
    else { base = new THREE.PlaneGeometry(t.width, t.len); base.translate(0, t.len / 2, 0); inner = base; }
    base.rotateX(-PI / 2);
    const m1 = new THREE.Mesh(base, edge), m2 = new THREE.Mesh(inner.clone(), fill);
    m1.renderOrder = 3; m2.renderOrder = 4; grp.add(m1); grp.add(m2);
    grp.position.set(t.x, (t.shape === 'line' ? ghLine(t.x, t.z, t.dir, t.len) : gh(t.x, t.z)) + 0.07, t.z);
    if (t.shape === 'cone') grp.rotation.y = t.dir - PI / 2;
    if (t.shape === 'line') grp.rotation.y = t.dir + PI;
    const e = spawn(grp, t.dur, (u) => {
      edge.opacity = Math.min(0.75, u * 6) * (0.8 + Math.sin(u * 40) * 0.08);
      if (t.shape === 'line') { m2.scale.set(1, 1, Math.max(0.001, u)); } else if (t.shape === 'donut') { fill.opacity = 0.1 + u * 0.25; } else m2.scale.set(Math.max(0.001, u), 1, Math.max(0.001, u));
      if (t.follow) { grp.position.set(t.follow.pos.x, gh(t.follow.pos.x, t.follow.pos.z) + 0.07, t.follow.pos.z); }
    });
    return e;
  },
  stackMarker(ent, dur) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex().stack, transparent: true, depthWrite: false })); s.scale.setScalar(1.3);
    const g = new THREE.RingGeometry(3.6, 4, 48); g.rotateX(-PI / 2); const ring = new THREE.Mesh(g, addMat('#ffd24a', null, 0.8));
    const grp = new THREE.Group(); grp.add(s); grp.add(ring);
    spawn(grp, dur, (u, dt, ev) => {
      s.position.set(ent.pos.x, ent.pos.y + ent.height + 1.1 + Math.sin(ev.t * 6) * 0.1, ent.pos.z);
      ring.position.set(ent.pos.x, gh(ent.pos.x, ent.pos.z) + 0.1, ent.pos.z); ring.rotation.y += dt;
      ring.material.opacity = 0.5 + Math.sin(ev.t * 8) * 0.3;
    });
  },
  levelUp(ent) {
    this.pillar(ent.pos, '#ffd86a', 9, 1.8, 1.3); this.ring(ent.pos, '#ffe9a0', 5, 1.2);
    for (let i = 0; i < 60; i++) { const a = rand(0, PI * 2), r = rand(0.3, 1.3); G.particles.emit(ent.pos.x + Math.cos(a) * r, ent.pos.y + rand(0, 1), ent.pos.z + Math.sin(a) * r, 0, rand(2, 6), 0, C('#ffe080').multiplyScalar(1.8), 0.4, rand(1, 2)); }
  },
  teleport(ent) {
    this.pillar(ent.pos, '#7ad8ff', 12, 1.6, 1.1); this.ring(ent.pos, '#a8e8ff', 4, 1);
    for (let i = 0; i < 70; i++) { const a = rand(0, PI * 2), r = rand(0.2, 1); G.particles.emit(ent.pos.x + Math.cos(a) * r, ent.pos.y + rand(0, 2), ent.pos.z + Math.sin(a) * r, 0, rand(4, 9), 0, C('#8ae0ff').multiplyScalar(2), 0.35, rand(0.8, 1.5)); }
  },
  sparkle(pos, color = '#fff2a0') { if (Math.random() < 0.3) G.particles.emit(pos.x + rand(-0.4, 0.4), pos.y + rand(0, 0.6), pos.z + rand(-0.4, 0.4), 0, rand(0.5, 1.5), 0, C(color).multiplyScalar(1.6), 0.3, 0.9); },
  targetRing() {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex().target, color: '#ff5a4a', transparent: true, depthWrite: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.renderOrder = 6; m.userData.keepGeo = true; return m;
  },
  lb(kind, caster, target, onHit) {
    if (kind === 'tank') { this.pillar(caster.pos, '#ffe07a', 10, 2, 8); this.ring(caster.pos, '#ffd24a', 14, 1.5); }
    else if (kind === 'healer') { for (const e of G.entities) if (e.faction === 'party' && !e.dead) this.heal(e, '#b8ffd0'); this.pillar(caster.pos, '#9affc0', 12, 2, 10); }
    else if (kind === 'caster') {
      const p = target.pos.clone(); const mat = new THREE.MeshStandardMaterial({ color: '#8a6a4a', emissive: '#ff6a2a', emissiveIntensity: 1.5, flatShading: true });
      const grp = new THREE.Group(); const rocks = [];
      for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.8, 1.6), 0), mat); r.position.set(p.x + rand(-5, 5), p.y + 18 + i * 3, p.z + rand(-5, 5)); grp.add(r); rocks.push(r); }
      spawn(grp, 1.4, (u) => { rocks.forEach((r) => { if (r.position.y > p.y) { r.position.y -= 0.9; r.rotation.x += 0.1; if (r.position.y <= p.y) { this.fire(r.position.clone(), 1.5); } } }); }, () => onHit && onHit());
      return;
    } else if (kind === 'melee') { this.pillar(target.pos, '#ffe0a0', 12, 0.8, 1.8); this.flash(target.pos.clone().setY(target.pos.y + 2), '#ffffff', 8, 0.5); this.fire(target.pos.clone().setY(target.pos.y + 1.5), 1.5); }
    else if (kind === 'ranged') { const f = caster.forward(); const g = new THREE.CylinderGeometry(1, 1, 30, 16, 1, true); g.rotateX(PI / 2); g.translate(0, 0, 15); const m = new THREE.Mesh(g, addMat('#ffe8a0', null, 0.7)); m.position.set(caster.pos.x, caster.pos.y + 1.2, caster.pos.z); m.lookAt(caster.pos.x + f.x, caster.pos.y + 1.2, caster.pos.z + f.z); spawn(m, 0.6, (u) => { m.scale.set(1 - u, 1 - u, 1); m.material.opacity = 0.8 * (1 - u); }); }
    if (onHit) setTimeout(onHit, 350);
  },
};
