// 地形与可行走区域：不依赖 three.js / DOM，客户端场景与联机服务器的战斗模拟共用同一份数据
import { clamp, lerp, smooth, fbm, vnoise } from './mathutil.js';

export class Walk {
  constructor() { this.a = []; this.blk = []; this.grid = new Map(); }
  rect(x0, z0, x1, z1, y) { this.a.push({ t: 'r', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y }); }
  circ(x, z, r, y) { this.a.push({ t: 'c', x, z, r, y }); }
  ramp(x0, z0, x1, z1, ya, yb) { this.a.push({ t: 'p', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), za: z0, zb: z1, ya, yb }); }
  // 任意方向的通道（两端圆头），高度沿通道线性变化
  seg(x0, z0, y0, x1, z1, y1, w) { const dx = x1 - x0, dz = z1 - z0; this.a.push({ t: 's', x0, z0, y0, x1, z1, y1, dx, dz, l2: dx * dx + dz * dz || 1e-6, hw2: (w / 2) * (w / 2) }); }
  area(a) { if (a[0] === 'c') this.circ(a[1], a[2], a[3], a[4]); else if (a[0] === 'r') this.rect(a[1], a[2], a[3], a[4], a[5]); else this.seg(a[1], a[2], a[3], a[4], a[5], a[6], a[7]); }
  height(x, z) {
    let best = null;
    for (const a of this.a) {
      let y = null;
      if (a.t === 'c') { const dx = x - a.x, dz = z - a.z; if (dx * dx + dz * dz <= a.r * a.r) y = a.y; }
      else if (a.t === 's') { const t = clamp(((x - a.x0) * a.dx + (z - a.z0) * a.dz) / a.l2, 0, 1), ex = x - a.x0 - a.dx * t, ez = z - a.z0 - a.dz * t; if (ex * ex + ez * ez <= a.hw2) y = lerp(a.y0, a.y1, t); }
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
  // staticOnly：忽略会开关的门与封锁墙（寻路连线时用）
  blocked(x, z, rad = 0.35, staticOnly = false) {
    const l = this.grid.get(this.key(Math.floor(x / 10), Math.floor(z / 10))); if (!l) return false;
    for (const b of l) {
      if (!b.on || (staticOnly && b.dyn)) continue;
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
// 入口海滩 → 潮汐通道 → 珊瑚洞窟（血迹斑斑的笔记 + 三色珊瑚，选对颜色打开隐藏的门）→ 蛇蝎帮营地（支路藏宝洞）
// → 下坡到隐秘码头（切割者）→ 海盗巢穴 → 跳板登上海盗船（麦迪逊船长）→ 隐秘的开关打开船尾栈桥 → 虎鲸之穴（虎鲸牙·丹恩）
// 可行走区域：['c', x, z, r, y] 洞室；['r', x0, z0, x1, z1, y] 矩形；['s', x0, z0, y0, x1, z1, y1, 宽度] 通道（两端高度不同即为斜坡）
// 末尾可附加 'wood' 表示木质地面（跳板、甲板、栈桥）
export const DUNGEON_AREAS = [
  ['c', 0, -4, 10, 0],                        // 入口海滩
  ['s', 2, -12, 0, -11, -33, 0, 7],           // 潮汐通道
  ['c', -18, -42, 13, 0],                     // 珊瑚洞窟
  ['s', -24, -53, 0, -24, -66, 0, 6.5],       // 隐藏的门
  ['s', -24, -66, 0, -14, -90, 0, 6.5],
  ['c', -10, -100, 12, 0],                    // 蛇蝎帮营地
  ['s', -20, -104, 0, -39, -115, 0, 5],       // 支路
  ['c', -44, -117, 6.5, 0],                   // 藏宝洞
  ['s', -2, -108, 0, 10, -122, -1, 7],        // 下坡通往码头
  ['s', 10, -122, -1, 10, -131, -1, 7],
  ['c', 10, -145, 15, -1],                    // 隐秘码头（切割者）
  ['s', 10, -159, -1, 10, -168, -1, 7],
  ['s', 10, -168, -1, -6, -186, 0, 7],
  ['c', -10, -192, 10, 0],                    // 海盗巢穴
  ['s', -10, -200, 0, -10, -213, 2.5, 4, 'wood'],   // 登船跳板
  ['c', -10, -226, 14, 2.5, 'wood'],                // 海盗船甲板（麦迪逊船长）：船身沿 x 方向，船头朝东
  ['c', 2, -226, 8, 2.5, 'wood'],                   // 船头
  ['c', -22, -226, 8, 2.5, 'wood'],                 // 船尾（船长室）
  ['s', -10, -239, 2.5, -10, -247, 2.5, 4, 'wood'], // 下船栈桥（隐秘的开关控制的门）
  ['s', -10, -247, 2.5, 2, -254, 0.8, 5],
  ['s', 2, -254, 0.8, 2, -259, 0, 5],
  ['c', 2, -276, 18, 0],                      // 虎鲸之穴（虎鲸牙·丹恩）
];
// 水面：不可行走，周围也不生成岩壁（入口外的海、码头边、海盗船四周、丹恩的水潭）
export const DUNGEON_WATER = [['c', 0, 20, 16], ['c', 33, -146, 11], ['c', -10, -226, 21], ['c', 2, -300, 13]];
export const DUNGEON_WATER_Y = -1.6;
export const DUNGEON_SPAWN = [0, -4, Math.PI];

// 场景物件（同时是障碍物）
export const DUNGEON_PROPS = {
  crates: [[-3, -102], [-16, -109], [-17, -188], [-3, -196]],
  tents: [[-19, -96], [-1, -94], [-15, -198]],
  masts: [[-1, -226], [-18, -224]],
  cannons: [60, 120, 240, 300].map((d) => { const a = (d * Math.PI) / 180; return [-10 + Math.cos(a) * 12.5, -226 + Math.sin(a) * 12.5, a]; }).concat([[8.6, -226, 0]]),
  cabin: [-28, -230, -22.5, -222],            // 船长室
  corals: { blue: [-28, -36], red: [-29, -47], green: [-8, -48] },
  memo: [-12, -37],
  coffer: [-47, -119],
  switch: [-22.1, -226],
};
// 门：隐藏的门（珊瑚谜题）与船尾的门（隐秘的开关）；开始时关闭
export const DUNGEON_DOORS = { coral: [-27.6, -60.6, -20.4, -59.4], switch: [-12.6, -244.6, -7.4, -243.4] };
// 头目房间的封锁墙：[封锁id, x0, z0, x1, z1]
export const DUNGEON_SEALS = [['b1', 5.2, -129.9, 14.8, -129.1], ['b1', 5.2, -160.9, 14.8, -160.1], ['b2', -12.6, -211.9, -7.4, -211.1], ['b3', -1.2, -257.4, 5.2, -256.6]];
// 头目房间：中心、半径、名字，以及封锁时把外面的队员传送进来的位置
export const DUNGEON_ARENAS = {
  b1: { x: 10, z: -145, r: 15, name: '隐秘码头', en: 'THE HIDDEN DOCK', entry: [10, -133], parts: [10] },
  b2: { x: -10, z: -226, r: 14, name: '海盗甲板', en: 'THE PIRATE DECK', entry: [-10, -215], parts: [15, 16, 17] },
  b3: { x: 2, z: -276, r: 18, name: '虎鲸之穴', en: "THE ORCATOOTH'S DEN", entry: [2, -261], parts: [21] },
};
// 是否站在头目房间里（封锁时房间外的队员会被传送进来）
export const inArena = (id, x, z) => DUNGEON_ARENAS[id].parts.some((i) => areaDist(DUNGEON_AREAS[i], x, z) < 0);
// 头目房间里的随机可站立位置（召唤小怪用）
export function arenaSpot(W, id, rnd = Math.random) {
  const A = DUNGEON_ARENAS[id];
  for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, r = 5 + rnd() * (A.r - 7), x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r; if (inArena(id, x, z) && !W.blocked(x, z, 0.6)) return [x, z]; }
  return [A.x, A.z];
}
// 进入时显示名字的区域
export const DUNGEON_REGIONS = [
  ['grotto', -18, -42, 13, '珊瑚洞窟', 'THE CORAL GROTTO'],
  ['camp', -10, -100, 12, '蛇蝎帮营地', "THE REAVERS' CAMP"],
  ['b1', 10, -145, 15, '隐秘码头', 'THE HIDDEN DOCK'],
  ['b2', -10, -226, 14, '海盗甲板', 'THE PIRATE DECK'],
  ['b3', 2, -276, 18, '虎鲸之穴', "THE ORCATOOTH'S DEN"],
];
export const DUNGEON_LABELS = [['入口', 0, -4], ['珊瑚洞窟', -18, -42], ['营地', -10, -100], ['藏宝洞', -44, -117], ['隐秘码头', 10, -145], ['海盗巢穴', -10, -192], ['海盗船', -10, -226], ['虎鲸之穴', 2, -276]];
// 小怪（每组一起行动）与头目：[种类, x, z, 封锁id, 等级加成, 索敌半径]
export const DUNGEON_PACKS = [
  [['sahagin', -15, -46], ['sahagin', -21, -40], ['pirate', -13, -51]],
  [['pirate', -9, -98], ['pirate2', -13, -103], ['pirate', -5, -104]],
  [['sahagin', -42, -116], ['sahagin', -46, -114]],
  [['pirate2', -12, -190], ['pirate', -7, -189], ['pirate', -10, -195]],
];
export const DUNGEON_BOSSES = [['chopper', 10, -149, 'b1', 1, 13], ['madison', -10, -230, 'b2', 1, 12], ['denn', 2, -289, 'b3', 2, 26]];
// 团灭后的检查点与通关宝箱
export const dungeonCheckpoint = (done) => (done.madison ? [2, -255] : done.chopper ? [10, -164] : [0, -4]);
export const DUNGEON_CHEST = [2, -268];
// 寻路节点（沿通道与洞室布置，连线由可见性自动计算）
export const DUNGEON_NAV = [
  [0, -4], [1, -14], [-5, -23], [-11, -33], [-18, -42], [-24, -53], [-24, -62], [-21, -74], [-16, -86], [-10, -100],
  [-22, -106], [-33, -112], [-44, -117], [-1, -109], [6, -117], [10, -126], [10, -145], [10, -163], [5, -174], [-2, -182],
  [-10, -192], [-10, -203], [-10, -214], [-10, -226], [-10, -238], [-10, -246], [-4, -251], [2, -256], [2, -268], [2, -280],
];
// 通道两侧的火把：每隔约 12 米交替布置（窄跳板与栈桥上没有）
export const DUNGEON_TORCHES = (() => {
  const out = [];
  for (const a of DUNGEON_AREAS) {
    if (a[0] !== 's' || a[7] < 5) continue;
    const [, x0, z0, , x1, z1, , w] = a, L = Math.hypot(x1 - x0, z1 - z0); if (L < 14) continue;
    const nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
    for (let d = 5, s = 1; d < L - 4; d += 12, s = -s) { const t = d / L; out.push([x0 + (x1 - x0) * t + nx * s * (w / 2 - 0.35), z0 + (z1 - z0) * t + nz * s * (w / 2 - 0.35)]); }
  }
  return out;
})();

// 区域的有向距离（内部为负）
export function areaDist(a, x, z) {
  if (a[0] === 'c') return Math.hypot(x - a[1], z - a[2]) - a[3];
  if (a[0] === 'r') { const dx = Math.max(a[1] - x, 0, x - a[3]), dz = Math.max(a[2] - z, 0, z - a[4]); const out = Math.hypot(dx, dz); return out > 0 ? out : -Math.min(x - a[1], a[3] - x, z - a[2], a[4] - z); }
  const [, x0, z0, , x1, z1, , w] = a, dx = x1 - x0, dz = z1 - z0, t = clamp(((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - x0 - dx * t, z - z0 - dz * t) - w / 2;
}
// 两点之间是否能直接走过去（地面与固定障碍物；会开关的门不算）；r 为身体半宽
export function lineClear(W, x0, z0, x1, z1, r = 0.4) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
  if (L < 0.01) return W.height(x0, z0) !== null;
  const nx = (-dz / L) * r, nz = (dx / L) * r, n = Math.ceil(L / 0.7);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (dx * i) / n, z = z0 + (dz * i) / n;
    if (W.height(x, z) === null || W.height(x + nx, z + nz) === null || W.height(x - nx, z - nz) === null) return false;
    // 起点与终点附近的障碍物不算（走向珊瑚、宝箱等物件，或从它们旁边出发）
    const ti = (L * i) / n; if (ti > 2 && ti < L - 2 && W.blocked(x, z, r, true)) return false;
  }
  return true;
}
// 路点寻路：节点之间按可见性连线，Floyd 求最短路；step() 返回下一个要走向的路点（能直接走到目标时返回 null）
export function makeNav(W, nodes) {
  const n = nodes.length, D = nodes.map(() => new Array(n).fill(Infinity)), NX = nodes.map(() => new Array(n).fill(-1));
  for (let i = 0; i < n; i++) {
    D[i][i] = 0; NX[i][i] = i;
    for (let j = i + 1; j < n; j++) {
      const [ax, az] = nodes[i], [bx, bz] = nodes[j], d = Math.hypot(bx - ax, bz - az);
      if (d < 40 && lineClear(W, ax, az, bx, bz, 0.6)) { D[i][j] = D[j][i] = d; NX[i][j] = j; NX[j][i] = i; }
    }
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][k] + D[k][j] < D[i][j]) { D[i][j] = D[i][k] + D[k][j]; NX[i][j] = NX[i][k]; }
  const near = (x, z) => {
    const order = nodes.map((p, i) => [Math.hypot(p[0] - x, p[1] - z), i]).sort((a, b) => a[0] - b[0]);
    for (const [, i] of order) if (lineClear(W, x, z, nodes[i][0], nodes[i][1], 0.3)) return i;
    return -1;
  };
  return {
    nodes,
    step(x, z, tx, tz) {
      if (lineClear(W, x, z, tx, tz, 0.3)) return null;
      const a = near(x, z), b = near(tx, tz); if (a < 0 || b < 0 || NX[a][b] < 0) return null;
      const path = [a]; for (let c = a; c !== b && path.length <= n;) { c = NX[c][b]; path.push(c); }
      // 走向路径上能直接看到的最远节点，转角处自然抄近路
      for (let k = path.length - 1; k > 0; k--) { const p = nodes[path[k]]; if (lineClear(W, x, z, p[0], p[1], 0.3)) return p; }
      const p = nodes[a];
      return Math.hypot(p[0] - x, p[1] - z) < 0.8 && path.length > 1 ? nodes[path[1]] : p;
    },
  };
}
export function dungeonWalk() {
  const W = new Walk(), P = DUNGEON_PROPS;
  for (const a of DUNGEON_AREAS) W.area(a);
  W.water = DUNGEON_WATER;
  for (const [x, z] of P.crates) W.cb(x + 0.4, z + 0.4, 1.6);
  for (const [x, z] of P.tents) W.cb(x, z, 1.8);
  for (const [x, z] of DUNGEON_TORCHES) W.cb(x, z, 0.3);
  for (const [x, z] of P.cannons) W.cb(x, z, 0.8);
  for (const [x, z] of P.masts) W.cb(x, z, 0.8);
  W.box(...P.cabin);
  for (const [x, z] of Object.values(P.corals)) W.cb(x, z, 1.1);
  W.cb(P.memo[0], P.memo[1], 0.6); W.cb(P.coffer[0], P.coffer[1], 0.7);
  W.cb(2, -291, 7); // 丹恩的身体
  const seals = {}, doors = {};
  for (const [id, x0, z0, x1, z1] of DUNGEON_SEALS) { const b = W.box(x0, z0, x1, z1); b.on = false; b.dyn = true; (seals[id] = seals[id] || []).push(b); }
  for (const [id, r] of Object.entries(DUNGEON_DOORS)) { doors[id] = W.box(...r); doors[id].dyn = true; }
  return { W, seals, doors, nav: makeNav(W, DUNGEON_NAV) };
}
