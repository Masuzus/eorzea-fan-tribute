// 地形与可行走区域：不依赖 three.js / DOM，客户端场景与联机服务器的战斗模拟共用同一份数据
import { clamp, lerp, smooth, fbm, vnoise } from './mathutil.js';

export class Walk {
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

// ---------- 拉诺西亚低地 ----------
export const ROAD = [[-205, 0], [-150, 5], [-110, -4], [-60, 4], [-20, 8], [0, 14], [20, 6], [50, -10], [80, -30], [105, -60], [122, -82]];
export const ROAD2 = [[50, -10], [72, 18], [96, 46]];
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
export function dRoad(x, z) { let d = 1e9; for (const R of [ROAD, ROAD2]) for (let i = 0; i < R.length - 1; i++) d = Math.min(d, segDist(x, z, R[i][0], R[i][1], R[i + 1][0], R[i + 1][1])); return d; }
export function fieldH(x, z) {
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
// 不在海里、不出地图边界（树木岩石等小障碍只在客户端阻挡玩家）
export function fieldOpen(x, z) { return fieldH(x, z) > -1.1 && (Math.hypot(x, z * 1.05) < 188 || (x < -150 && x > -212 && Math.abs(z) < 6.5)); }
export const FIELD_MOBS = [
  { mob: 'ladybug', lv: [2, 4], x: -70, z: 50, r: 16, n: 6 }, { mob: 'ladybug', lv: [2, 3], x: -80, z: -30, r: 14, n: 4 },
  { mob: 'rat', lv: [3, 5], x: 60, z: 30, r: 14, n: 5 }, { mob: 'rat', lv: [4, 5], x: 88, z: -12, r: 10, n: 3 },
  { mob: 'sahagin', lv: [5, 7], x: 104, z: 66, r: 15, n: 4 },
];
export const FATE_AREA = { x: 100, z: 55, r: 20 };

// ---------- 天然要害沙斯塔夏溶洞 ----------
export const DUNGEON_AREAS = [
  ['r', -8, -26, 8, 0], ['r', -4, -40, 4, -24], ['c', 0, -50, 13], ['r', -4, -80, 4, -60], ['c', 0, -94, 16], ['r', -4, -124, 4, -107],
  ['c', 0, -134, 12], ['r', -4, -162, 4, -143], ['c', 0, -176, 16], ['r', -4, -207, 4, -189], ['c', 0, -222, 17],
];
export const DUNGEON_CRATES = [[-9, -44], [8, -58], [-6, -128], [7, -140], [-5, -8], [6, -18]];
export const DUNGEON_TENTS = [[-10, -56], [10, -48]];
export const DUNGEON_TORCHES = [[-6, -30], [6, -30], [-5, -66], [5, -66], [-5, -150], [5, -150], [-5, -196], [5, -196]];
export const DUNGEON_MAST = [8, -186];
export const DUNGEON_CANNONS = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + 0.3; return [Math.cos(a) * 14.5, -176 + Math.sin(a) * 14.5, a]; });
export const DUNGEON_SEALS = [['b1', -78.5], ['b1', -109.5], ['b2', -159.5], ['b2', -191.5], ['b3', -204.5]];
// 每个头目房间：封锁 id、中心与半径、区域名
export const DUNGEON_ARENAS = { b1: [0, -94, 16, '隐秘码头', 'THE HIDDEN DOCK'], b2: [0, -176, 16, '海盗甲板', 'THE PIRATE DECK'], b3: [0, -222, 17, '虎鲸之穴', "THE ORCATOOTH'S DEN"] };
export function dungeonWalk() {
  const W = new Walk();
  for (const a of DUNGEON_AREAS) { if (a[0] === 'r') W.rect(a[1], a[2], a[3], a[4], 0); else W.circ(a[1], a[2], a[3], 0); }
  for (const [x, z] of DUNGEON_CRATES) W.cb(x + 0.4, z + 0.4, 1.6);
  for (const [x, z] of DUNGEON_TENTS) W.cb(x, z, 1.8);
  for (const [x, z] of DUNGEON_TORCHES) W.cb(x, z, 0.3);
  for (const [x, z] of DUNGEON_CANNONS) W.cb(x, z, 0.8);
  W.cb(DUNGEON_MAST[0], DUNGEON_MAST[1], 0.8);
  W.cb(0, -250, 13); // 丹恩所在的水池
  const seals = {};
  for (const [id, z] of DUNGEON_SEALS) { const b = W.box(-4.5, z - 0.4, 4.5, z + 0.4); b.on = false; (seals[id] = seals[id] || []).push(b); }
  return { W, seals };
}
