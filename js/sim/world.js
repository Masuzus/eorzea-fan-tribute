// 无渲染的战斗模拟：联机服务器运行它，客户端只负责显示。
// 规则与单人版 combat.js 一致；所有视觉与音效都以事件（ev）形式发出，由客户端播放。
import { clamp, rand, pick, angDiff } from '../mathutil.js';
import { JOBS, MOBS, ALLIES, ITEMS, weaponItem } from '../data.js';
import { fieldH, fieldOpen, FIELD_MOBS, FATE_AREA, dungeonWalk, DUNGEON_ARENAS } from '../nav.js';
import { NPC_KIT, MOB_RADIUS, FX_DELAY, FX_SPEED, trustFill } from './defs.js';

const PI = Math.PI;
const SKILLS = {};
for (const [job, j] of Object.entries(JOBS)) for (const s of j.skills) SKILLS[job + ':' + s.id] = s;
const r2 = (v) => Math.round(v * 100) / 100;
export const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
export const edge = (a, b) => dist(a, b) - b.radius - a.radius * 0.5;
const has = (e, id) => e.statuses.find((s) => s.id === id);
export const effMax = (e) => Math.round(e.maxHp * (has(e, 'thrill') ? 1.2 : 1));
const face = (e, x, z) => { e.rot = Math.atan2(x - e.x, z - e.z); };
export function playerMaxHp(job, lv, body) { return Math.round((260 + lv * 62) * (JOBS[job].role === 'tank' ? 1.3 : 1) + (body === 'body2' ? 180 : 0)); }
export function inShape(t, x, z, pad = 0) {
  const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
  if (t.shape === 'circle') return d <= t.r + pad;
  if (t.shape === 'donut') return d >= t.rin - pad && d <= t.r + pad;
  if (t.shape === 'cone') { if (d > t.r + pad) return false; if (d < 0.5) return true; return Math.abs(angDiff(t.dir, Math.atan2(dx, dz))) <= (t.angle * PI) / 360 + pad / d; }
  if (t.shape === 'line') { const fx = Math.sin(t.dir), fz = Math.cos(t.dir); const al = dx * fx + dz * fz, ac = Math.abs(dx * fz - dz * fx); return al >= -pad && al <= t.len + pad && ac <= t.width / 2 + pad; }
  return false;
}
const CHECKPOINTS = (done) => (done.madison ? [0, -196] : done.chopper ? [0, -114] : [0, -4]);

export class World {
  constructor(kind, o = {}) {
    Object.assign(this, { kind, time: 0, ents: new Map(), ev: [], timers: [], teles: [], seq: 0, teleSeq: 0, lb: 0, lbMax: 1000, tick3: 0, stack: null, script: null });
    if (kind === 'field') {
      this.fateCD = 15; this.fate = null; this.fateUpd = 0;
      for (const g of FIELD_MOBS) for (let i = 0; i < g.n; i++) this.spawnFieldMob(g);
    } else {
      const { W, seals } = dungeonWalk(); this.W = W; this.seals = seals;
      this.roster = o.roster || [];
      this.duty = { t: 3600, done: { chopper: false, madison: false, denn: false }, started: false, complete: false, wipeT: 0, wiping: false, chest: null, loot: null, present: new Set(), filled: false, bosses: {}, seen: {} };
    }
    this.ev = []; // 构造时产生的生成事件由新加入的玩家通过 spawnList() 获取
  }

  // ---------- 基础 ----------
  heightAt(x, z) { return this.W ? this.W.height(x, z) : fieldH(x, z); }
  canWalk(x, z, r = 0.4) { return this.W ? this.W.height(x, z) !== null && !this.W.blocked(x, z, r) : fieldOpen(x, z); }
  emit(o) { this.ev.push(o); }
  flush() { const e = this.ev; this.ev = []; return e; }
  msg(m, c = 'battle-warn', to) { this.emit(to ? { k: 'msg', m, c, to } : { k: 'msg', m, c }); }
  err(p, m) { if (m && p.kind === 'player') this.emit({ k: 'err', to: p.id, m }); }
  later(t, fn) { this.timers.push({ t, fn }); }
  get(id) { return id ? this.ents.get(id) : null; }
  players() { const out = []; for (const e of this.ents.values()) if (e.kind === 'player') out.push(e); return out; }
  party() { const out = []; for (const e of this.ents.values()) if (e.faction === 'party') out.push(e); return out; }
  enemies() { const out = []; for (const e of this.ents.values()) if (e.faction === 'enemy' && !e.dead) out.push(e); return out; }
  anyCombat() { for (const e of this.ents.values()) if (e.faction === 'enemy' && e.inCombat && !e.dead) return true; return false; }
  base(o) { return { statuses: [], cd: {}, gcd: 0, combo: null, casting: null, target: null, enmity: new Map(), dead: false, deadT: 0, inCombat: false, autoT: rand(0.5, 1.5), abT: {}, aiT: 0, moveSpeed: 0, rot: 0, y: 0, mp: 10000, maxMp: 10000, crit: 0.1, weaponDmg: 0, radius: 0.5, drawn: false, ...o }; }
  atk(e) { return e.kind === 'mob' ? (6 + e.level * 2.6) * (e.mobDmg ?? 1) : 10 + e.level * 2.8 + (e.weaponDmg || 0); }

  // ---------- 玩家 ----------
  addPlayer(id, info, st) {
    const job = JOBS[info.job] ? info.job : 'gla', lv = clamp(Math.round(info.lv) || 1, 1, 15), maxHp = playerMaxHp(job, lv, info.body);
    const p = this.base({ id, kind: 'player', faction: 'party', name: info.name, job, level: lv, role: JOBS[job].role, weaponDmg: weaponItem(job, clamp(Math.round(info.wt) || 0, 0, 2)).dmg, crit: 0.1 + (info.ear ? 0.05 : 0), maxHp, hp: clamp(Math.round(info.hp) || maxHp, 1, maxHp), mp: clamp(Math.round(info.mp ?? 10000), 0, 10000), x: st.x, y: st.y, z: st.z, rot: st.r, drawn: !!st.d, mounted: !!st.m, pend: null, token: info.tk || null, wt: info.wt, body: info.body, ear: info.ear });
    this.ents.set(id, p);
    if (this.kind === 'dungeon') this.dutyJoin(p);
    return p;
  }
  removePlayer(id) {
    if (!this.ents.delete(id)) return;
    for (const e of this.ents.values()) { e.enmity.delete(id); if (e.target === id) e.target = null; }
    if (this.stack && this.stack.target === id) this.stack = null;
  }
  setState(id, st) {
    const p = this.ents.get(id); if (!p || p.kind !== 'player') return;
    p.x = st.x; p.y = st.y; p.z = st.z; p.rot = st.r; p.drawn = !!st.d; p.mounted = !!st.m; p.moveSpeed = st.sp;
  }
  setTarget(id, tid) { const p = this.ents.get(id); if (p) p.target = this.ents.has(tid) ? tid : null; }
  setLook(id, info) {
    const p = this.ents.get(id); if (!p) return;
    const lv = clamp(Math.round(info.lv) || 1, 1, 15), job = JOBS[info.job] ? info.job : p.job;
    if (lv === p.level && info.wt === p.wt && info.body === p.body && info.ear === p.ear && job === p.job) return;
    const pct = p.hp / effMax(p); p.level = lv; p.wt = info.wt; p.body = info.body; p.ear = info.ear;
    if (job !== p.job) { p.job = job; p.role = JOBS[job].role; p.combo = null; p.pend = null; p.statuses = p.statuses.filter((s) => s.debuff); p.cd = {}; }
    p.maxHp = playerMaxHp(p.job, lv, info.body); p.weaponDmg = weaponItem(p.job, clamp(Math.round(info.wt) || 0, 0, 2)).dmg; p.crit = 0.1 + (info.ear ? 0.05 : 0);
    if (!p.dead) p.hp = Math.max(1, Math.round(effMax(p) * pct));
  }

  // ---------- 生成 ----------
  spawnInfo(e) {
    const b = { id: e.id, lv: e.level, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: r2(e.rot), mhp: e.maxHp };
    return e.kind === 'ally' ? { ...b, t: 'ally', ally: e.allyKey, slot: e.slot } : { ...b, t: 'mob', mob: e.mob, boss: e.boss ? 1 : 0, fate: e.fate ? 1 : 0, add: e.add ? 1 : 0 };
  }
  spawnList() { const out = []; for (const e of this.ents.values()) if (e.kind !== 'player' && !(e.dead && e.deadT > 2)) out.push(this.spawnInfo(e)); return out; }
  spawnMob(kind, lv, x, z, o = {}) {
    const def = MOBS[kind], id = 'm' + (++this.seq);
    const e = this.base({ id, kind: 'mob', faction: 'enemy', mob: kind, def, name: def.name, level: lv, maxHp: Math.round((60 + lv * 30) * def.hp), x, z, rot: o.rot ?? rand(0, PI * 2), radius: MOB_RADIUS[kind] ?? 0.55, mobDmg: def.dmg, boss: !!def.boss, mp: 0, wanderR: 5, ...o });
    e.y = this.heightAt(x, z) ?? 0; e.hp = e.maxHp; e.spawn = { x, z };
    this.ents.set(id, e); this.emit({ k: 'sp', ...this.spawnInfo(e) });
    return e;
  }
  spawnFieldMob(g) {
    let x, z, k = 0; do { const a = rand(0, PI * 2), r = rand(0, g.r); x = g.x + Math.cos(a) * r; z = g.z + Math.sin(a) * r; k++; } while (!fieldOpen(x, z) && k < 30);
    return this.spawnMob(g.mob, Math.floor(rand(g.lv[0], g.lv[1] + 1)), x, z, { wanderR: 6, group: g });
  }
  spawnAlly(key, slot, lv, x, z) {
    const A = ALLIES[key], id = 'a' + (++this.seq);
    const e = this.base({ id, kind: 'ally', faction: 'party', allyKey: key, name: A.name, role: A.role, level: lv, maxHp: Math.round((260 + lv * 62) * (A.role === 'tank' ? 1.35 : 1)), x, z, slot });
    e.hp = e.maxHp; this.ents.set(id, e); this.emit({ k: 'sp', ...this.spawnInfo(e) });
    return e;
  }

  // ---------- 状态 / 仇恨 / 伤害 ----------
  addStatus(t, s, srcId) {
    const ex = t.statuses.find((x) => x.id === s.id);
    const st = { ...s, sid: s.baseId || s.sid || s.id, t: s.dur ?? Infinity, src: srcId || null, tickT: 3 }; delete st.icon;
    if (ex) Object.assign(ex, st); else t.statuses.push(st);
    return st;
  }
  removeStatus(t, id) { const i = t.statuses.findIndex((s) => s.id === id); if (i >= 0) { t.statuses.splice(i, 1); return true; } return false; }
  engage(enemy, src) {
    if (enemy.dead || enemy.faction !== 'enemy') return;
    if (!enemy.inCombat) {
      enemy.inCombat = true; enemy.abT = {}; (enemy.def.abilities || []).forEach((a, i) => (enemy.abT[i] = rand(a.every[0] * 0.6, a.every[1] * 0.8)));
      if (enemy.pack) for (const m of enemy.pack) if (m !== enemy && !m.dead) this.engage(m, src);
      if (enemy.boss && this.duty) this.bossEngage(enemy);
    }
    if (src && !enemy.enmity.has(src.id)) enemy.enmity.set(src.id, 1);
  }
  addEnmity(enemy, src, amt) {
    if (enemy.faction !== 'enemy' || src.faction !== 'party') return;
    this.engage(enemy, src);
    enemy.enmity.set(src.id, (enemy.enmity.get(src.id) || 0) + amt * (has(src, 'iron_will') || has(src, 'royal_guard') ? 10 : 1));
  }
  topEnmity(enemy) {
    let best = null, bv = -1;
    for (const [id, v] of enemy.enmity) { const e = this.ents.get(id); if (!e || e.dead) { enemy.enmity.delete(id); continue; } if (v > bv) { bv = v; best = e; } }
    return best;
  }
  damage(src, tgt, potency, o = {}) {
    if (!tgt || tgt.dead || !tgt.hp) return 0;
    if (tgt.def && tgt.def.passiveAdd && src.faction === 'enemy') return 0;
    let mul = 1; for (const s of src.statuses) if (s.dmgUp) mul += s.dmgUp * (s.stacks || 1);
    let crit = Math.random() < (src.crit || 0.1) + (o.critBonus || 0), dh = Math.random() < 0.15;
    const cn = src.statuses.find((s) => s.critNext > 0);
    if (cn && o.ws) { crit = true; cn.critNext--; if (cn.critNext <= 0) this.removeStatus(src, cn.id); }
    if (o.noCrit) { crit = false; dh = false; }
    let dmg = (potency / 100) * this.atk(src) * rand(0.95, 1.05) * mul * (crit ? 1.5 : 1) * (dh ? 1.25 : 1);
    let mit = 1; for (const s of tgt.statuses) if (s.mit) mit *= 1 - s.mit;
    if (tgt.role === 'tank') mit *= 0.8;
    dmg = Math.max(1, Math.round(o.flat || dmg * mit));
    tgt.hp = Math.max(0, tgt.hp - dmg);
    if (tgt.faction === 'enemy') {
      this.addEnmity(tgt, src, dmg * (o.enmity || 1));
      if (src.faction === 'party' && this.duty) this.lb = Math.min(this.lbMax, this.lb + dmg * 0.02);
      if (tgt.fate && this.fate && src.kind === 'player') this.fate.cr.add(src.id);
    }
    if (tgt.faction === 'party' && src.faction === 'enemy' && this.duty) this.lb = Math.min(this.lbMax, this.lb + 1.5);
    this.emit({ k: 'hit', s: src.id, t: tgt.id, v: dmg, c: crit ? 1 : 0, d: dh ? 1 : 0, n: o.name || '', dot: o.dot ? 1 : 0 });
    if (tgt.hp <= 0) this.kill(tgt, src);
    return dmg;
  }
  heal(src, tgt, potency, o = {}) {
    if (!tgt || tgt.dead) return 0;
    const crit = Math.random() < 0.1;
    const h = Math.round(o.flat || (potency / 100) * (10 + src.level * 2.8 + (src.weaponDmg || 0)) * rand(0.95, 1.05) * (crit ? 1.5 : 1));
    const before = tgt.hp; tgt.hp = Math.min(effMax(tgt), tgt.hp + h);
    const real = tgt.hp - before;
    if (src.faction === 'party') for (const e of this.enemies()) if (e.inCombat) this.addEnmity(e, src, real * 0.4);
    this.emit({ k: 'heal', s: src.id, t: tgt.id, v: h, c: crit ? 1 : 0, sh: o.show ? 1 : 0 });
    return real;
  }
  kill(e, src) {
    if (e.dead) return;
    e.dead = true; e.hp = 0; e.deadT = 0; this.interrupt(e, true); e.statuses = e.statuses.filter((s) => s.keep); e.target = null; e.pend = null;
    this.emit({ k: 'die', id: e.id });
    if (e.faction === 'enemy') {
      for (const t of this.teles) if (t.src === e.id && !t.keep) t.cancel = true;
      // 副本里全队共享击杀；野外按仇恨表（参与过战斗的玩家）计算
      const cr = this.duty ? this.players().map((x) => x.id) : [...e.enmity.keys()].filter((id) => { const x = this.ents.get(id); return x && x.kind === 'player'; });
      if (src && src.kind === 'player' && !cr.includes(src.id)) cr.push(src.id);
      this.emit({ k: 'kill', id: e.id, mob: e.mob, lv: e.level, boss: e.boss ? 1 : 0, fb: e.def.fateBoss ? 1 : 0, pa: e.def.passiveAdd ? 1 : 0, cr });
      if (e.group) this.later(rand(18, 30), () => { if (this.kind === 'field') this.spawnFieldMob(e.group); });
      if (e.fate && this.fate) this.fateKill(e);
      if (this.duty) this.dutyKill(e);
    } else {
      for (const en of this.enemies()) en.enmity.delete(e.id);
      if (this.stack && this.stack.target === e.id) this.stack = null;
    }
  }
  revive(e, pct = 0.25) {
    if (!e.dead) return;
    e.dead = false; e.hp = Math.max(1, Math.round(effMax(e) * pct)); e.mp = Math.max(e.mp, e.maxMp * 0.3);
    this.addStatus(e, { id: 'weak', name: '衰弱', dur: 20, debuff: true, dmgUp: -0.2 });
    this.emit({ k: 'rv', id: e.id });
  }

  // ---------- 玩家技能 ----------
  mpCost(src, sk) {
    if (!sk.mp) return 0; if (sk.freeWith && has(src, sk.freeWith)) return 0;
    if (sk.element === 'ice' && has(src, 'umbral_ice')) return 0;
    if (sk.element === 'fire' && has(src, 'astral_fire')) return sk.mp * 2;
    return sk.mp;
  }
  castTime(src, sk) {
    if (!sk.cast) return 0; if (has(src, 'swiftcast') && sk.kind === 'spell') return 0; if (sk.instantWith && has(src, sk.instantWith)) return 0;
    return sk.cast;
  }
  resolveTarget(p, sk, tid) {
    const t = this.get(tid);
    if (sk.target === 'enemy') {
      if (t && t.faction === 'enemy' && !t.dead) return t;
      const near = this.enemies().filter((e) => dist(p, e) < 25).sort((a, b) => dist(p, a) - dist(p, b))[0];
      if (near) { p.target = near.id; this.emit({ k: 'tgt', to: p.id, id: near.id }); }
      return near || null;
    }
    if (sk.target === 'ally') return t && t.faction === 'party' && !t.dead ? t : p;
    if (sk.target === 'dead') return t && t.faction === 'party' && t.dead ? t : null;
    return p;
  }
  // 校验一次技能请求；返回 [技能, 目标] 或 null（并通知玩家原因）
  checkUse(p, skId, tid, starting) {
    if (!p || p.kind !== 'player') return null;
    if (p.dead) return null;
    const sk = SKILLS[p.job + ':' + skId];
    if (!sk) return null;
    if (sk.lv > p.level) { this.err(p, '等级不足'); return null; }
    if (has(p, 'stun')) { this.err(p, '眩晕中'); return null; }
    if (sk.requires && !has(p, sk.requires)) { this.err(p, '发动条件未满足'); return null; }
    if (!starting && !sk.gcd && (p.cd[sk.id] || 0) > 0.6) { this.err(p, '尚未准备好'); return null; }
    if (this.mpCost(p, sk) > p.mp) { this.err(p, '魔力不足'); return null; }
    const tgt = this.resolveTarget(p, sk, tid);
    if (!tgt && sk.target !== 'none') { this.err(p, sk.target === 'dead' ? '请选中无法战斗的队员' : '没有可用的目标'); return null; }
    if (tgt && tgt !== p && edge(p, tgt) > (sk.range || 3) + 3) { this.err(p, '目标不在射程内'); return null; }
    return [sk, tgt];
  }
  // 公共复唱的服务器端校验：比客户端宽松一些，用来挡住明显的连发
  gcdReady(p, sk, ct) {
    if (!sk.gcd) return true;
    if (this.time - (p.gcdAt ?? -99) < (p.gcdLen || 2.5) * 0.8) return false;
    p.gcdAt = this.time; p.gcdLen = Math.max(2.5, ct); return true;
  }
  intentCast(id, m) {
    const p = this.ents.get(id), r = this.checkUse(p, m.sk, m.tg, true); if (!r) return;
    const [sk, tgt] = r, ct = this.castTime(p, sk); if (ct <= 0 || !this.gcdReady(p, sk, ct)) return;
    p.pend = { sk: sk.id, at: this.time, ct, tg: tgt ? tgt.id : null };
    if (tgt && tgt !== p) face(p, tgt.x, tgt.z);
    this.emit({ k: 'cast', id: p.id, n: sk.name, tt: ct, el: sk.element || (sk.heal || sk.raise || sk.esuna ? 'heal' : '') });
  }
  intentInterrupt(id) { const p = this.ents.get(id); if (p && p.pend) { p.pend = null; this.emit({ k: 'ce', id, i: 1 }); } }
  intentUse(id, m) {
    const p = this.ents.get(id), r = this.checkUse(p, m.sk, m.tg, false); if (!r) return;
    const [sk, tgt] = r, ct = this.castTime(p, sk);
    if (ct > 0) {
      const c = p.pend;
      if (!c || c.sk !== sk.id || this.time - c.at < c.ct * 0.7) return; // 没有对应的咏唱，或咏唱时间明显不足
      p.pend = null; this.emit({ k: 'ce', id });
    } else if (!this.gcdReady(p, sk, 0)) return;
    if (!sk.gcd && sk.recast) p.cd[sk.id] = sk.recast;
    if (tgt && tgt !== p) face(p, tgt.x, tgt.z);
    this.consumeOnCast(p, sk);
    this.execute(p, sk, tgt);
  }
  consumeOnCast(src, sk) {
    src.mp -= this.mpCost(src, sk);
    if (sk.kind === 'spell' && has(src, 'swiftcast') && sk.cast) this.removeStatus(src, 'swiftcast');
    if (sk.freeWith && has(src, sk.freeWith)) this.removeStatus(src, sk.freeWith);
    else if (sk.instantWith && has(src, sk.instantWith)) this.removeStatus(src, sk.instantWith);
    if (sk.requires) this.removeStatus(src, sk.requires);
  }
  fxDelay(kind, src, tgt) { return FX_SPEED[kind] && tgt ? dist(src, tgt) / FX_SPEED[kind] : FX_DELAY[kind] || 0; }
  execute(src, sk, tgt) {
    let pot = sk.potency || 0, comboHit = false;
    if (sk.combo && src.combo && src.combo.id === sk.combo.from && src.combo.t > 0) { pot = sk.combo.potency; comboHit = true; }
    if (sk.gcd && sk.kind === 'ws') { src.combo = !sk.combo || comboHit ? { id: sk.id, t: 15 } : null; this.emit({ k: 'combo', to: src.id, id: src.combo ? sk.id : '' }); }
    if (comboHit) { if (sk.combo.mp) src.mp = Math.min(src.maxMp, src.mp + sk.combo.mp); if (sk.combo.heal) this.heal(src, src, sk.combo.heal); if (sk.combo.buff) this.addStatus(src, sk.combo.buff, src.id); }
    if (sk.element === 'fire') { if (has(src, 'umbral_ice')) { this.removeStatus(src, 'umbral_ice'); pot *= 0.9; } else if (has(src, 'astral_fire')) pot *= 1.4; this.addStatus(src, { id: 'astral_fire', name: '星极火', dur: 15 }); }
    if (sk.element === 'ice') { if (has(src, 'astral_fire')) { this.removeStatus(src, 'astral_fire'); pot *= 0.9; } this.addStatus(src, { id: 'umbral_ice', name: '灵极冰', dur: 15, mpTick: 1600 }); }
    if (sk.transpose) {
      if (has(src, 'astral_fire')) { this.removeStatus(src, 'astral_fire'); this.addStatus(src, { id: 'umbral_ice', name: '灵极冰', dur: 15, mpTick: 1600 }); }
      else if (has(src, 'umbral_ice')) { this.removeStatus(src, 'umbral_ice'); this.addStatus(src, { id: 'astral_fire', name: '星极火', dur: 15 }); }
      this.emit({ k: 'fx', f: 'transpose', s: src.id });
    }
    if (sk.buff) { this.addStatus(src, sk.buff, src.id); this.emit({ k: 'fx', f: 'buff', s: src.id }); }
    if (sk.toggle) { if (has(src, sk.toggle)) this.removeStatus(src, sk.toggle); else this.addStatus(src, { id: sk.toggle, name: sk.name, enmityMul: 10, keep: true }); this.emit({ k: 'fx', f: 'toggle', s: src.id }); }
    if (sk.healSelf) this.heal(src, src, 0, { flat: effMax(src) * sk.healSelf });
    if (sk.healPot) { this.heal(src, src, sk.healPot); this.emit({ k: 'fx', f: 'heal', s: src.id, t: src.id }); }
    if (sk.provoke && tgt) { let mx = 0; for (const v of tgt.enmity.values()) mx = Math.max(mx, v); tgt.enmity.set(src.id, mx + 500); this.engage(tgt, src); this.emit({ k: 'fx', f: 'provoke', s: src.id, t: tgt.id }); }
    const ws = sk.kind === 'ws', skKey = src.job + ':' + sk.id;
    const hitOne = (t) => {
      if (!t || t.dead) return;
      if (pot) this.damage(src, t, pot, { name: sk.name, ws, enmity: sk.enmityMul });
      if (sk.dot) this.addStatus(t, { ...sk.dot, debuff: true, dot: sk.dot.potency, srcId: src.id, id: sk.dot.id + src.id, baseId: sk.dot.id }, src.id);
      if (sk.stun && !t.boss) { this.addStatus(t, { id: 'stun', name: '眩晕', dur: sk.stun, debuff: true }); this.interrupt(t, true); }
    };
    const delay = this.fxDelay(sk.vfx, src, tgt);
    if (sk.aoe) {
      const a = sk.aoe, c = a.at === 'target' && tgt ? tgt : src;
      const shape = { shape: a.shape, x: c.x, z: c.z, r: a.r, angle: a.angle, dir: src.rot, len: a.len, width: a.width };
      const pool = a.ally ? this.party().filter((e) => !e.dead) : this.enemies();
      const hits = pool.filter((e) => inShape(shape, e.x, e.z, e.radius * 0.7));
      this.emit({ k: 'fx', f: sk.vfx, s: src.id, t: (tgt || src).id, sk: skKey });
      this.later(delay, () => { if (sk.heal) hits.forEach((h) => { this.heal(src, h, sk.heal, { show: true }); this.emit({ k: 'fx', f: 'heal', s: src.id, t: h.id }); }); else hits.forEach(hitOne); });
    } else if (sk.heal) {
      this.emit({ k: 'fx', f: sk.vfx, s: src.id, t: tgt.id, sk: skKey });
      this.heal(src, tgt, sk.heal);
    } else if (sk.esuna) {
      const d = tgt.statuses.find((s) => s.cleansable); if (d) this.removeStatus(tgt, d.id);
      this.emit({ k: 'fx', f: 'esuna', s: src.id, t: tgt.id, n: d ? d.name : '' });
    } else if (sk.raise) {
      if (tgt.dead) this.revive(tgt, 0.3);
      this.emit({ k: 'fx', f: 'raise', s: src.id, t: tgt.id });
    } else if (sk.target === 'enemy' && tgt) {
      this.emit({ k: 'fx', f: sk.vfx, s: src.id, t: tgt.id, sk: skKey });
      this.later(delay, () => hitOne(tgt));
    }
    if (sk.proc && Math.random() < sk.proc.chance) { this.addStatus(src, sk.proc, src.id); this.emit({ k: 'proc', to: src.id, n: sk.proc.name }); }
  }
  intentGeneral(id, g) {
    const p = this.ents.get(id); if (!p || p.dead) return;
    if (g === 'potion') { if ((p.cd.potion || 0) > 1) return this.err(p, '尚未准备好'); p.cd.potion = 30; this.heal(p, p, 0, { flat: effMax(p) * 0.3 }); this.emit({ k: 'fx', f: 'potion', s: p.id }); }
    if (g === 'lb') this.useLB(p);
    if (g === 'rv') this.checkpointRevive(p);
  }

  // ---------- 敌方咏唱与范围预兆 ----------
  interrupt(e) {
    if (e.pend) { e.pend = null; this.emit({ k: 'ce', id: e.id, i: 1 }); }
    if (!e.casting) return;
    for (const tid of e.casting.tele || []) { const t = this.teles.find((x) => x.id === tid); if (t) t.cancel = true; }
    if (e.faction === 'party') e.gcd = 0;
    e.casting = null; this.emit({ k: 'ce', id: e.id, i: 1 });
  }
  aoe(src, t, cast, onHit, o = {}) {
    const tel = { ...t, id: ++this.teleSeq, src: src.id, end: this.time + cast, dur: cast, onHit, potency: o.potency, name: o.name, keep: o.keep, follow: o.follow || null };
    this.emit({ k: 'tele', i: tel.id, sh: t.shape, x: r2(t.x), z: r2(t.z), r: t.r, rin: t.rin, an: t.angle, dir: t.dir != null ? r2(t.dir) : undefined, len: t.len, w: t.width, d: cast, f: tel.follow });
    this.teles.push(tel);
    return tel;
  }
  resolveTele(tel) {
    const victims = this.party().filter((e) => !e.dead && inShape(tel, e.x, e.z, e.radius * 0.4));
    this.emit({ k: 'aoe', i: tel.id, sh: tel.shape, x: r2(tel.x), z: r2(tel.z), r: tel.r, an: tel.angle, dir: tel.dir != null ? r2(tel.dir) : undefined, len: tel.len, w: tel.width });
    const src = this.ents.get(tel.src) || { faction: 'enemy', statuses: [], kind: 'mob', level: 1, id: tel.src };
    if (tel.onHit) tel.onHit(victims); else victims.forEach((v) => this.damage(src, v, tel.potency || 300, { name: tel.name, noCrit: true }));
  }
  startEnemyCast(e, name, cast, teles, onDone, o = {}) {
    e.casting = { name, t: 0, total: cast, tele: (teles || []).map((t) => t.id), onDone, enemy: true, buster: o.buster };
    this.emit({ k: 'cast', id: e.id, n: name, tt: cast, b: o.buster ? 1 : 0, a: o.anim || 'cast' });
  }

  // ---------- 主循环 ----------
  step(dt) {
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const t = this.teles[i];
      if (t.follow) { const f = this.ents.get(t.follow); if (f) { t.x = f.x; t.z = f.z; } }
      if (t.cancel) { this.teles.splice(i, 1); this.emit({ k: 'tc', i: t.id }); continue; }
      if (this.time >= t.end) { this.teles.splice(i, 1); this.resolveTele(t); }
    }
    this.tick3 += dt; const serverTick = this.tick3 >= 3; if (serverTick) this.tick3 -= 3;
    const combat = this.anyCombat();
    for (const e of this.ents.values()) {
      e.gcd = Math.max(0, e.gcd - dt);
      for (const k in e.cd) if (e.cd[k] > 0) e.cd[k] -= dt;
      if (e.combo) { e.combo.t -= dt; if (e.combo.t <= 0) e.combo = null; }
      for (let i = e.statuses.length - 1; i >= 0; i--) {
        const s = e.statuses[i]; s.t -= dt;
        if (!e.dead && (s.dot || s.hot)) {
          s.tickT -= dt;
          if (s.tickT <= 0) { s.tickT += 3; const src = this.ents.get(s.srcId) || this.ents.get(s.src) || e; if (s.dot) this.damage(src && !src.dead ? src : e, e, s.dot, { dot: true, noCrit: !src || src.faction === 'enemy' }); if (s.hot) this.heal(src, e, s.hot); }
        }
        if (s.t <= 0) e.statuses.splice(i, 1);
      }
      if (e.dead) { e.deadT += dt; continue; }
      if (serverTick && e.faction === 'party') {
        let mpT = combat ? 200 : 700; for (const s of e.statuses) if (s.mpTick) mpT += s.mpTick; if (has(e, 'astral_fire')) mpT = 0;
        e.mp = Math.min(e.maxMp, e.mp + mpT);
        if (!combat) e.hp = Math.min(effMax(e), e.hp + Math.round(effMax(e) * 0.1));
      }
      if (e.hp > effMax(e)) e.hp = effMax(e);
      if (e.kb) { const k = e.kb, step = Math.min(k.t, dt); k.t -= dt; const nx = e.x + k.dx * 20 * step, nz = e.z + k.dz * 20 * step; if (this.canWalk(nx, nz, 0.3)) { e.x = nx; e.z = nz; } if (k.t <= 0) e.kb = null; }
      if (e.casting) {
        const c = e.casting; c.t += dt;
        if (c.t >= c.total) { e.casting = null; this.emit({ k: 'ce', id: e.id }); if (c.onDone) c.onDone(); }
      }
      if (e.kind === 'player') this.playerAuto(e, dt);
      else if (e.kind === 'ally') this.allyAuto(e, dt);
    }
    for (const e of [...this.ents.values()]) {
      if (e.kind === 'mob') { if (!e.dead) this.enemyAI(e, dt); else if (e.deadT > 3) { this.ents.delete(e.id); this.emit({ k: 'rm', id: e.id }); } }
      else if (e.kind === 'ally') this.allyAI(e, dt);
    }
    if (this.duty && combat) this.lb = Math.min(this.lbMax, this.lb + dt * 6);
    if (this.stack) this.updateStack(dt);
    if (this.script) this.script.update(dt);
    if (this.kind === 'field') this.updateFate(dt);
    else this.updateDuty(dt);
  }
  playerAuto(p, dt) {
    if (!p.drawn || p.mounted || p.pend) return;
    const t = this.ents.get(p.target), job = JOBS[p.job]; if (!t || t.faction !== 'enemy' || t.dead || job.caster) return;
    p.autoT -= dt;
    if (p.autoT > 0 || edge(p, t) > (job.autoRange || 3.2) + 0.5) return;
    p.autoT = job.auto;
    if (job.autoRange) { this.emit({ k: 'fx', f: 'autoarrow', s: p.id, t: t.id }); this.later(dist(p, t) / 45, () => this.damage(p, t, 70, {})); }
    else { this.emit({ k: 'fx', f: 'auto', s: p.id, t: t.id }); this.damage(p, t, 85, {}); }
  }
  allyAuto(a, dt) {
    if (!a.drawn || a.casting || (a.role !== 'tank' && a.role !== 'melee')) return;
    const t = this.ents.get(a.target); if (!t || t.faction !== 'enemy' || t.dead) return;
    a.autoT -= dt; if (a.autoT > 0 || edge(a, t) > 3.2) return;
    a.autoT = 2.8; this.emit({ k: 'fx', f: 'auto', s: a.id, t: t.id }); this.damage(a, t, 85, {});
  }

  // ---------- 移动 ----------
  moveToward(e, tx, tz, speed, dt, stopDist = 0.3) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d <= stopDist) { e.moveSpeed = 0; return true; }
    const step = Math.min(d - stopDist * 0.5, speed * dt), nx = e.x + (dx / d) * step, nz = e.z + (dz / d) * step, r = Math.min(e.radius * 0.6, 0.5);
    const stuck = !this.canWalk(e.x, e.z, r), ok = (x, z) => stuck || this.canWalk(x, z, r);
    if (ok(nx, nz)) { e.x = nx; e.z = nz; } else if (ok(nx, e.z)) e.x = nx; else if (ok(e.x, nz)) e.z = nz;
    const h = this.heightAt(e.x, e.z); if (h !== null) e.y = h;
    e.rot += angDiff(e.rot, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
    e.moveSpeed = speed; return false;
  }
  dangerAt(x, z, pad = 0.6, minLeft = 0.25) { for (const t of this.teles) if (t.end - this.time > minLeft && inShape(t, x, z, pad)) return true; return false; }
  safeSpot(e) {
    let best = null, bd = 1e9; const st = this.stack && this.ents.get(this.stack.target);
    for (const r of [3, 5, 7, 10, 14]) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2, x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r;
      if (!this.canWalk(x, z, 0.4) || this.dangerAt(x, z, 1.0, -1)) continue;
      const d = r + (st && st !== e ? Math.hypot(x - st.x, z - st.z) * 0.3 : 0);
      if (d < bd) { bd = d; best = [x, z]; }
      if (best && r >= 5) break;
    }
    return best;
  }

  // ---------- 敌人 AI ----------
  enemyAI(e, dt) {
    const def = e.def;
    if (has(e, 'stun')) { e.moveSpeed = 0; return; }
    if (!e.inCombat) {
      if ((def.aggro || e.aggro) && !e.noAggro) for (const p of this.party()) if (!p.dead && !p.mounted && dist(e, p) < (e.aggroR || def.aggroR || 8) && p.level < e.level + 10) { this.engage(e, p); break; }
      if (!e.inCombat && !def.noMove && !e.noWander) {
        e.aiT -= dt;
        if (e.wander) { if (this.moveToward(e, e.wander[0], e.wander[1], 1.6, dt, 0.4)) e.wander = null; }
        else { e.moveSpeed = 0; if (e.aiT <= 0) { e.aiT = rand(4, 9); const a = rand(0, PI * 2), r = rand(1, e.wanderR || 5); const x = e.spawn.x + Math.cos(a) * r, z = e.spawn.z + Math.sin(a) * r; if (this.canWalk(x, z, 0.4)) e.wander = [x, z]; } }
      }
      if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt * 0.2);
      return;
    }
    const tgt = this.topEnmity(e);
    if (!tgt) { this.resetEnemy(e); return; }
    if (!def.noMove && Math.hypot(e.x - e.spawn.x, e.z - e.spawn.z) > (e.leash || 50)) { this.resetEnemy(e); return; }
    e.target = tgt.id;
    if (e.casting) { e.moveSpeed = 0; return; }
    const d = edge(e, tgt);
    if (d > def.range && !def.noMove) { this.moveToward(e, tgt.x, tgt.z, def.speed || 5, dt, 0.2); return; }
    e.moveSpeed = 0; if (!def.noMove || e.boss) face(e, tgt.x, tgt.z);
    (def.abilities || []).forEach((ab, i) => {
      e.abT[i] -= dt;
      if (e.abT[i] <= 0 && !e.casting) {
        e.abT[i] = rand(ab.every[0], ab.every[1]);
        const t = ab.shape === 'circle' ? { shape: 'circle', x: e.x, z: e.z, r: ab.r } : ab.shape === 'cone' ? { shape: 'cone', x: e.x, z: e.z, r: ab.r, angle: ab.angle, dir: e.rot } : { shape: 'line', x: e.x, z: e.z, len: ab.len, width: ab.width, dir: e.rot };
        const tel = this.aoe(e, t, ab.cast, null, { potency: ab.potency, name: ab.name });
        this.startEnemyCast(e, ab.name, ab.cast, [tel], () => this.emit({ k: 'anim', id: e.id, a: 'attack' }));
      }
    });
    if (e.casting) return;
    e.autoT -= dt;
    if (e.autoT <= 0 && d <= def.range + 0.5) {
      e.autoT = def.delay || 3; this.emit({ k: 'anim', id: e.id, a: 'attack' });
      this.later(0.25, () => { if (!e.dead && !tgt.dead) { this.damage(e, tgt, 100, {}); this.emit({ k: 'fx', f: 'mobhit', t: tgt.id }); } });
    }
  }
  resetEnemy(e) {
    e.inCombat = false; e.enmity.clear(); e.target = null; this.interrupt(e, true); e.statuses = []; e.wander = [e.spawn.x, e.spawn.z];
    if (e.boss && this.duty) this.clearBossFight(e, false);
  }

  // ---------- 队友（亲信战友）AI ----------
  leader() { const ps = this.players(); return ps.find((p) => !p.dead) || ps[0] || null; }
  allyAI(a, dt) {
    if (a.dead) { a.moveSpeed = 0; return; }
    const P = this.leader(); if (!P) { a.moveSpeed = 0; return; }
    const en = this.enemies().filter((e) => e.inCombat);
    a.aiT -= dt;
    if (a.dodge) { if (this.moveToward(a, a.dodge[0], a.dodge[1], 6.5, dt, 0.4) || this.time > a.dodgeUntil) a.dodge = null; else return; }
    if (a.reactT === undefined) a.reactT = 0;
    if (this.dangerAt(a.x, a.z)) { a.reactT += dt; if (a.reactT > (a.role === 'tank' ? 0.35 : 0.5)) { if (a.casting) this.interrupt(a, true); const s = this.safeSpot(a); if (s) { a.dodge = s; a.dodgeUntil = this.time + 2.5; } a.reactT = 0; } }
    else a.reactT = 0;
    if (a.casting) { a.moveSpeed = 0; return; }
    const st = this.stack && this.ents.get(this.stack.target);
    if (st && st !== a) { if (dist(a, st) > 1.8) { this.moveToward(a, st.x, st.z, 6.5, dt, 1.2); return; } a.moveSpeed = 0; return; }
    if (!en.length) {
      a.drawnT = Math.max(0, (a.drawnT || 0) - dt); if (a.drawnT <= 0) a.drawn = false;
      const idx = a.slot || 1, fx = Math.sin(P.rot), fz = Math.cos(P.rot);
      const tx = P.x - fx * 2.4 + Math.cos(P.rot) * (idx - 2) * 1.8, tz = P.z - fz * 2.4 - Math.sin(P.rot) * (idx - 2) * 1.8;
      const d = Math.hypot(tx - a.x, tz - a.z);
      if (d > 25) { a.x = tx; a.z = tz; a.y = P.y; }
      if (d > 1.2) this.moveToward(a, tx, tz, d > 6 ? 7.5 : 4, dt, 0.6); else { a.moveSpeed = 0; a.rot += angDiff(a.rot, P.rot) * dt * 3; }
      if (a.role === 'healer' && a.gcd <= 0) { const low = this.party().find((e) => !e.dead && e.hp < effMax(e) * 0.6); if (low) this.npcHeal(a, low, 450, '医术'); }
      if (a.role === 'healer' && a.gcd <= 0 && !a.casting) { const dead = this.party().find((e) => e.dead); if (dead) this.npcRaise(a, dead); }
      return;
    }
    a.drawn = true; a.drawnT = 8;
    const role = a.role, tank = this.party().find((e) => e.role === 'tank' && !e.dead);
    let tgt = null;
    if (role === 'tank') {
      const loose = en.filter((e) => !e.def.passiveAdd && this.topEnmity(e) !== a && !e.boss).sort((x, y) => dist(a, x) - dist(a, y))[0];
      const cur = this.ents.get(a.target);
      tgt = loose || (cur && !cur.dead && cur.inCombat ? cur : en.filter((e) => !e.def.passiveAdd).sort((x, y) => (y.boss ? 1 : 0) - (x.boss ? 1 : 0) || dist(a, x) - dist(a, y))[0]);
      if (!has(a, 'royal_guard')) this.addStatus(a, { id: 'royal_guard', name: '王室亲卫', enmityMul: 10, keep: true });
    } else {
      const adds = en.filter((e) => e.def.passiveAdd), tt = tank && this.ents.get(tank.target), pt = this.ents.get(P.target);
      tgt = (role !== 'healer' && adds.length ? adds.sort((x, y) => dist(a, x) - dist(a, y))[0] : null) || (tt && !tt.dead && tt.faction === 'enemy' ? tt : null) || (pt && pt.faction === 'enemy' && !pt.dead ? pt : null) || en.sort((x, y) => dist(a, x) - dist(a, y))[0];
    }
    if (!tgt) return;
    a.target = tgt.id;
    if (role === 'healer') {
      const pt = this.party(), dead = pt.find((e) => e.dead);
      const low = pt.filter((e) => !e.dead).sort((x, y) => x.hp / effMax(x) - y.hp / effMax(y));
      const nLow = low.filter((e) => e.hp / effMax(e) < 0.7).length, poisoned = pt.find((e) => !e.dead && e.statuses.some((s) => s.cleansable));
      if (a.gcd <= 0) {
        if (nLow >= 3) return this.npcAoeHeal(a);
        if (low[0] && low[0].hp / effMax(low[0]) < 0.72) { const crit = low[0].hp / effMax(low[0]) < 0.4; return this.npcHeal(a, low[0], crit ? 700 : 480, crit ? '鼓舞激励之策' : '医术'); }
        if (dead && !this.dangerAt(a.x, a.z, 1, -1)) return this.npcRaise(a, dead);
        if (poisoned) return this.npcEsuna(a, poisoned);
      }
      const d = edge(a, tgt);
      if (d > 20 || d < 6) { const dx = a.x - tgt.x, dz = a.z - tgt.z, l = Math.hypot(dx, dz) || 1; this.moveToward(a, tgt.x + (dx / l) * (11 + tgt.radius), tgt.z + (dz / l) * (11 + tgt.radius), 6, dt, 1); return; }
      a.moveSpeed = 0; face(a, tgt.x, tgt.z);
      if (a.gcd <= 0 && a.aiT <= 0) { const k = NPC_KIT.healer.dmg; this.npcCast(a, tgt, k.cast, k.name, () => this.npcHit(a, tgt, k)); }
      return;
    }
    const want = role === 'tank' || role === 'melee' ? 1.2 : 13, ang = role === 'melee' ? tgt.rot + PI : null, d = edge(a, tgt);
    if (role === 'caster' || role === 'ranged') {
      if (d > 22 || d < 5) { let dx = a.x - tgt.x, dz = a.z - tgt.z, l = Math.hypot(dx, dz); if (l < 0.3) { dx = 0; dz = 1; l = 1; } this.moveToward(a, tgt.x + (dx / l) * (want + tgt.radius), tgt.z + (dz / l) * (want + tgt.radius), 6, dt, 1); return; }
    } else {
      let tx, tz;
      if (ang !== null && tgt.boss) { const r = tgt.radius + want; tx = tgt.x + Math.sin(ang) * r; tz = tgt.z + Math.cos(ang) * r; }
      else { let dx = a.x - tgt.x, dz = a.z - tgt.z, l = Math.hypot(dx, dz); if (l < 0.1) { dx = 0; dz = 1; l = 1; } tx = tgt.x + (dx / l) * (tgt.radius + want); tz = tgt.z + (dz / l) * (tgt.radius + want); }
      if (d > 2.4 || (ang !== null && Math.hypot(tx - a.x, tz - a.z) > 2.5)) { this.moveToward(a, tx, tz, 6.5, dt, 0.5); if (d > 2.4) return; }
    }
    a.moveSpeed = 0; face(a, tgt.x, tgt.z);
    if (a.gcd > 0 || a.aiT > 0) return;
    const kit = NPC_KIT[role === 'ranged' ? 'caster' : role];
    const nearby = en.filter((e) => dist(e, role === 'caster' ? tgt : a) < 6 && !e.def.passiveAdd).length;
    if (kit.aoe && nearby >= 3) {
      const k = kit.aoe, centre = k.cast ? tgt : a;
      const hitAll = () => en.filter((e) => !e.dead && dist(e, centre) < k.r + e.radius).forEach((e) => this.damage(a, e, k.p, {}));
      if (k.cast) return this.npcCast(a, tgt, k.cast, k.name, () => { this.emit({ k: 'anim', id: a.id, a: k.anim }); this.emit({ k: 'fx', f: k.fx, s: a.id, t: tgt.id, r: k.r }); this.later(this.fxDelay(k.fx, a, tgt), hitAll); });
      a.gcd = 2.5; this.emit({ k: 'anim', id: a.id, a: k.anim }); this.emit({ k: 'fx', f: k.fx, s: a.id, t: a.id, r: k.r }); this.later(0.15, hitAll);
      return;
    }
    a.comboI = ((a.comboI ?? -1) + 1) % kit.gcd.length; const k = kit.gcd[a.comboI];
    if (k.cast) return this.npcCast(a, tgt, k.cast, k.name, () => this.npcHit(a, tgt, k));
    a.gcd = 2.5; this.npcHit(a, tgt, k);
    if (role === 'tank' && tgt.casting && tgt.casting.buster && !has(a, 'nebula') && !(a.cd.nebula > 0)) { a.cd.nebula = 60; this.addStatus(a, { id: 'nebula', name: '星云', dur: 10, mit: 0.3 }); this.emit({ k: 'fx', f: 'buff', s: a.id }); }
  }
  npcHit(a, tgt, k) { this.emit({ k: 'anim', id: a.id, a: k.anim || 'release' }); this.emit({ k: 'fx', f: k.fx, s: a.id, t: tgt.id }); this.later(this.fxDelay(k.fx, a, tgt), () => this.damage(a, tgt, k.p, {})); }
  npcCast(a, tgt, cast, name, done) {
    a.gcd = Math.max(2.5, cast); face(a, tgt.x, tgt.z);
    a.casting = { name, t: 0, total: cast, onDone: done }; this.emit({ k: 'cast', id: a.id, n: name, tt: cast, a: 'cast' });
  }
  npcHeal(a, tgt, pot, name) { this.npcCast(a, tgt, 1.5, name, () => { if (tgt.dead) return; this.emit({ k: 'anim', id: a.id, a: 'heal' }); this.emit({ k: 'fx', f: 'heal', s: a.id, t: tgt.id }); this.heal(a, tgt, pot, { show: true }); }); }
  npcAoeHeal(a) { this.npcCast(a, a, 2, '士气高扬之策', () => { this.emit({ k: 'anim', id: a.id, a: 'heal' }); this.emit({ k: 'fx', f: 'medica', s: a.id, t: a.id }); this.party().filter((e) => !e.dead && dist(e, a) < 16).forEach((e) => { this.heal(a, e, 330, { show: true }); this.emit({ k: 'fx', f: 'heal', s: a.id, t: e.id }); }); }); }
  npcRaise(a, t) { this.npcCast(a, t, 6, '复生', () => { if (t.dead) { this.revive(t, 0.3); this.emit({ k: 'fx', f: 'raise', s: a.id, t: t.id }); this.msg(`${a.name}对${t.name}发动了「复生」。`, 'battle'); } }); }
  npcEsuna(a, t) { this.npcCast(a, t, 1, '康复', () => { const d = t.statuses.find((s) => s.cleansable); if (d) { this.removeStatus(t, d.id); this.emit({ k: 'fx', f: 'esuna', s: a.id, t: t.id, n: d.name }); } }); }

  // ---------- 分摊 / 极限技 ----------
  startStack(src, target, delay, potency) {
    this.stack = { target: target.id, t: delay, src: src.id, potency };
    this.emit({ k: 'stack', id: target.id, d: delay });
    this.msg(`${target.name}被标记了「水球」——所有人与其分摊伤害！`);
  }
  updateStack(dt) {
    const s = this.stack, tgt = this.ents.get(s.target); s.t -= dt;
    if (!tgt || tgt.dead) { this.stack = null; return; }
    if (s.t > 0) return;
    this.stack = null;
    const n = this.party().filter((e) => !e.dead && dist(e, tgt) <= 4), src = this.ents.get(s.src);
    this.emit({ k: 'fx', f: 'stackhit', t: tgt.id });
    if (src) n.forEach((e) => this.damage(src, e, s.potency / Math.max(1, n.length), { name: '水球', noCrit: true }));
  }
  useLB(p) {
    if (!this.duty) return this.err(p, '只能在副本中使用');
    if (this.lb < this.lbMax) return this.err(p, '极限槽未满');
    const role = JOBS[p.job].role, kind = role === 'tank' ? 'tank' : role === 'healer' ? 'healer' : role === 'caster' ? 'caster' : role === 'ranged' ? 'ranged' : 'melee';
    const cur = this.ents.get(p.target);
    const tgt = cur && cur.faction === 'enemy' && !cur.dead ? cur : this.enemies().filter((e) => e.inCombat).sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (kind !== 'tank' && kind !== 'healer' && !tgt) return this.err(p, '没有可用的目标');
    this.lb = 0;
    const name = JOBS[p.job].lb.name;
    this.emit({ k: 'lbu', id: p.id, kind, t: tgt ? tgt.id : '', n: name });
    this.later(kind === 'caster' ? 1.4 : 0.35, () => {
      if (kind === 'tank') this.party().forEach((e) => this.addStatus(e, { id: 'shieldwall', name: '盾墙', dur: 12, mit: 0.4 }));
      else if (kind === 'healer') this.party().forEach((e) => { if (!e.dead) this.heal(p, e, 0, { flat: effMax(e) * 0.6, show: true }); });
      else if (kind === 'melee') this.damage(p, tgt, 1800, { name, noCrit: true });
      else if (kind === 'ranged') { const t = { shape: 'line', x: p.x, z: p.z, len: 30, width: 4, dir: p.rot }; this.enemies().filter((e) => inShape(t, e.x, e.z, e.radius)).forEach((e) => this.damage(p, e, 1400, { name, noCrit: true })); }
      else this.enemies().filter((e) => dist(e, tgt) < 8 + e.radius).forEach((e) => this.damage(p, e, 1400, { name, noCrit: true }));
    });
  }

  // ---------- FATE（野外） ----------
  updateFate(dt) {
    const near = this.players().filter((p) => Math.hypot(p.x - FATE_AREA.x, p.z - FATE_AREA.z) < 75);
    if (!this.fate) { this.fateCD -= dt; if (this.fateCD <= 0 && near.some((p) => p.level >= 3)) this.startFate(near); return; }
    const F = this.fate; F.t -= dt;
    for (const p of this.players()) if (Math.hypot(p.x - FATE_AREA.x, p.z - FATE_AREA.z) < FATE_AREA.r + 12) F.cr.add(p.id);
    this.fateUpd -= dt; if (this.fateUpd <= 0) { this.fateUpd = 1; this.emit({ k: 'fate', s: 'upd', t: Math.round(F.t), p: F.p }); }
    if (F.t <= 0) this.endFate(false);
  }
  startFate(near) {
    const L = clamp(Math.max(...near.map((p) => p.level)), 6, 9);
    this.fate = { t: 480, p: 0, kills: 0, boss: null, L, cr: new Set() };
    this.emit({ k: 'fate', s: 'start', t: 480, p: 0 }); this.msg('FATE「沙哈金族的奇袭」开始了！地点：拉诺西亚低地 东部海滩', 'fate');
    this.fateWave(4);
  }
  fateWave(n) {
    for (let i = 0; i < n; i++) { let x, z, k = 0; do { const a = rand(0, PI * 2), r = rand(6, 14); x = FATE_AREA.x + Math.cos(a) * r; z = FATE_AREA.z + Math.sin(a) * r; k++; } while (!fieldOpen(x, z) && k < 20); this.spawnMob('sahagin', this.fate.L, x, z, { wanderR: 4, aggroR: 16, fate: true }); }
  }
  fateKill(e) {
    const F = this.fate; if (e.def.fateBoss) { F.p = 100; this.endFate(true); return; }
    F.kills++; F.p = Math.min(80, F.kills * 10);
    if (F.kills === 4) { this.fateWave(4); this.msg('更多的沙哈金族从海里冒了出来！', 'fate'); }
    if (F.kills >= 8 && !F.boss) { F.boss = this.spawnMob('sahagin_chief', F.L + 2, FATE_AREA.x, FATE_AREA.z, { wanderR: 2, aggroR: 18, fate: true }); this.msg('沙哈金族战士长出现了！', 'fate'); }
    this.emit({ k: 'fate', s: 'upd', t: Math.round(F.t), p: F.p });
  }
  endFate(ok) {
    const F = this.fate; if (!F) return; this.fate = null; this.fateCD = ok ? 150 : 90;
    for (const e of this.ents.values()) if (e.fate && !e.dead) { e.dead = true; e.deadT = 1.5; e.hp = 0; this.emit({ k: 'die', id: e.id, q: 1 }); }
    this.emit({ k: 'fate', s: 'end', ok: ok ? 1 : 0, cr: [...F.cr] });
    this.msg(ok ? 'FATE「沙哈金族的奇袭」完成了！评价：金牌' : 'FATE「沙哈金族的奇袭」失败了……', 'fate');
  }

  // ---------- 副本 ----------
  dutyJoin(p) {
    const D = this.duty;
    if (p.token) D.present.add(p.token);
    if (!D.started) this.startDuty();
    else { const [x, z] = CHECKPOINTS(D.done); p.x = x; p.z = z; this.emit({ k: 'tp', to: p.id, x, z }); }
  }
  startDuty() {
    const D = this.duty; D.started = true; D.startAt = this.time;
    const L = Math.max(1, ...this.roster.map((r) => r.lv || 1), ...this.players().map((p) => p.level));
    this.level = L;
    const pack = (list) => { const ms = list.map(([k, x, z]) => this.spawnMob(k, L, x, z, { wanderR: 1.5, rot: 0, aggroR: 9 })); ms.forEach((m) => (m.pack = ms)); };
    pack([['pirate', 0, -46], ['pirate2', -4, -53], ['pirate', 4, -54]]);
    pack([['pirate2', -3, -130], ['pirate', 3, -131], ['pirate', 0, -137]]);
    const b1 = this.spawnMob('chopper', L + 1, 0, -97, { rot: 0, noWander: true, aggroR: 13, sealId: 'b1', key: 'chopper' });
    const b2 = this.spawnMob('madison', L + 1, 0, -182, { rot: 0, noWander: true, aggroR: 12, sealId: 'b2', key: 'madison' });
    const b3 = this.spawnMob('denn', L + 2, 0, -247, { rot: 0, noWander: true, aggroR: 31, sealId: 'b3', key: 'denn' });
    for (const b of [b1, b2, b3]) { b.aggro = true; b.leash = 999; }
    D.bosses = { chopper: b1, madison: b2, denn: b3 };
    this.fillAllies(this.roster.length ? this.roster : this.players().map((p) => ({ role: p.role })));
    this.emit({ k: 'duty', s: 'start' });
  }
  // 按编成 1 防护 / 1 治疗 / 2 输出，缺少的职能由亲信战友补上
  fillAllies(members) {
    const have = [...this.ents.values()].filter((e) => e.kind === 'ally').map((e) => ({ role: e.role, key: e.allyKey }));
    let slot = have.length + 1;
    for (const k of trustFill(members.map((m) => m.role), have)) this.spawnAlly(k, slot++, this.level || 1, rand(-2, 2), -6 - slot);
  }
  updateDuty(dt) {
    const D = this.duty; if (!D.started) return;
    D.t -= dt;
    // 匹配到但迟迟没有进入的玩家，由亲信战友补位
    if (!D.filled && this.time - D.startAt > 25) { D.filled = true; const present = this.roster.filter((r) => D.present.has(r.token)); if (present.length < this.roster.length) this.fillAllies(present.length ? present : this.players().map((p) => ({ role: p.role }))); }
    const pt = this.party();
    if (!D.wiping && pt.length && pt.every((m) => m.dead)) { D.wipeT += dt; if (D.wipeT > 2.5) this.wipe(); } else D.wipeT = 0;
    if (D.loot) { D.loot.t -= dt; if (D.loot.t <= 0 || this.players().every((p) => D.loot.items.every((it) => it.ch.has(p.id)))) this.resolveLoot(); }
  }
  bossEngage(e) {
    const [, , , nm] = DUNGEON_ARENAS[e.sealId];
    this.msg(`「${nm}」将在5秒后被封锁！`);
    if (e.key === 'madison') this.msg('麦迪逊船长：「哪来的老鼠？敢闯我蛇蝎帮的地盘！」', 'npc');
    if (e.key === 'denn') this.msg('虎鲸牙·丹恩发出了震耳欲聋的咆哮！', 'npc');
    this.emit({ k: 'duty', s: 'engage', seal: e.sealId });
    this.script = bossScript(this, e);
    this.later(5, () => {
      if (!e.inCombat || e.dead) return;
      this.setSeal(e.sealId, true); this.msg(`「${nm}」被封锁了！`);
      const [cx, cz, cr] = DUNGEON_ARENAS[e.sealId];
      for (const m of this.party()) if (Math.hypot(m.x - cx, m.z - cz) > cr - 0.5) { const x = cx + rand(-2, 2), z = cz + cr - 3; if (m.kind === 'player') this.emit({ k: 'tp', to: m.id, x, z }); m.x = x; m.z = z; }
    });
  }
  setSeal(id, on) { for (const b of this.seals[id] || []) b.on = on; this.emit({ k: 'seal', s: id, on: on ? 1 : 0 }); }
  clearBossFight(e, killed) {
    this.setSeal(e.sealId, false); this.script = null; this.stack = null;
    for (const t of this.teles) t.cancel = true;
    for (const x of this.ents.values()) if (x.add && !x.dead) { x.dead = true; x.deadT = 1.5; x.hp = 0; this.emit({ k: 'die', id: x.id, q: 1 }); }
    if (!killed) { e.hp = e.maxHp; e.x = e.spawn.x; e.z = e.spawn.z; e.rot = 0; e.statuses = []; e.addsSpawned = false; e.phase2 = false; }
  }
  dutyKill(e) {
    const D = this.duty; if (!e.boss) return;
    D.done[e.key] = true; this.clearBossFight(e, true);
    this.msg(`「${DUNGEON_ARENAS[e.sealId][3]}」的封锁解除了。`, 'system');
    if (e.key === 'madison') this.msg('麦迪逊船长：「可恶……这群……冒险者……」', 'npc');
    if (e.key === 'denn') this.dutyComplete();
  }
  dutyComplete() {
    const D = this.duty; D.complete = true;
    this.later(1.2, () => { for (const m of this.party()) if (m.dead) this.revive(m, 0.5); });
    D.chest = { x: 0, z: -226, opened: false };
    this.emit({ k: 'duty', s: 'complete' }); this.emit({ k: 'duty', s: 'chest', x: 0, z: -226 });
  }
  openChest(id) {
    const D = this.duty, p = this.ents.get(id);
    if (!D || !D.chest || D.chest.opened || !p || Math.hypot(p.x - D.chest.x, p.z - D.chest.z) > 5) return;
    D.chest.opened = true;
    const jobs = this.players().map((x) => x.job), wjob = pick(jobs.length ? jobs : ['gla']);
    const list = [weaponItem(wjob, 2), ITEMS.body2, ITEMS.ring1];
    D.loot = { t: 30, items: list.map((it, i) => ({ i, id: it.id, name: it.name, ch: new Map() })) };
    this.emit({ k: 'duty', s: 'loot', by: p.id, items: D.loot.items.map((it) => ({ i: it.i, id: it.id, name: it.name })) });
  }
  lootChoice(id, i, c) {
    const L = this.duty && this.duty.loot; if (!L || !this.ents.has(id)) return;
    const it = L.items[i]; if (!it || !['need', 'greed', 'pass'].includes(c)) return;
    it.ch.set(id, c);
  }
  resolveLoot() {
    const L = this.duty.loot; this.duty.loot = null;
    for (const it of L.items) {
      const rolls = [];
      for (const p of this.players()) { const c = it.ch.get(p.id) || 'greed'; rolls.push({ id: p.id, n: p.name, c, v: c === 'pass' ? 0 : Math.floor(rand(1, 100)) }); }
      const best = rolls.filter((r) => r.c !== 'pass').sort((a, b) => (b.c === 'need') - (a.c === 'need') || b.v - a.v)[0];
      this.emit({ k: 'duty', s: 'roll', i: it.i, id: it.id, name: it.name, rolls, win: best ? best.id : '', wn: best ? best.n : '' });
    }
  }
  wipe() {
    const D = this.duty; D.wiping = true; D.wipeT = 0;
    this.msg('队伍全灭了……将在检查点重整旗鼓。', 'system');
    this.later(2.6, () => {
      for (const t of this.teles) t.cancel = true; this.stack = null; this.script = null;
      for (const e of this.enemies()) { if (e.add) { e.dead = true; e.deadT = 2.7; e.hp = 0; this.emit({ k: 'die', id: e.id, q: 1 }); continue; } if (e.inCombat) { this.resetEnemy(e); e.hp = e.maxHp; e.x = e.spawn.x; e.z = e.spawn.z; e.wander = null; } }
      for (const id of ['b1', 'b2', 'b3']) this.setSeal(id, false);
      const [x, z] = CHECKPOINTS(D.done);
      for (const m of this.party()) {
        if (m.dead) this.revive(m, 1);
        m.hp = effMax(m); m.mp = m.maxMp; m.statuses = m.statuses.filter((s) => s.keep); m.casting = null; m.pend = null; m.x = x + rand(-2, 2); m.z = z + rand(-1, 2);
        if (m.kind === 'player') this.emit({ k: 'tp', to: m.id, x: r2(m.x), z: r2(m.z) }); // 玩家位置由客户端上报，需要通知其传送
      }
      this.emit({ k: 'duty', s: 'wipe', cp: [x, z] });
      D.wiping = false;
    });
  }
  checkpointRevive(p) {
    if (!this.duty || !p.dead) return;
    if (this.party().some((m) => !m.dead && m.role === 'healer' && m !== p)) return this.err(p, '请等待治疗职业的复活');
    const [x, z] = CHECKPOINTS(this.duty.done);
    this.revive(p, 0.6); p.x = x; p.z = z; this.emit({ k: 'tp', to: p.id, x, z });
  }
  // ---------- 同步给客户端的快照 ----------
  // 实体：[id, x, z, y, 朝向, HP, 基础最大HP（「战栗」等加成由客户端按状态计算）, 标志(1死亡 2战斗中 4拔刀), 咏唱进度(-1无), 目标, MP, 移动速度]；只发送有变化的实体
  // full=true 时给新加入的玩家一份完整快照，不影响其他人的增量记录
  snapshot(full) {
    const out = [];
    for (const e of this.ents.values()) {
      const pl = e.kind === 'player'; // 玩家的位置由客户端上报并经在线状态广播，这里不重复发送
      const rec = [e.id, pl ? 0 : r2(e.x), pl ? 0 : r2(e.z), pl ? 0 : r2(e.y), pl ? 0 : r2(e.rot), Math.round(e.hp), e.maxHp, (e.dead ? 1 : 0) | (e.inCombat ? 2 : 0) | (e.drawn ? 4 : 0), e.casting ? r2(e.casting.t / e.casting.total) : -1, e.target || '', Math.round(e.mp || 0), pl ? 0 : r2(e.moveSpeed || 0)];
      if (full) { out.push(rec); continue; }
      const sig = rec.join(','); if (e._sig === sig) continue; e._sig = sig; out.push(rec);
    }
    return out;
  }
  // 状态：{实体id: [[sid, 剩余秒数(-1为常驻), 施加者, 层数]]}；只发送有变化的实体
  statusSnap(full) {
    const out = {}; let any = false;
    for (const e of this.ents.values()) {
      const list = e.statuses.map((s) => [s.sid, isFinite(s.t) ? Math.ceil(s.t) : -1, s.src || '', s.stacks || 0]);
      if (full) { if (list.length) { out[e.id] = list; any = true; } continue; }
      const sig = JSON.stringify(list); if (e._st === sig) continue; e._st = sig; out[e.id] = list; any = true;
    }
    return any ? out : null;
  }
  // 新加入的玩家需要的完整世界状态
  initInfo() {
    const D = this.duty, o = { sp: this.spawnList(), ss: this.snapshot(true), st: this.statusSnap(true), lb: Math.round(this.lb) };
    if (this.fate) o.fate = { t: Math.round(this.fate.t), p: this.fate.p };
    if (D) {
      o.di = this.dutyInfo(); o.seals = Object.keys(this.seals).filter((k) => this.seals[k][0].on);
      if (D.chest) o.chest = { x: D.chest.x, z: D.chest.z, op: D.chest.opened ? 1 : 0 };
    }
    return o;
  }
  dutyInfo() { const D = this.duty; return D ? { t: Math.round(D.t), done: D.done, c: D.complete ? 1 : 0 } : null; }
}

// =====================================================================
// Boss 时间轴（与单人版相同的机制）
// =====================================================================
export function bossScript(W, boss) {
  let t = 0;
  const alive = () => W.party().filter((e) => !e.dead);
  const nonTank = () => alive().filter((e) => e.role !== 'tank');
  const tankOf = () => W.topEnmity(boss) || alive()[0];
  const buster = (name, pot) => {
    const tk = tankOf(); if (!tk) return;
    W.msg(`${boss.name}正在准备「${name}」！（死刑预警）`); W.emit({ k: 'fx', f: 'buster', t: tk.id });
    W.startEnemyCast(boss, name, 3.5, [], () => { if (!tk.dead) { W.emit({ k: 'anim', id: boss.id, a: 'buster' }); W.damage(boss, tk, pot, { name, noCrit: true }); W.emit({ k: 'fx', f: 'bigHit', t: tk.id }); } }, { buster: true });
  };
  const raidwide = (name, pot, cast = 3.5, after) => {
    W.msg(`${boss.name}正在准备「${name}」！（全体攻击）`);
    W.startEnemyCast(boss, name, cast, [], () => { W.emit({ k: 'anim', id: boss.id, a: 'roar' }); W.emit({ k: 'fx', f: 'raidwide', s: boss.id }); alive().forEach((e) => W.damage(boss, e, pot, { name, noCrit: true })); if (after) after(); }, { anim: 'roar' });
  };
  const spawnAdds = (n) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, PI * 2), m = W.spawnMob('madison_add', boss.level - 1, boss.spawn.x + Math.cos(a) * 12, boss.spawn.z + 6 + Math.sin(a) * 8, { noWander: true, add: true });
      const tgt = alive().filter((p) => p.role !== 'tank')[0] || alive()[0]; if (tgt) { W.engage(m, tgt); m.enmity.set(tgt.id, 50); }
    }
  };
  const spawnClams = () => {
    for (const sx of [-9, 9]) {
      const m = W.spawnMob('clam', boss.level, sx, -230, { noWander: true, rot: 0, add: true }); const p = alive()[0]; if (p) W.engage(m, p);
      W.later(26, () => {
        if (m.dead || boss.dead) return;
        m.dead = true; m.deadT = 1.5; m.hp = 0; W.emit({ k: 'die', id: m.id, q: 1 });
        const s = boss.statuses.find((x) => x.id === 'empower'), n = (s ? s.stacks : 0) + 1;
        W.addStatus(boss, { id: 'empower', name: '海之力', dur: 60, dmgUp: 0.15 * n, stacks: n });
        W.emit({ k: 'fx', f: 'empower', s: boss.id }); W.msg('巨蚌释放了海之力！虎鲸牙·丹恩变得更加强大了！');
      });
    }
  };
  const knockback = (d) => {
    for (const m of alive()) { const dx = m.x - boss.x, dz = m.z - boss.z, l = Math.hypot(dx, dz) || 1; if (m.kind === 'player') W.emit({ k: 'kb', to: m.id, dx: dx / l, dz: dz / l, d }); else m.kb = { dx: dx / l, dz: dz / l, t: d / 20 }; }
  };
  const S = {
    chopper: [
      [6, () => buster('强力钳击', 480)],
      [13, () => { const tels = alive().map((e) => W.aoe(boss, { shape: 'circle', x: e.x, z: e.z, r: 4 }, 3.5, null, { potency: 380, name: '气泡爆裂' })); for (let i = 0; i < 2; i++) { const a = rand(0, 6.28), r = rand(3, 12); tels.push(W.aoe(boss, { shape: 'circle', x: boss.spawn.x + Math.cos(a) * r, z: boss.spawn.z + Math.sin(a) * r, r: 4 }, 3.5, null, { potency: 380, name: '气泡爆裂' })); } W.startEnemyCast(boss, '气泡爆裂', 3.5, tels, () => W.emit({ k: 'anim', id: boss.id, a: 'slam' })); }],
      [21, () => { const tk = tankOf(); if (tk) face(boss, tk.x, tk.z); const tel = W.aoe(boss, { shape: 'cone', x: boss.x, z: boss.z, r: 13, angle: 120, dir: boss.rot }, 3, null, { potency: 420, name: '横扫' }); W.startEnemyCast(boss, '横扫', 3, [tel], () => W.emit({ k: 'anim', id: boss.id, a: 'sweep' })); }],
      [28, () => raidwide('泡沫喷溅', 150, 3)],
      [34, () => { const tels = nonTank().map((e) => W.aoe(boss, { shape: 'line', x: boss.x, z: boss.z, len: 22, width: 4, dir: Math.atan2(e.x - boss.x, e.z - boss.z) }, 3.5, null, { potency: 360, name: '钳击冲波' })); W.startEnemyCast(boss, '钳击冲波', 3.5, tels, () => W.emit({ k: 'anim', id: boss.id, a: 'attack' })); }],
      [40, () => { t = 0; }],
    ],
    madison: [
      [2, () => { if (!boss.addsSpawned) { boss.addsSpawned = true; spawnAdds(2); W.msg('麦迪逊船长：「小的们！给我上！」', 'npc'); } }],
      [7, () => { const tel = W.aoe(boss, { shape: 'circle', x: boss.x, z: boss.z, r: 8 }, 3.5, null, { potency: 420, name: '旋风斩', follow: boss.id }); W.startEnemyCast(boss, '旋风斩', 3.5, [tel], () => W.emit({ k: 'anim', id: boss.id, a: 'spin' }), { anim: 'spin' }); }],
      [15, () => { const tels = [], base = rand(0, PI); for (let i = 0; i < 3; i++) { const a = base + i * PI / 3, off = (i - 1) * 9; tels.push(W.aoe(boss, { shape: 'line', x: boss.spawn.x + Math.cos(a) * off - Math.sin(a) * 18, z: boss.spawn.z - Math.sin(a) * off - Math.cos(a) * 18, len: 36, width: 5, dir: a }, 4, null, { potency: 400, name: '炮火齐射' })); } W.msg('麦迪逊船长：「开炮！把他们轰成碎片！」', 'npc'); W.startEnemyCast(boss, '炮火齐射', 4, tels, () => W.emit({ k: 'fx', f: 'cannons', s: boss.id }), { anim: 'point' }); }],
      [24, () => buster('致命突刺', 460)],
      [30, () => { if (!boss.phase2 && boss.hp < boss.maxHp * 0.55) { boss.phase2 = true; spawnAdds(2); W.msg('麦迪逊船长：「援军呢？！都给我出来！」', 'npc'); } const tel = W.aoe(boss, { shape: 'donut', x: boss.x, z: boss.z, rin: 5, r: 16 }, 4, null, { potency: 400, name: '回旋弹幕' }); W.startEnemyCast(boss, '回旋弹幕', 4, [tel], () => W.emit({ k: 'anim', id: boss.id, a: 'spin' })); }],
      [37, () => { t = 0; }],
    ],
    denn: [
      [4, () => { const nt = nonTank(), tgt = pick(nt.length ? nt : alive()); if (tgt) { W.startEnemyCast(boss, '水球', 2.5, [], () => W.emit({ k: 'anim', id: boss.id, a: 'attack' })); W.startStack(boss, tgt, 6.5, 1100); } }],
      [13, () => { const tels = alive().map((e) => W.aoe(boss, { shape: 'circle', x: e.x, z: e.z, r: 5 }, 3.5, null, { potency: 380, name: '尾鳍拍击' })); W.startEnemyCast(boss, '尾鳍拍击', 3.5, tels, () => W.emit({ k: 'anim', id: boss.id, a: 'dive' })); }],
      [20, () => { W.msg('虎鲸牙·丹恩召唤了巨蚌！在巨蚌吸收海之力之前将其击破！'); spawnClams(); W.startEnemyCast(boss, '召唤巨蚌', 2, [], () => W.emit({ k: 'anim', id: boss.id, a: 'roar' }), { anim: 'roar' }); }],
      [28, () => raidwide('大海啸', 170, 4, () => knockback(8))],
      [35, () => { const pts = alive(); for (let i = 0; i < Math.min(2, pts.length); i++) { const v = pick(pts); W.addStatus(v, { id: 'poison', name: '水毒', dur: 15, dot: 55, srcId: boss.id, debuff: true, cleansable: true }); } W.msg('虎鲸牙·丹恩喷出了带毒的海水！（可以用「康复」解除）'); W.emit({ k: 'anim', id: boss.id, a: 'roar' }); }],
      [40, () => { const tel = W.aoe(boss, { shape: 'cone', x: boss.x, z: boss.z, r: 22, angle: 90, dir: boss.rot + (Math.random() < 0.5 ? -0.5 : 0.5) }, 3.5, null, { potency: 440, name: '深渊吐息' }); W.startEnemyCast(boss, '深渊吐息', 3.5, [tel], () => W.emit({ k: 'anim', id: boss.id, a: 'attack' })); }],
      [46, () => { t = 0; }],
    ],
  };
  const tl = (S[boss.def.boss] || []).map((x) => ({ at: x[0], fn: x[1], done: false }));
  return {
    update(dt) {
      if (boss.dead || !boss.inCombat) { t = 0; tl.forEach((x) => (x.done = false)); return; }
      if (boss.casting) return;
      t += dt;
      for (const ev of tl) if (!ev.done && t >= ev.at) { ev.done = true; ev.fn(); if (t === 0) { tl.forEach((x) => (x.done = false)); break; } }
    },
  };
}
