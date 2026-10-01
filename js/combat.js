// 战斗系统：实体、技能、公共冷却、连击、咏唱、持续伤害、仇恨、AI、Boss 机制、极限技
import { THREE, G, clamp, rand, pick, angDiff } from './engine.js';
import { VFX } from './vfx.js';
import { Audio } from './audio.js';
import { JOBS } from './data.js';

const PI = Math.PI;
let EID = 0;
export class Entity {
  constructor(o) {
    Object.assign(this, { title: '', level: 1, radius: 0.5, height: 1.8, speed: 6, rot: 0, faction: 'enemy', role: null, weaponDmg: 0, crit: 0.1 }, o);
    this.id = ++EID; this.pos = new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0);
    this.hp = this.maxHp = o.hp || 100; this.mp = this.maxMp = o.mp ?? 10000;
    this.statuses = []; this.cd = {}; this.gcd = 0; this.gcdMax = 2.5; this.casting = null; this.animLock = 0; this.queued = null;
    this.target = null; this.enmity = new Map(); this.combo = null; this.autoT = rand(0.5, 1.5); this.dead = false; this.deadT = 0;
    this.moveSpeed = 0; this.vy = 0; this.air = false; this.inCombat = false; this.abT = {}; this.spawn = this.pos.clone(); this.aiT = 0;
    this.visual = this.model.root;
  }
  forward() { return new THREE.Vector3(Math.sin(this.rot), 0, Math.cos(this.rot)); }
  dist(e) { return Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z); }
  edge(e) { return this.dist(e) - e.radius - this.radius * 0.5; }
  face(p) { this.rot = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  has(id) { return this.statuses.find((s) => s.id === id); }
  hitPos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.55, this.pos.z); }
  get effMaxHp() { const t = this.has('thrill'); return Math.round(this.maxHp * (t ? 1.2 : 1)); }
}

export function inShape(t, x, z, pad = 0) {
  const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
  if (t.shape === 'circle') return d <= t.r + pad;
  if (t.shape === 'donut') return d >= t.rin - pad && d <= t.r + pad;
  if (t.shape === 'cone') { if (d > t.r + pad) return false; if (d < 0.5) return true; return Math.abs(angDiff(t.dir, Math.atan2(dx, dz))) <= (t.angle * PI) / 360 + pad / d; }
  if (t.shape === 'line') { const fx = Math.sin(t.dir), fz = Math.cos(t.dir); const al = dx * fx + dz * fz, ac = Math.abs(dx * fz - dz * fx); return al >= -pad && al <= t.len + pad && ac <= t.width / 2 + pad; }
  return false;
}

const NPC_KIT = {
  tank: { gcd: [{ name: '利刃斩', p: 200, anim: 'slash', fx: 'slash' }, { name: '残暴弹', p: 300, anim: 'slash2', fx: 'slash' }, { name: '迅连斩', p: 380, anim: 'heavy', fx: 'slash' }], aoe: { name: '恶魔切', p: 110, r: 5, anim: 'spin', fx: 'spin' } },
  melee: { gcd: [{ name: '连击', p: 230, anim: 'punch', fx: 'hit' }, { name: '正拳', p: 270, anim: 'punch', fx: 'hit' }, { name: '崩拳', p: 310, anim: 'punch', fx: 'hit' }], aoe: { name: '破坏神冲', p: 110, r: 5, anim: 'spin', fx: 'spin' } },
  caster: { gcd: [{ name: '火炎', p: 240, cast: 2.3, anim: 'release', fx: 'fire' }, { name: '冰结', p: 200, cast: 2.3, anim: 'release', fx: 'ice' }], aoe: { name: '烈炎', p: 120, r: 5, cast: 2.8, anim: 'release', fx: 'fire2' } },
  healer: { dmg: { name: '毁灭', p: 170, cast: 1.5, anim: 'release', fx: 'ruin' } },
};

export const Combat = {
  timers: [], teles: [], lb: 0, lbMax: 1000, tick: 0, on: {}, stack: null, bossScript: null,
  reset() { this.timers = []; this.teles = []; this.stack = null; this.bossScript = null; this.lb = 0; },
  later(t, fn) { this.timers.push({ t, fn }); },
  atk(e) { return e.kind === 'enemy' ? (6 + e.level * 2.6) * (e.mobDmg ?? 1) : 10 + e.level * 2.8 + (e.weaponDmg || 0); },
  enemies() { return G.entities.filter((e) => e.faction === 'enemy' && !e.dead); },
  party() { return G.entities.filter((e) => e.faction === 'party'); },
  addStatus(t, s, src) {
    const ex = t.statuses.find((x) => x.id === s.id);
    const st = { ...s, t: s.dur ?? Infinity, max: s.dur ?? Infinity, src, tickT: 3 };
    if (ex) Object.assign(ex, st); else t.statuses.push(st);
    if (t === G.player && G.ui) G.ui.dirtyStatus = true;
    return st;
  },
  removeStatus(t, id) { const i = t.statuses.findIndex((s) => s.id === id); if (i >= 0) { t.statuses.splice(i, 1); if (t === G.player && G.ui) G.ui.dirtyStatus = true; return true; } return false; },
  fly(e, text, cls) { G.ui && G.ui.flytext(e, text, cls); },
  log(text, cls = 'battle') { G.ui && G.ui.chat(text, cls); },
  engage(enemy, src) {
    if (enemy.dead || enemy.faction !== 'enemy') return;
    if (!enemy.inCombat) {
      enemy.inCombat = true; enemy.abT = {}; (enemy.def.abilities || []).forEach((a, i) => (enemy.abT[i] = rand(a.every[0] * 0.6, a.every[1] * 0.8)));
      if (this.on.engage) this.on.engage(enemy);
    }
    if (src && !enemy.enmity.has(src.id)) enemy.enmity.set(src.id, 1);
  },
  addEnmity(enemy, src, amt) {
    if (enemy.faction !== 'enemy' || src.faction !== 'party') return;
    this.engage(enemy, src);
    let m = 1; if (src.has('iron_will')) m = 10;
    enemy.enmity.set(src.id, (enemy.enmity.get(src.id) || 0) + amt * m);
  },
  topEnmity(enemy) {
    let best = null, bv = -1;
    for (const [id, v] of enemy.enmity) { const e = G.entities.find((x) => x.id === id); if (!e || e.dead) { enemy.enmity.delete(id); continue; } if (v > bv) { bv = v; best = e; } }
    return best;
  },
  damage(src, tgt, potency, o = {}) {
    if (tgt.dead || !tgt.hp) return 0;
    if (tgt.def && tgt.def.passiveAdd && src.faction === 'enemy') return 0;
    let mul = 1; for (const s of src.statuses) if (s.dmgUp) mul += s.dmgUp * (s.stacks || 1);
    let crit = Math.random() < (src.crit || 0.1) + (o.critBonus || 0), dh = Math.random() < 0.15;
    const cn = src.statuses.find((s) => s.critNext > 0);
    if (cn && o.ws) { crit = true; cn.critNext--; if (cn.critNext <= 0) this.removeStatus(src, cn.id); }
    if (o.noCrit) { crit = false; dh = false; }
    let dmg = (potency / 100) * this.atk(src) * rand(0.95, 1.05) * mul * (crit ? 1.5 : 1) * (dh ? 1.25 : 1);
    let mit = 1; for (const s of tgt.statuses) if (s.mit) mit *= 1 - s.mit;
    if (tgt.role === 'tank') mit *= 0.8;
    if (o.flat) dmg = o.flat; else dmg *= mit;
    dmg = Math.max(1, Math.round(dmg));
    tgt.hp = Math.max(0, tgt.hp - dmg);
    if (tgt.faction === 'enemy') { this.addEnmity(tgt, src, dmg * (o.enmity || 1)); if (src.faction === 'party' && this.inParty()) this.lb = Math.min(this.lbMax, this.lb + dmg * 0.02); }
    if (tgt.faction === 'party' && src.faction === 'enemy') { tgt.lastHitT = G.time; if (this.inParty()) this.lb = Math.min(this.lbMax, this.lb + 1.5); }
    if (tgt.model && !tgt.casting && Math.random() < 0.35 && tgt.model.play && tgt.kind !== 'enemy') tgt.model.play('hit', 0.35);
    const tag = crit && dh ? '暴击直击! ' : crit ? '暴击! ' : dh ? '直击! ' : '';
    const cls = tgt === G.player ? 'dmg-in' : src === G.player ? (crit ? 'dmg-crit' : 'dmg-out') : tgt.faction === 'party' ? 'dmg-party' : src.faction === 'party' ? 'dmg-ally' : 'dmg-out';
    if (src === G.player || tgt === G.player || src.faction === 'party' && tgt.faction === 'enemy' && Math.random() < 0.6 || tgt.faction === 'party') this.fly(tgt, (o.name && src === G.player ? '' : '') + tag + dmg, cls + (o.dot ? ' dot' : ''));
    if (src === G.player && o.name) this.log(`你发动了「${o.name}」，${tgt.name}受到了${dmg}点伤害。`, 'battle');
    else if (tgt === G.player && o.name) this.log(`${src.name}发动了「${o.name}」，你受到了${dmg}点伤害。`, 'battle-in');
    if (crit && src === G.player) Audio.sfxPlay('crit', 0.6);
    if (tgt.hp <= 0) this.kill(tgt, src);
    return dmg;
  },
  heal(src, tgt, potency, o = {}) {
    if (tgt.dead) return 0;
    const crit = Math.random() < 0.1;
    let h = o.flat || (potency / 100) * (10 + src.level * 2.8 + (src.weaponDmg || 0)) * rand(0.95, 1.05) * (crit ? 1.5 : 1);
    h = Math.round(h); const before = tgt.hp; tgt.hp = Math.min(tgt.effMaxHp, tgt.hp + h);
    const real = tgt.hp - before;
    if (src.faction === 'party') for (const e of this.enemies()) if (e.inCombat) this.addEnmity(e, src, real * 0.4);
    if (src === G.player || tgt === G.player || o.show) this.fly(tgt, (crit ? '暴击! ' : '') + h, 'heal');
    return real;
  },
  kill(e, src) {
    if (e.dead) return;
    e.dead = true; e.hp = 0; e.deadT = 0; e.casting && this.interrupt(e, true); e.statuses = e.statuses.filter((s) => s.keep);
    e.model.setDead(true); e.target = null;
    if (e.faction === 'enemy') {
      for (const s of this.teles) if (s.src === e && !s.keep) s.cancel = true;
      this.log(`${e.name}被打倒了。`, 'battle');
      if (this.on.kill) this.on.kill(e, src);
    } else {
      this.log(`${e === G.player ? '你' : e.name}陷入了无法战斗状态。`, 'battle-in');
      for (const en of this.enemies()) en.enmity.delete(e.id);
      if (e === G.player) { Audio.sfxPlay('death'); if (this.on.playerDeath) this.on.playerDeath(); }
    }
  },
  revive(e, pct = 0.25) {
    e.dead = false; e.hp = Math.round(e.effMaxHp * pct); e.mp = Math.max(e.mp, e.maxMp * 0.3); e.model.setDead(false); e.model.setOpacity && e.model.setOpacity(1);
    this.addStatus(e, { id: 'weak', name: '衰弱', dur: 20, debuff: true, dmgUp: -0.2, icon: ['skull', '#8a8a8a', '#2a2a2a'] });
    VFX.pillar(e.pos, '#fff0b0', 6, 1.2); this.fly(e, '复活', 'heal');
  },
  inParty() { return !!(G.zone && G.zone.dungeon); },
  // ---------- 技能执行 ----------
  canUse(src, sk) {
    if (src.dead) return '无法战斗';
    if (src.has('stun')) return '眩晕中';
    if (sk.lv > src.level) return '等级不足';
    if (sk.requires && !src.has(sk.requires)) return '发动条件未满足';
    if (sk.gcd && src.gcd > 0) return 'gcd';
    if (!sk.gcd && src.cd[sk.id] > 0) return '尚未准备好';
    if (this.mpCost(src, sk) > src.mp) return '魔力不足';
    return null;
  },
  mpCost(src, sk) {
    if (!sk.mp) return 0; if (sk.freeWith && src.has(sk.freeWith)) return 0;
    if (sk.element === 'ice' && src.has('umbral_ice')) return 0;
    if (sk.element === 'fire' && src.has('astral_fire')) return sk.mp * 2;
    return sk.mp;
  },
  castTime(src, sk) {
    if (!sk.cast) return 0; if (src.has('swiftcast') && sk.kind === 'spell') return 0; if (sk.instantWith && src.has(sk.instantWith)) return 0;
    return sk.cast;
  },
  resolveTarget(src, sk, silent) {
    const t = src.target;
    if (sk.target === 'enemy') {
      if (t && t.faction === 'enemy' && !t.dead) return t;
      const near = this.enemies().filter((e) => src.dist(e) < 25 && (e.inCombat || src === G.player)).sort((a, b) => src.dist(a) - src.dist(b))[0];
      if (near) { if (src === G.player && this.on.setTarget) this.on.setTarget(near); return near; }
      return null;
    }
    if (sk.target === 'ally') return t && t.faction === 'party' && !t.dead ? t : src;
    if (sk.target === 'dead') return t && t.faction === 'party' && t.dead ? t : null;
    return src;
  },
  use(src, sk) {
    const err = this.canUse(src, sk);
    if (err === 'gcd' || (err === null && src.animLock > 0)) {
      if ((sk.gcd && src.gcd <= 0.6) || (!sk.gcd && src.animLock > 0)) { src.queued = sk; return true; }
      return false;
    }
    if (err) { if (src === G.player) G.ui.error(err); return false; }
    if (src.casting) { if (src === G.player) G.ui.error('正在咏唱'); return false; }
    const tgt = this.resolveTarget(src, sk);
    if (!tgt && sk.target !== 'none') { if (src === G.player) G.ui.error(sk.target === 'dead' ? '请选中无法战斗的队员' : '没有可用的目标'); return false; }
    if (tgt && tgt !== src && (sk.target === 'enemy' || sk.target === 'ally' || sk.target === 'dead')) {
      if (src.edge(tgt) > (sk.range || 3)) { if (src === G.player) G.ui.error('目标不在射程内'); return false; }
      src.face(tgt.pos);
    }
    if (src === G.player && sk.target === 'enemy') { src.target = tgt; if (this.on.setTarget) this.on.setTarget(tgt); }
    const ct = this.castTime(src, sk);
    if (sk.gcd) src.gcd = src.gcdMax = Math.max(2.5, ct);
    if (!sk.gcd && sk.recast) src.cd[sk.id] = sk.recast;
    src.model.setDrawn && src.model.setDrawn(true); src.drawnT = 12;
    if (ct > 0) {
      const col = { fire: '#ff8a3a', ice: '#7ad8ff' }[sk.element] || (sk.heal || sk.raise || sk.esuna ? '#8affb0' : '#c89aff');
      src.casting = { sk, t: 0, total: ct, tgt, circle: VFX.castCircle(src, col), name: sk.name };
      src.model.setLoop('cast'); Audio.sfxPlay('cast', 0.4);
      return true;
    }
    src.animLock = 0.6;
    this.consumeOnCast(src, sk);
    this.execute(src, sk, tgt);
    return true;
  },
  consumeOnCast(src, sk) {
    const mp = this.mpCost(src, sk); src.mp -= mp;
    if (sk.kind === 'spell' && src.has('swiftcast') && sk.cast) this.removeStatus(src, 'swiftcast');
    if (sk.freeWith && src.has(sk.freeWith)) this.removeStatus(src, sk.freeWith);
    else if (sk.instantWith && src.has(sk.instantWith)) this.removeStatus(src, sk.instantWith);
    if (sk.requires) this.removeStatus(src, sk.requires);
  },
  interrupt(e, silent) {
    if (!e.casting) return; e.casting.circle && e.casting.circle.remove(); e.model.setLoop(null);
    if (e.casting.tele) e.casting.tele.forEach((t) => (t.cancel = true));
    if (e.faction === 'party' && e.casting.sk && e.casting.sk.gcd) e.gcd = 0;
    e.casting = null; if (!silent && e === G.player) G.ui.error('咏唱中断');
  },
  execute(src, sk, tgt) {
    const P = src === G.player;
    if (sk.anim) src.model.play(sk.anim, sk.anim === 'shoot' ? 0.7 : sk.anim === 'heavy' ? 0.75 : sk.anim === 'spin' ? 0.6 : 0.55);
    // 连击
    let pot = sk.potency || 0, comboHit = false;
    if (sk.combo && src.combo && src.combo.id === sk.combo.from && src.combo.t > 0) { pot = sk.combo.potency; comboHit = true; }
    if (sk.gcd && sk.kind === 'ws') src.combo = !sk.combo || comboHit ? { id: sk.id, t: 15 } : null;
    if (comboHit) { if (sk.combo.mp) src.mp = Math.min(src.maxMp, src.mp + sk.combo.mp); if (sk.combo.heal) this.heal(src, src, sk.combo.heal); if (sk.combo.buff) this.addStatus(src, sk.combo.buff, src); }
    // 元素（星极火 / 灵极冰）
    if (sk.element === 'fire') { if (src.has('umbral_ice')) { this.removeStatus(src, 'umbral_ice'); pot *= 0.9; } else if (src.has('astral_fire')) pot *= 1.4; this.addStatus(src, { id: 'astral_fire', name: '星极火', dur: 15, icon: ['fire', '#ff6a2a', '#5a0a0a'] }); }
    if (sk.element === 'ice') { if (src.has('astral_fire')) { this.removeStatus(src, 'astral_fire'); pot *= 0.9; } this.addStatus(src, { id: 'umbral_ice', name: '灵极冰', dur: 15, mpTick: 1600, icon: ['ice', '#6ac8ff', '#0a2a5a'] }); }
    if (sk.transpose) { if (src.has('astral_fire')) { this.removeStatus(src, 'astral_fire'); this.addStatus(src, { id: 'umbral_ice', name: '灵极冰', dur: 15, mpTick: 1600, icon: ['ice', '#6ac8ff', '#0a2a5a'] }); } else if (src.has('umbral_ice')) { this.removeStatus(src, 'umbral_ice'); this.addStatus(src, { id: 'astral_fire', name: '星极火', dur: 15, icon: ['fire', '#ff6a2a', '#5a0a0a'] }); } VFX.flash(src.hitPos(), '#c080ff', 2, 0.3); }
    if (sk.buff) { this.addStatus(src, sk.buff, src); VFX.ring(src.pos, '#ffe0a0', 2, 0.5); Audio.sfxPlay('buff', 0.6); if (P) this.log(`你发动了「${sk.name}」。`); }
    if (sk.toggle) { if (src.has(sk.toggle)) this.removeStatus(src, sk.toggle); else this.addStatus(src, { id: sk.toggle, name: sk.name, icon: sk.icon, enmityMul: 10, keep: true }); VFX.flash(src.hitPos(), '#8ab0ff', 2, 0.3); Audio.sfxPlay('buff', 0.5); }
    if (sk.healSelf) { const t = this.heal(src, src, 0, { flat: src.effMaxHp * sk.healSelf }); void t; }
    if (sk.healPot) { this.heal(src, src, sk.healPot); VFX.heal(src); Audio.sfxPlay('heal', 0.5); }
    if (sk.provoke && tgt) { let mx = 0; for (const v of tgt.enmity.values()) mx = Math.max(mx, v); tgt.enmity.set(src.id, mx + 500); this.engage(tgt, src); VFX.flash(tgt.hitPos(), '#ffb040', 2, 0.4); this.fly(tgt, '挑衅', 'status'); }
    const ws = sk.kind === 'ws';
    const hitOne = (t) => {
      if (!t || t.dead) return;
      if (pot) this.damage(src, t, pot, { name: sk.name, ws, enmity: sk.enmityMul });
      if (sk.dot) this.addStatus(t, { ...sk.dot, debuff: true, dot: sk.dot.potency, srcId: src.id, id: sk.dot.id + src.id, baseId: sk.dot.id }, src);
      if (sk.stun && !t.boss) { this.addStatus(t, { id: 'stun', name: '眩晕', dur: sk.stun, debuff: true, icon: ['star', '#f0e060', '#4a3a0a'] }); this.interrupt(t, true); this.fly(t, '眩晕', 'status'); }
    };
    // 范围 or 单体
    if (sk.aoe) {
      const a = sk.aoe; const c = a.at === 'target' && tgt ? tgt.pos : src.pos;
      const shape = { shape: a.shape, x: c.x, z: c.z, r: a.r, angle: a.angle, dir: src.rot, len: a.len, width: a.width };
      const pool = a.ally ? this.party().filter((e) => !e.dead) : this.enemies();
      const hits = pool.filter((e) => inShape(shape, e.pos.x, e.pos.z, e.radius * 0.7));
      this.fx(sk.vfx, src, tgt || src, () => { if (sk.heal) hits.forEach((h) => { this.heal(src, h, sk.heal, { show: true }); VFX.heal(h); }); else hits.forEach(hitOne); }, sk);
      if (P && !hits.length && !a.ally) this.log(`你发动了「${sk.name}」。`);
    } else if (sk.heal) {
      this.fx(sk.vfx, src, tgt, () => { this.heal(src, tgt, sk.heal); if (P) this.log(`你对${tgt === src ? '自己' : tgt.name}发动了「${sk.name}」。`, 'battle'); }, sk);
    } else if (sk.esuna) {
      const d = tgt.statuses.find((s) => s.cleansable); if (d) { this.removeStatus(tgt, d.id); this.fly(tgt, '解除 ' + d.name, 'heal'); } VFX.pillar(tgt.pos, '#a0e8ff', 4, 0.8, 0.8); Audio.sfxPlay('heal', 0.5);
    } else if (sk.raise) {
      if (tgt.dead) this.revive(tgt, 0.3); Audio.sfxPlay('heal');
    } else if (sk.target === 'enemy' && tgt) {
      this.fx(sk.vfx, src, tgt, () => hitOne(tgt), sk);
    }
    if (sk.proc && Math.random() < sk.proc.chance) { this.addStatus(src, sk.proc, src); if (P) this.fly(src, sk.proc.name, 'status'); }
  },
  fx(kind, src, tgt, hit, sk = {}) {
    const tp = () => tgt.hitPos(); const from = src.hitPos();
    const snd = (n, v = 0.7) => Audio.sfxPlay(n, v);
    switch (kind) {
      case 'slash': VFX.slash(src, '#d8ecff', Math.random() < 0.5 ? 1 : -1); snd('slash'); this.later(0.12, () => { if (tgt !== src) { VFX.hit(tp()); snd('hit', 0.6); } hit(); }); break;
      case 'thrust': VFX.thrust(src); snd('slash'); this.later(0.15, () => { VFX.hit(tp(), '#cfe0ff'); hit(); }); break;
      case 'spin': VFX.spin(src, '#d8ecff', sk.aoe ? sk.aoe.r : 5); snd('slash'); this.later(0.15, hit); break;
      case 'cone': VFX.cone(src, sk.id === 'quick_nock' ? '#e0f080' : '#ffd080', sk.aoe.r, sk.aoe.angle); snd(sk.anim === 'shoot' ? 'bow' : 'slash'); this.later(0.15, hit); break;
      case 'line': VFX.line(src, '#c8a0ff', sk.aoe.len, sk.aoe.width); snd('slash'); this.later(0.15, hit); break;
      case 'arrow': case 'arrow2': case 'arrowpoison': case 'arrowwind': {
        const col = { arrow: '#ffe8a0', arrow2: '#ffd040', arrowpoison: '#c070ff', arrowwind: '#60e0c0' }[kind]; snd('bow');
        VFX.projectile(from, tgt, { kind: 'arrow', speed: 48, color: col, size: 0.5, onHit: () => { VFX.hit(tp(), col); hit(); } }); break;
      }
      case 'shieldlob': case 'axe': case 'spearthrow': VFX.projectile(from, tgt, { kind: kind === 'shieldlob' ? 'shield' : kind === 'axe' ? 'axe' : 'spear', speed: 30, trail: false, onHit: () => { VFX.hit(tp()); snd('hit'); hit(); } }); break;
      case 'fire': this.later(0.25, () => { VFX.fire(tp()); snd('fire'); hit(); }); break;
      case 'fire2': this.later(0.25, () => { VFX.fire(tp(), 1.6); VFX.ring(tgt.pos, '#ff7a2a', 5, 0.5); snd('fire'); hit(); }); break;
      case 'fire3': this.later(0.25, () => { VFX.fire(tp(), 2); VFX.pillar(tgt.pos, '#ff6a1a', 6, 0.6, 1.4); snd('fire'); hit(); }); break;
      case 'ice': this.later(0.25, () => { VFX.ice(tp()); snd('ice'); hit(); }); break;
      case 'bolt': VFX.bolt(tp()); snd('thunder'); this.later(0.1, hit); break;
      case 'stone': VFX.stone(tp()); this.later(0.35, () => { snd('stone'); hit(); }); break;
      case 'wind': VFX.wind(tp()); snd('wind'); this.later(0.1, hit); break;
      case 'ruin': VFX.projectile(from, tgt, { color: '#c080ff', speed: 20, size: 0.8, onHit: () => { VFX.hit(tp(), '#c080ff'); hit(); } }); break;
      case 'heal': case 'heal2': VFX.heal(tgt, kind === 'heal2' ? '#7ae8ff' : '#7dffa8'); snd('heal', 0.6); hit(); break;
      case 'medica': VFX.ring(src.pos, '#7dffa8', 15, 0.8); snd('heal', 0.7); hit(); break;
      case 'hit': this.later(0.15, () => { VFX.hit(tp()); snd('hit', 0.5); hit(); }); break;
      default: if (tgt !== src) VFX.hit(tp()); hit();
    }
  },
  // ---------- 敌方 AOE ----------
  aoe(src, t, cast, onHit, o = {}) {
    const tel = { ...t, src, end: G.time + cast, dur: cast, onHit, potency: o.potency, name: o.name, keep: o.keep };
    tel.vis = VFX.telegraph({ ...t, dur: cast });
    this.teles.push(tel);
    return tel;
  },
  resolveTele(tel) {
    const victims = this.party().filter((e) => !e.dead && inShape(tel, e.pos.x, e.pos.z, e.radius * 0.4));
    VFX.disc(new THREE.Vector3(tel.x, 0, tel.z), '#ffb070', tel.shape === 'circle' ? tel.r : 3, 0.4);
    if (tel.shape === 'circle') VFX.ring(new THREE.Vector3(tel.x, 0, tel.z), '#ffd0a0', tel.r, 0.4);
    if (tel.shape === 'line' || tel.shape === 'cone') { const fx = { shape: tel.shape, pos: new THREE.Vector3(tel.x, 0, tel.z), rot: tel.dir }; if (tel.shape === 'line') VFX.line(fx, '#ffb070', tel.len, tel.width); else VFX.cone(fx, '#ffb070', tel.r, tel.angle); }
    Audio.sfxPlay('aoe', 0.5);
    if (tel.onHit) tel.onHit(victims); else victims.forEach((v) => this.damage(tel.src, v, tel.potency || 300, { name: tel.name, noCrit: true }));
  },
  startEnemyCast(e, name, cast, teles, onDone, o = {}) {
    e.casting = { name, t: 0, total: cast, sk: null, tele: teles || [], onDone, enemy: true, buster: o.buster };
    e.model.play(o.anim || 'cast', cast); e.model.setLoop && e.model.setLoop(o.loop === false ? null : 'cast');
  },
  // ---------- 主循环 ----------
  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const t = this.teles[i];
      if (t.follow) { t.x = t.follow.pos.x; t.z = t.follow.pos.z; }
      if (t.cancel) { t.vis.kill = true; this.teles.splice(i, 1); continue; }
      if (G.time >= t.end) { this.teles.splice(i, 1); this.resolveTele(t); }
    }
    this.tick += dt; const serverTick = this.tick >= 3; if (serverTick) this.tick -= 3;
    for (const e of G.entities) {
      if (e.kind === 'npc' || e.kind === 'remote') continue;
      e.gcd = Math.max(0, e.gcd - dt); e.animLock = Math.max(0, e.animLock - dt);
      for (const k in e.cd) if (e.cd[k] > 0) e.cd[k] -= dt;
      if (e.combo) { e.combo.t -= dt; if (e.combo.t <= 0) e.combo = null; }
      for (let i = e.statuses.length - 1; i >= 0; i--) {
        const s = e.statuses[i]; s.t -= dt;
        if (!e.dead && (s.dot || s.hot)) { s.tickT -= dt; if (s.tickT <= 0) { s.tickT += 3; const src = G.entities.find((x) => x.id === s.srcId) || s.src || e; if (s.dot) this.damage(src && !src.dead ? src : e, e, s.dot, { dot: true, noCrit: !src || src.faction === 'enemy' }); if (s.hot) this.heal(src, e, s.hot); } }
        if (s.t <= 0) { e.statuses.splice(i, 1); if (e === G.player && G.ui) G.ui.dirtyStatus = true; }
      }
      if (e.dead) continue;
      if (serverTick && e.faction === 'party') {
        let mpT = this.anyCombat() ? 200 : 700; for (const s of e.statuses) if (s.mpTick) mpT += s.mpTick; if (e.has('astral_fire')) mpT = 0;
        e.mp = Math.min(e.maxMp, e.mp + mpT);
        if (!this.anyCombat() && !e.dead) e.hp = Math.min(e.effMaxHp, e.hp + Math.round(e.effMaxHp * 0.1));
      }
      if (e.hp > e.effMaxHp) e.hp = e.effMaxHp;
      // 咏唱
      if (e.casting) {
        const c = e.casting; c.t += dt;
        if (c.t >= c.total) {
          e.casting = null; c.circle && c.circle.remove(); e.model.setLoop && e.model.setLoop(null);
          if (c.enemy) { if (c.onDone) c.onDone(); }
          else if (c.sk) {
            const sk = c.sk, tgt = c.tgt;
            const bad = (sk.target === 'enemy' && (!tgt || tgt.dead)) || (sk.target === 'ally' && tgt.dead) || (sk.target === 'dead' && !tgt.dead);
            if (bad) { if (e === G.player) G.ui.error('目标无效'); }
            else if (this.mpCost(e, sk) > e.mp) { if (e === G.player) G.ui.error('魔力不足'); }
            else { this.consumeOnCast(e, sk); if (tgt && tgt !== e) e.face(tgt.pos); this.execute(e, sk, tgt); }
          } else if (c.npc) c.npc();
          e.animLock = 0.3;
        }
      }
      // 预输入队列
      if (e.queued && !e.casting && e.animLock <= 0) { const q = e.queued; if (!q.gcd || e.gcd <= 0) { e.queued = null; this.use(e, q); } }
      // 自动攻击
      if (e.faction === 'party' && e.drawnT > 0 && !e.casting && !e.mounted) {
        e.autoT -= dt;
        const t = e.target; const job = e.job ? JOBS[e.job] : null;
        const rng = job && job.autoRange ? job.autoRange : 3.2;
        if (t && t.faction === 'enemy' && !t.dead && e.edge(t) <= rng && (!job || !job.caster) && e.autoT <= 0) {
          e.autoT = job ? job.auto : 2.8;
          if (job && job.autoRange) VFX.projectile(e.hitPos(), t, { kind: 'arrow', speed: 45, size: 0.4, onHit: () => this.damage(e, t, 70, {}) });
          else { this.damage(e, t, 85, {}); VFX.hit(t.hitPos(), '#ffffff'); }
        }
      }
    }
    if (G.player) G.player.drawnT = Math.max(0, (G.player.drawnT || 0) - (this.anyCombat() ? 0 : dt));
    if (this.inParty() && this.anyCombat()) this.lb = Math.min(this.lbMax, this.lb + dt * 6);
    if (this.stack) this.updateStack(dt);
    if (this.bossScript) this.bossScript.update(dt);
  },
  anyCombat() { for (const e of G.entities) if (e.faction === 'enemy' && e.inCombat && !e.dead) return true; return false; },
  // ---------- 移动工具 ----------
  moveToward(e, tx, tz, speed, dt, stopDist = 0.3) {
    const dx = tx - e.pos.x, dz = tz - e.pos.z, d = Math.hypot(dx, dz);
    if (d <= stopDist) { e.moveSpeed = 0; return true; }
    const step = Math.min(d - stopDist * 0.5, speed * dt), nx = e.pos.x + (dx / d) * step, nz = e.pos.z + (dz / d) * step;
    const Z = G.zone, r = e.radius * 0.6;
    const ok = (x, z) => Z.canWalk(x, z, Math.min(r, 0.5)) || Z.canWalk(e.pos.x, e.pos.z, Math.min(r, 0.5)) === false;
    if (ok(nx, nz)) { e.pos.x = nx; e.pos.z = nz; } else if (ok(nx, e.pos.z)) e.pos.x = nx; else if (ok(e.pos.x, nz)) e.pos.z = nz;
    const h = Z.heightAt(e.pos.x, e.pos.z); if (h !== null) e.pos.y = h;
    const want = Math.atan2(dx, dz); e.rot += angDiff(e.rot, want) * Math.min(1, dt * 10);
    e.moveSpeed = speed; return false;
  },
  dangerAt(x, z, pad = 0.6, minLeft = 0.25) { for (const t of this.teles) if (t.end - G.time > minLeft && !t.harmless && inShape(t, x, z, pad)) return true; return false; },
  safeSpot(e) {
    let best = null, bd = 1e9;
    for (const r of [3, 5, 7, 10, 14]) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2, x = e.pos.x + Math.cos(a) * r, z = e.pos.z + Math.sin(a) * r;
      if (!G.zone.canWalk(x, z, 0.4) || this.dangerAt(x, z, 1.0, -1)) continue;
      const d = r + (this.stack && this.stack.target !== e ? Math.hypot(x - this.stack.target.pos.x, z - this.stack.target.pos.z) * 0.3 : 0);
      if (d < bd) { bd = d; best = [x, z]; }
      if (best && r >= 5) break;
    }
    return best;
  },
  // ---------- 队友 AI ----------
  allyAI(a, dt) {
    if (a.dead) { a.moveSpeed = 0; return; }
    const P = G.player, en = this.enemies().filter((e) => e.inCombat);
    a.aiT -= dt;
    // 躲避 AOE
    if (a.dodge) { if (this.moveToward(a, a.dodge[0], a.dodge[1], 6.5, dt, 0.4) || G.time > a.dodgeUntil) a.dodge = null; else return; }
    if (a.reactT === undefined) a.reactT = 0;
    if (this.dangerAt(a.pos.x, a.pos.z)) { a.reactT += dt; if (a.reactT > (a.role === 'tank' ? 0.35 : 0.5)) { if (a.casting) this.interrupt(a, true); const s = this.safeSpot(a); if (s) { a.dodge = s; a.dodgeUntil = G.time + 2.5; } a.reactT = 0; } }
    else a.reactT = 0;
    if (a.casting) { a.moveSpeed = 0; return; }
    // 分摊
    if (this.stack && this.stack.target !== a) { const t = this.stack.target; if (a.dist(t) > 1.8) { this.moveToward(a, t.pos.x, t.pos.z, 6.5, dt, 1.2); return; } a.moveSpeed = 0; return; }
    if (!en.length) {
      a.drawnT = Math.max(0, (a.drawnT || 0) - dt); if (a.drawnT <= 0) a.model.setDrawn && a.model.setDrawn(false);
      const idx = a.slot || 1, back = P.forward().multiplyScalar(-2.4), side = new THREE.Vector3(Math.cos(P.rot), 0, -Math.sin(P.rot)).multiplyScalar((idx - 2) * 1.8);
      const tx = P.pos.x + back.x + side.x, tz = P.pos.z + back.z + side.z;
      const d = Math.hypot(tx - a.pos.x, tz - a.pos.z);
      if (d > 25) { a.pos.set(tx, P.pos.y, tz); }
      if (d > 1.2) this.moveToward(a, tx, tz, d > 6 ? (P.mounted ? 11 : 7.5) : 4, dt, 0.6); else { a.moveSpeed = 0; a.rot += angDiff(a.rot, P.rot) * dt * 3; }
      // 脱战时治疗
      if (a.role === 'healer' && a.gcd <= 0) { const low = this.party().filter((e) => !e.dead && e.hp < e.effMaxHp * 0.6)[0]; if (low) this.npcHeal(a, low, 450, '医术'); }
      if (a.role === 'healer' && a.gcd <= 0) { const dead = this.party().find((e) => e.dead); if (dead) this.npcRaise(a, dead); }
      return;
    }
    a.model.setDrawn && a.model.setDrawn(true); a.drawnT = 8;
    const role = a.role;
    // 目标选择
    const tank = this.party().find((e) => e.role === 'tank' && !e.dead);
    let tgt = null;
    if (role === 'tank') {
      const loose = en.filter((e) => !e.def.passiveAdd && this.topEnmity(e) !== a && !e.boss).sort((x, y) => a.dist(x) - a.dist(y))[0];
      tgt = loose || (a.target && !a.target.dead && a.target.inCombat ? a.target : en.filter((e) => !e.def.passiveAdd).sort((x, y) => (y.boss ? 1 : 0) - (x.boss ? 1 : 0) || a.dist(x) - a.dist(y))[0]);
      if (!a.has('iron_will')) this.addStatus(a, { id: 'iron_will', name: '王室亲卫', enmityMul: 10, keep: true, icon: ['shield', '#5a7ab0', '#1a2440'] });
    } else {
      const adds = en.filter((e) => e.def.passiveAdd);
      tgt = (role !== 'healer' && adds.length ? adds.sort((x, y) => a.dist(x) - a.dist(y))[0] : null) || (tank && tank.target && !tank.target.dead ? tank.target : null) || (P.target && P.target.faction === 'enemy' && !P.target.dead ? P.target : null) || en.sort((x, y) => a.dist(x) - a.dist(y))[0];
    }
    if (!tgt) return;
    a.target = tgt;
    // 治疗者优先
    if (role === 'healer') {
      const pt = this.party();
      const dead = pt.find((e) => e.dead);
      const low = pt.filter((e) => !e.dead).sort((x, y) => x.hp / x.effMaxHp - y.hp / y.effMaxHp);
      const nLow = low.filter((e) => e.hp / e.effMaxHp < 0.7).length;
      const poisoned = pt.find((e) => !e.dead && e.statuses.some((s) => s.cleansable));
      if (a.gcd <= 0) {
        if (nLow >= 3) return this.npcAoeHeal(a);
        if (low[0] && low[0].hp / low[0].effMaxHp < 0.72) return this.npcHeal(a, low[0], low[0].hp / low[0].effMaxHp < 0.4 ? 700 : 480, low[0].hp / low[0].effMaxHp < 0.4 ? '鼓舞激励之策' : '医术');
        if (dead && !this.dangerAt(a.pos.x, a.pos.z, 1, -1)) return this.npcRaise(a, dead);
        if (poisoned) return this.npcEsuna(a, poisoned);
      }
      const want = 11; const d = a.edge(tgt);
      if (d > 20 || d < 6) { const dir = new THREE.Vector3(a.pos.x - tgt.pos.x, 0, a.pos.z - tgt.pos.z).normalize(); this.moveToward(a, tgt.pos.x + dir.x * (want + tgt.radius), tgt.pos.z + dir.z * (want + tgt.radius), 6, dt, 1); return; }
      a.moveSpeed = 0; a.face(tgt.pos);
      if (a.gcd <= 0 && a.aiT <= 0) { const k = NPC_KIT.healer.dmg; this.npcCast(a, tgt, k.cast, k.name, () => this.npcHit(a, tgt, k)); }
      return;
    }
    // 站位
    let want, ang = null;
    if (role === 'tank') want = 1.2;
    else if (role === 'melee') { want = 1.2; ang = tgt.rot + PI; }
    else { want = 13; }
    const d = a.edge(tgt);
    if (role === 'caster' || role === 'ranged') {
      if (d > 22 || d < 5) { const dir = new THREE.Vector3(a.pos.x - tgt.pos.x, 0, a.pos.z - tgt.pos.z).normalize(); if (dir.lengthSq() < 0.1) dir.set(0, 0, 1); this.moveToward(a, tgt.pos.x + dir.x * (want + tgt.radius), tgt.pos.z + dir.z * (want + tgt.radius), 6, dt, 1); return; }
    } else {
      let tx, tz;
      if (ang !== null && tgt.boss) { const r = tgt.radius + want; tx = tgt.pos.x + Math.sin(ang) * r; tz = tgt.pos.z + Math.cos(ang) * r; }
      else { const dir = new THREE.Vector3(a.pos.x - tgt.pos.x, 0, a.pos.z - tgt.pos.z); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize(); tx = tgt.pos.x + dir.x * (tgt.radius + want); tz = tgt.pos.z + dir.z * (tgt.radius + want); }
      if (d > 2.4 || (ang !== null && Math.hypot(tx - a.pos.x, tz - a.pos.z) > 2.5)) { this.moveToward(a, tx, tz, 6.5, dt, 0.5); if (d > 2.4) return; }
    }
    a.moveSpeed = 0; a.face(tgt.pos);
    if (a.gcd > 0 || a.aiT > 0) return;
    const kit = NPC_KIT[role === 'ranged' ? 'caster' : role];
    const nearby = en.filter((e) => e.dist(role === 'caster' ? tgt : a) < 6 && !e.def.passiveAdd).length;
    if (kit.aoe && nearby >= 3) {
      const k = kit.aoe;
      if (k.cast) return this.npcCast(a, tgt, k.cast, k.name, () => { this.fx(k.fx, a, tgt, () => en.filter((e) => e.dist(tgt) < k.r + e.radius).forEach((e) => this.damage(a, e, k.p, {})), { aoe: { r: k.r } }); a.model.play(k.anim, 0.5); });
      a.gcd = 2.5; a.model.play(k.anim, 0.6); this.fx(k.fx, a, a, () => en.filter((e) => a.dist(e) < k.r + e.radius).forEach((e) => this.damage(a, e, k.p, {})), { aoe: { r: k.r } });
      return;
    }
    a.comboI = ((a.comboI ?? -1) + 1) % kit.gcd.length; const k = kit.gcd[a.comboI];
    if (k.cast) return this.npcCast(a, tgt, k.cast, k.name, () => this.npcHit(a, tgt, k));
    a.gcd = 2.5; this.npcHit(a, tgt, k);
    if (role === 'tank' && tgt.casting && tgt.casting.buster && !a.has('nebula') && !(a.cd.nebula > 0)) { a.cd.nebula = 60; this.addStatus(a, { id: 'nebula', name: '星云', dur: 10, mit: 0.3, icon: ['shield', '#6a8ae0', '#1a2a5a'] }); this.fly(a, '星云', 'status'); }
  },
  npcHit(a, tgt, k) { a.model.play(k.anim || 'release', 0.55); this.fx(k.fx, a, tgt, () => this.damage(a, tgt, k.p, {})); },
  npcCast(a, tgt, cast, name, done) {
    a.gcd = Math.max(2.5, cast); a.face(tgt.pos);
    a.casting = { name, t: 0, total: cast, tgt, npc: done, circle: VFX.castCircle(a, '#c89aff') }; a.model.setLoop('cast');
  },
  npcHeal(a, tgt, pot, name) { this.npcCast(a, tgt, 1.5, name, () => { if (tgt.dead) return; a.model.play('heal', 0.6); VFX.heal(tgt); Audio.sfxPlay('heal', 0.4); this.heal(a, tgt, pot, { show: true }); }); },
  npcAoeHeal(a) { this.npcCast(a, a, 2, '士气高扬之策', () => { a.model.play('heal', 0.6); VFX.ring(a.pos, '#7dffa8', 15, 0.8); Audio.sfxPlay('heal', 0.5); this.party().filter((e) => !e.dead && e.dist(a) < 16).forEach((e) => { this.heal(a, e, 330, { show: true }); VFX.heal(e); }); }); },
  npcRaise(a, t) { this.npcCast(a, t, 6, '复生', () => { if (t.dead) { this.revive(t, 0.3); this.log(`${a.name}对${t === G.player ? '你' : t.name}发动了「复生」。`, 'battle'); } }); },
  npcEsuna(a, t) { this.npcCast(a, t, 1, '康复', () => { const d = t.statuses.find((s) => s.cleansable); if (d) { this.removeStatus(t, d.id); this.fly(t, '解除 ' + d.name, 'heal'); VFX.pillar(t.pos, '#a0e8ff', 4, 0.8, 0.8); } }); },
  // ---------- 敌人 AI ----------
  enemyAI(e, dt) {
    if (e.dead) return;
    const def = e.def;
    if (e.has('stun')) { e.moveSpeed = 0; return; }
    if (!e.inCombat) {
      if ((def.aggro || e.aggro) && !e.noAggro && !G.cutscene) {
        for (const p of this.party()) if (!p.dead && e.dist(p) < (e.aggroR || def.aggroR || 8) && p.level < e.level + 10) { this.engage(e, p); break; }
      }
      if (!e.inCombat && !def.noMove && !e.noWander) {
        e.aiT -= dt;
        if (e.wander) { if (this.moveToward(e, e.wander[0], e.wander[1], 1.6, dt, 0.4)) e.wander = null; }
        else { e.moveSpeed = 0; if (e.aiT <= 0) { e.aiT = rand(4, 9); const a = rand(0, PI * 2), r = rand(1, e.wanderR || 5); const x = e.spawn.x + Math.cos(a) * r, z = e.spawn.z + Math.sin(a) * r; if (G.zone.canWalk(x, z, 0.4)) e.wander = [x, z]; } }
      }
      if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt * 0.2);
      return;
    }
    const tgt = this.topEnmity(e);
    if (!tgt) { this.resetEnemy(e); return; }
    if (!def.noMove && e.pos.distanceTo(e.spawn) > (e.leash || 50)) { this.resetEnemy(e); return; }
    e.target = tgt;
    if (e.casting) { e.moveSpeed = 0; return; }
    if (e.scripted) return;
    const d = e.edge(tgt);
    if (d > def.range && !def.noMove) { this.moveToward(e, tgt.pos.x, tgt.pos.z, def.speed || 5, dt, 0.2); return; }
    e.moveSpeed = 0; if (!def.noMove || e.boss) e.face(tgt.pos);
    // 技能
    (def.abilities || []).forEach((ab, i) => {
      e.abT[i] -= dt;
      if (e.abT[i] <= 0 && !e.casting) {
        e.abT[i] = rand(ab.every[0], ab.every[1]);
        let t;
        if (ab.shape === 'circle') t = { shape: 'circle', x: e.pos.x, z: e.pos.z, r: ab.r };
        else if (ab.shape === 'cone') t = { shape: 'cone', x: e.pos.x, z: e.pos.z, r: ab.r, angle: ab.angle, dir: e.rot };
        else t = { shape: 'line', x: e.pos.x, z: e.pos.z, len: ab.len, width: ab.width, dir: e.rot };
        const tel = this.aoe(e, t, ab.cast, null, { potency: ab.potency, name: ab.name });
        this.startEnemyCast(e, ab.name, ab.cast, [tel], () => e.model.play('slash', 0.6));
      }
    });
    if (e.casting) return;
    e.autoT -= dt;
    if (e.autoT <= 0 && d <= def.range + 0.5) {
      e.autoT = def.delay || 3; e.model.play(e.model instanceof Object && e.model.weaponType ? 'slash' : 'attack', 0.6);
      this.later(0.25, () => { if (!e.dead && !tgt.dead) { this.damage(e, tgt, 100, {}); VFX.hit(tgt.hitPos(), '#ff9a7a'); } });
    }
  },
  resetEnemy(e) {
    e.inCombat = false; e.enmity.clear(); e.target = null; this.interrupt(e, true); e.statuses = []; e.wander = [e.spawn.x, e.spawn.z];
    if (e.boss && this.on.bossReset) this.on.bossReset(e);
  },
  // ---------- 分摊 ----------
  startStack(src, target, delay, potency) {
    this.stack = { target, t: delay, src, potency };
    VFX.stackMarker(target, delay);
    this.log(`${target === G.player ? '你' : target.name}被标记了「水球」——所有人与其分摊伤害！`, 'battle-warn');
    if (target === G.player) G.ui.error('分摊！与队友站在一起！', 'warn');
  },
  updateStack(dt) {
    const s = this.stack; s.t -= dt;
    if (s.target.dead) { this.stack = null; return; }
    if (s.t <= 0) {
      this.stack = null;
      const n = this.party().filter((e) => !e.dead && e.dist(s.target) <= 4);
      VFX.ring(s.target.pos, '#7ad0ff', 4, 0.6); VFX.disc(s.target.pos, '#7ad0ff', 4, 0.5); Audio.sfxPlay('water');
      const per = s.potency / Math.max(1, n.length);
      n.forEach((e) => this.damage(s.src, e, per, { name: '水球', noCrit: true }));
    }
  },
  // ---------- 极限技 ----------
  useLB() {
    const P = G.player;
    if (!this.inParty()) { G.ui.error('只能在副本中使用'); return; }
    if (this.lb < this.lbMax) { G.ui.error('极限槽未满'); return; }
    const role = JOBS[P.job].role, kind = role === 'tank' ? 'tank' : role === 'healer' ? 'healer' : role === 'caster' ? 'caster' : role === 'ranged' ? 'ranged' : 'melee';
    const tgt = P.target && P.target.faction === 'enemy' && !P.target.dead ? P.target : this.enemies().filter((e) => e.inCombat).sort((a, b) => P.dist(a) - P.dist(b))[0];
    if ((kind === 'melee' || kind === 'caster' || kind === 'ranged') && !tgt) { G.ui.error('没有可用的目标'); return; }
    this.lb = 0; P.model.play(kind === 'melee' ? 'jumpatk' : 'lb', 1.1); P.model.setDrawn(true); P.drawnT = 12;
    if (tgt) P.face(tgt.pos);
    G.ui.banner('lb', JOBS[P.job].lb.name, 'LIMIT BREAK'); Audio.sfxPlay('lb');
    G.ui.chat(`你发动了极限技「${JOBS[P.job].lb.name}」！`, 'battle');
    VFX.lb(kind, P, tgt, () => {
      if (kind === 'tank') this.party().forEach((e) => this.addStatus(e, { id: 'shieldwall', name: '盾墙', dur: 12, mit: 0.4, icon: ['shield', '#f0d060', '#6a4a0a'] }));
      else if (kind === 'healer') this.party().forEach((e) => { if (!e.dead) this.heal(P, e, 0, { flat: e.effMaxHp * 0.6, show: true }); });
      else if (kind === 'melee') this.damage(P, tgt, 1800, { name: JOBS[P.job].lb.name, noCrit: true });
      else if (kind === 'ranged') { const t = { shape: 'line', x: P.pos.x, z: P.pos.z, len: 30, width: 4, dir: P.rot }; this.enemies().filter((e) => inShape(t, e.pos.x, e.pos.z, e.radius)).forEach((e) => this.damage(P, e, 1400, { name: JOBS[P.job].lb.name, noCrit: true })); }
      else this.enemies().filter((e) => e.dist(tgt) < 8 + e.radius).forEach((e) => this.damage(P, e, 1400, { name: JOBS[P.job].lb.name, noCrit: true }));
    });
  },
};

// =====================================================================
// Boss 脚本
// =====================================================================
export function bossScript(boss, api) {
  const C = Combat; let t = 0, step = 0, phase2 = false;
  const partyAlive = () => C.party().filter((e) => !e.dead);
  const nonTank = () => partyAlive().filter((e) => e.role !== 'tank');
  const tankOf = () => C.topEnmity(boss) || partyAlive()[0];
  const buster = (name, pot) => {
    const tk = tankOf(); if (!tk) return;
    C.log(`${boss.name}正在准备「${name}」！（死刑预警）`, 'battle-warn');
    api.markBuster(tk, 3.5);
    C.startEnemyCast(boss, name, 3.5, [], () => { if (!tk.dead) { boss.model.play('buster', 0.8); C.damage(boss, tk, pot, { name, noCrit: true }); VFX.hit(tk.hitPos(), '#ff5a3a', true); } }, { buster: true, anim: 'cast' });
  };
  const raidwide = (name, pot, cast = 3.5, after) => {
    C.log(`${boss.name}正在准备「${name}」！（全体攻击）`, 'battle-warn');
    C.startEnemyCast(boss, name, cast, [], () => { boss.model.play('roar', 1); VFX.ring(boss.pos, '#8ad0ff', 26, 1); partyAlive().forEach((e) => C.damage(boss, e, pot, { name, noCrit: true })); Audio.sfxPlay('water'); if (after) after(); }, { anim: 'roar' });
  };
  const scripts = {
    chopper: [
      [6, () => buster('强力钳击', 480)],
      [13, () => { const tels = partyAlive().map((e) => C.aoe(boss, { shape: 'circle', x: e.pos.x, z: e.pos.z, r: 4 }, 3.5, null, { potency: 380, name: '气泡爆裂' })); for (let i = 0; i < 2; i++) { const a = rand(0, 6.28), r = rand(3, 12); tels.push(C.aoe(boss, { shape: 'circle', x: boss.spawn.x + Math.cos(a) * r, z: boss.spawn.z + Math.sin(a) * r, r: 4 }, 3.5, null, { potency: 380, name: '气泡爆裂' })); } C.startEnemyCast(boss, '气泡爆裂', 3.5, tels, () => boss.model.play('slam', 0.8)); }],
      [21, () => { const tk = tankOf(); if (tk) boss.face(tk.pos); const tel = C.aoe(boss, { shape: 'cone', x: boss.pos.x, z: boss.pos.z, r: 13, angle: 120, dir: boss.rot }, 3, null, { potency: 420, name: '横扫' }); C.startEnemyCast(boss, '横扫', 3, [tel], () => boss.model.play('sweep', 0.8)); }],
      [28, () => raidwide('泡沫喷溅', 150, 3)],
      [34, () => { const tels = []; for (const e of nonTank()) tels.push(C.aoe(boss, { shape: 'line', x: boss.pos.x, z: boss.pos.z, len: 22, width: 4, dir: Math.atan2(e.pos.x - boss.pos.x, e.pos.z - boss.pos.z) }, 3.5, null, { potency: 360, name: '钳击冲波' })); C.startEnemyCast(boss, '钳击冲波', 3.5, tels, () => boss.model.play('attack', 0.6)); }],
      [40, () => { t = 0; step = 0; }],
    ],
    madison: [
      [2, () => { if (!boss.addsSpawned) { boss.addsSpawned = true; api.spawnAdds(boss, 2); C.log('麦迪逊船长：「小的们！给我上！」', 'npc'); } }],
      [7, () => { const tel = C.aoe(boss, { shape: 'circle', x: boss.pos.x, z: boss.pos.z, r: 8 }, 3.5, null, { potency: 420, name: '旋风斩' }); tel.follow = boss; C.startEnemyCast(boss, '旋风斩', 3.5, [tel], () => boss.model.play('spin', 0.7), { anim: 'spin' }); }],
      [15, () => { const tels = []; const base = rand(0, PI); for (let i = 0; i < 3; i++) { const a = base + i * PI / 3; const cx = boss.spawn.x, cz = boss.spawn.z, off = (i - 1) * 9; const ox = cx + Math.cos(a) * off - Math.sin(a) * 18, oz = cz - Math.sin(a) * off - Math.cos(a) * 18; tels.push(C.aoe(boss, { shape: 'line', x: ox, z: oz, len: 36, width: 5, dir: a }, 4, null, { potency: 400, name: '炮火齐射' })); } C.log('麦迪逊船长：「开炮！把他们轰成碎片！」', 'npc'); C.startEnemyCast(boss, '炮火齐射', 4, tels, () => { tels.forEach((tl) => { for (let k = 0; k < 5; k++) VFX.fire(new THREE.Vector3(tl.x + Math.sin(tl.dir) * k * 7, 1, tl.z + Math.cos(tl.dir) * k * 7), 0.8); }); Audio.sfxPlay('fire'); }, { anim: 'point' }); }],
      [24, () => buster('致命突刺', 460)],
      [30, () => { if (!phase2 && boss.hp < boss.maxHp * 0.55) { phase2 = true; api.spawnAdds(boss, 2); C.log('麦迪逊船长：「援军呢？！都给我出来！」', 'npc'); } const tel = C.aoe(boss, { shape: 'donut', x: boss.pos.x, z: boss.pos.z, rin: 5, r: 16 }, 4, null, { potency: 400, name: '回旋弹幕' }); C.startEnemyCast(boss, '回旋弹幕', 4, [tel], () => boss.model.play('spin', 0.7)); }],
      [37, () => { t = 0; step = 1; }],
    ],
    denn: [
      [4, () => { const nt = nonTank(); const tgt = pick(nt.length ? nt : partyAlive()); if (tgt) { C.startEnemyCast(boss, '水球', 2.5, [], () => boss.model.play('attack', 0.6)); C.startStack(boss, tgt, 6.5, 1100); } }],
      [13, () => { const tels = []; for (const e of partyAlive()) tels.push(C.aoe(boss, { shape: 'circle', x: e.pos.x, z: e.pos.z, r: 5 }, 3.5, null, { potency: 380, name: '尾鳍拍击' })); C.startEnemyCast(boss, '尾鳍拍击', 3.5, tels, () => boss.model.play('dive', 1.4)); }],
      [20, () => { C.log('虎鲸牙·丹恩召唤了巨蚌！在巨蚌吸收海之力之前将其击破！', 'battle-warn'); api.spawnClams(boss); C.startEnemyCast(boss, '召唤巨蚌', 2, [], () => boss.model.play('roar', 1), { anim: 'roar' }); }],
      [28, () => raidwide('大海啸', 170, 4, () => api.knockback(boss, 8))],
      [35, () => { const pts = partyAlive(); for (let i = 0; i < Math.min(2, pts.length); i++) { const v = pick(pts); C.addStatus(v, { id: 'poison', name: '水毒', dur: 15, dot: 55, srcId: boss.id, debuff: true, cleansable: true, icon: ['drop', '#6ac040', '#1a3a0a'] }); C.fly(v, '水毒', 'status'); } C.log('虎鲸牙·丹恩喷出了带毒的海水！（可以用「康复」解除）', 'battle-warn'); boss.model.play('roar', 1); }],
      [40, () => { const tel = C.aoe(boss, { shape: 'cone', x: boss.pos.x, z: boss.pos.z, r: 22, angle: 90, dir: boss.rot + (Math.random() < 0.5 ? -0.5 : 0.5) }, 3.5, null, { potency: 440, name: '深渊吐息' }); C.startEnemyCast(boss, '深渊吐息', 3.5, [tel], () => boss.model.play('attack', 0.8)); }],
      [46, () => { t = 0; }],
    ],
  };
  const tl = scripts[boss.def.boss] || [];
  return {
    update(dt) {
      if (boss.dead || !boss.inCombat) { t = 0; step = 0; return; }
      if (boss.casting) return;
      t += dt;
      for (const ev of tl) if (!ev.done && t >= ev[0]) { ev.done = true; ev[1](); if (t === 0) { tl.forEach((x) => (x.done = false)); break; } }
      if (t === 0) tl.forEach((x) => (x.done = false));
    },
  };
}
