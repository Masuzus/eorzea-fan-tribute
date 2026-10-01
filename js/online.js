// 联机战斗（第二档）：野外与副本里的魔物、伤害、FATE、头目机制都由服务器计算（js/sim/world.js）。
// 本模块把服务器推送的事件与状态还原成画面——模型、特效、飞字、日志、界面——
// 并把玩家的操作（选中目标、咏唱、发动技能、打开宝箱、分配战利品）作为「意图」发给服务器。
// 本地仍然立即播放公共复唱、咏唱条和动作，手感不受网络延迟影响；结果以服务器为准。
import { THREE, G, angDiff } from './engine.js';
import { Humanoid } from './character.js';
import { Combat, Entity } from './combat.js';
import { VFX } from './vfx.js';
import { Audio } from './audio.js';
import { UI, roleIcon } from './ui.js';
import { JOBS, ALLIES, MOBS } from './data.js';
import { STATUS, MOB_RADIUS, trustFill } from './sim/defs.js';
import { Net } from './net.js';
import { Story } from './story.js';

const V3 = THREE.Vector3;
const SK = {};
for (const [job, j] of Object.entries(JOBS)) for (const s of j.skills) SK[job + ':' + s.id] = s;
const ANIM_DUR = { attack: 0.6, slash: 0.55, slash2: 0.55, heavy: 0.75, thrust: 0.55, spin: 0.7, punch: 0.55, release: 0.55, heal: 0.6, buff: 0.6, slam: 0.8, sweep: 0.8, buster: 0.8, roar: 1, dive: 1.4, point: 1.5 };
const CAST_COLOR = { fire: '#ff8a3a', ice: '#7ad8ff', heal: '#8affb0' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export const Online = {
  ents: new Map(), teles: new Map(), engaged: new Set(), pendSS: new Map(), pendST: new Map(),
  sentTgt: null, lastUseT: -9, recentLines: [], q: null,

  // ---------- 进出地图 ----------
  // 进入野外，或带着入场凭证进入副本时启用联机战斗；返回是否启用
  prepare(zone, opts = {}) {
    this.reset();
    G.online = !!(Net.url && (zone === 'field' || (zone === 'dungeon' && opts.inst)));
    return G.online;
  },
  reset() {
    for (const t of this.teles.values()) t.vis.kill = true;
    this.ents.clear(); this.teles.clear(); this.engaged.clear(); this.pendSS.clear(); this.pendST.clear();
    this.sentTgt = null; this.recentLines = [];
    G.online = false;
  },
  // 连不上服务器：改回单人模式，由本地生成魔物 / 副本
  fallback(why) {
    if (!G.online || !G.zone) return;
    G.online = false;
    UI.chat(why || '无法连接联机服务器，已切换为单人模式。', 'system');
    if (G.zone.id === 'field') G.game.spawnLocalField();
    else if (G.zone.dungeon) G.game.localDuty();
  },
  // 欢迎消息：服务器世界的完整状态（断线重连时也会再来一次）
  begin(sim) {
    if (!G.online) return;
    for (const e of [...this.ents.values()]) this.remove(e);
    for (const t of this.teles.values()) t.vis.kill = true;
    this.teles.clear();
    G.player.sid = Net.id;
    for (const s of sim.sp || []) this.spawn(s, true);
    this.applySS(sim.ss || []);
    if (sim.st) this.applyST(sim.st);
    Combat.lb = sim.lb || 0;
    if (sim.fate) Story.netFate({ s: 'start', t: sim.fate.t, p: sim.fate.p, quiet: true });
    if (G.duty) {
      if (sim.di) this.applyDI(sim.di);
      if (sim.memo) G.duty.memo = sim.memo;
      for (const [id, open] of Object.entries(sim.doors || {})) if (open) Story.setDoor(id, true, true);
      for (const s of sim.seals || []) G.zone.setSeal(s, true);
      if (sim.chest) Story.netDuty({ s: 'chest', x: sim.chest.x, z: sim.chest.z, op: sim.chest.op, quiet: true });
    }
  },
  gone() {
    // 副本实例已不存在（过期或服务器重启）
    if (!G.zone || !G.zone.dungeon) return;
    this.fallback('联机副本已经解散，改为与亲信战友一起攻略。');
  },

  // ---------- 实体 ----------
  byId(id) {
    if (!id) return null;
    if (id === Net.id) return G.player;
    return this.ents.get(id) || Net.remotes.get(id) || null;
  },
  spawn(s, quiet) {
    if (this.ents.has(s.id)) return this.ents.get(s.id);
    let e;
    if (s.t === 'ally') {
      const A = ALLIES[s.ally]; if (!A) return null;
      const model = new Humanoid(A.app, A.gear, { faceRes: 256 });
      e = new Entity({ name: A.name, title: A.job, kind: 'ally', faction: 'party', model, level: s.lv, hp: s.mhp, role: A.role, radius: 0.5, height: model.height, x: s.x, y: s.y, z: s.z, rot: s.r, allyKey: s.ally });
      e.slot = s.slot; G.game.addEntity(e);
    } else {
      if (!MOBS[s.mob]) return null;
      e = G.game.spawnMob(s.mob, s.lv, s.x, s.z, { rot: s.r });
      e.maxHp = e.hp = s.mhp;
      if (MOB_RADIUS[s.mob]) e.radius = MOB_RADIUS[s.mob];
      if (s.mob === 'denn') e.plateH = 7.5;
      e.fate = !!s.fate; e.add = !!s.add;
      if (!quiet && (s.fate || s.add)) VFX.burst(e.hitPos(), s.mob === 'clam' ? '#ff8ad0' : s.fate ? '#7ad0ff' : '#ffb070', 16, { speed: 3 });
      if (!quiet && s.mob === 'sahagin_chief') { VFX.pillar(e.pos, '#7ad0ff', 10, 1.5, 2); UI.error('沙哈金族战士长出现了！', 'warn'); }
    }
    e.net = true; e.sid = s.id; e.np = { x: s.x, z: s.z, r: s.r, sp: 0 };
    this.ents.set(s.id, e);
    return e;
  },
  remove(e) {
    if (!e) return;
    this.ents.delete(e.sid);
    if (e.casting && e.casting.circle) e.casting.circle.remove();
    G.game.removeEntity(e);
  },
  onRemoteAdded(e) {
    if (G.online && G.zone && G.zone.dungeon) { e.faction = 'party'; e.role = JOBS[e.look.job].role; }
    e.job = e.look.job; e.sid = e.netId;
    const r = this.pendSS.get(e.netId); if (r) { this.pendSS.delete(e.netId); this.applySS([r]); }
    const st = this.pendST.get(e.netId); if (st) { this.pendST.delete(e.netId); this.applyST({ [e.netId]: st }); }
  },

  // ---------- 状态同步 ----------
  applySS(ss) {
    const P = G.player;
    for (const r of ss) {
      const [id, x, z, y, rot, hp, mhp, fl, cf, tg, mp, sp] = r;
      const e = this.byId(id);
      if (!e) { this.pendSS.set(id, r); continue; }
      const dead = !!(fl & 1);
      e.maxHp = mhp; e.hp = Math.min(hp, e.effMaxHp); e.mp = mp;
      if (e === P || e.kind === 'remote') {
        if (dead && !e.dead) this.markDead(e, false); else if (!dead && e.dead) this.revived(e, true);
        continue;
      }
      e.np = { x, z, y, r: rot, sp };
      e.inCombat = !!(fl & 2);
      if (e.kind === 'ally') { const d = !!(fl & 4); if (e.model.drawn !== d) e.model.setDrawn(d); }
      e.target = this.byId(tg);
      if (e.casting && cf >= 0) e.casting.t = cf * e.casting.total;
      if (dead && !e.dead) this.markDead(e, true); else if (!dead && e.dead) this.revived(e, true);
    }
  },
  applyST(st) {
    const P = G.player;
    for (const id in st) {
      const e = this.byId(id);
      if (!e) { this.pendST.set(id, st[id]); continue; }
      const list = st[id].map(([sid, t, src, stacks]) => {
        const d = STATUS[sid] || { name: sid };
        return { id: sid, name: d.name, icon: d.icon, debuff: !!d.debuff, t: t < 0 ? Infinity : t, max: t < 0 ? Infinity : t, src: this.byId(src), stacks, net: true };
      });
      e.statuses = list.concat(e.statuses.filter((s) => s.local));
      if (e === P) G.ui.dirtyStatus = true;
    }
  },
  applyDI(di) {
    const D = G.duty; if (!D || !di) return;
    D.t = di.t; Object.assign(D.done, di.done);
  },

  // ---------- 每帧 ----------
  update(dt) {
    const C = Combat, P = G.player;
    for (let i = C.timers.length - 1; i >= 0; i--) { const t = C.timers[i]; t.t -= dt; if (t.t <= 0) { C.timers.splice(i, 1); t.fn(); } }
    // 自己：本地预测公共复唱、咏唱、连击计时
    P.gcd = Math.max(0, P.gcd - dt); P.animLock = Math.max(0, P.animLock - dt);
    for (const k in P.cd) if (P.cd[k] > 0) P.cd[k] -= dt;
    if (P.combo) { P.combo.t -= dt; if (P.combo.t <= 0) P.combo = null; }
    for (let i = P.statuses.length - 1; i >= 0; i--) { const s = P.statuses[i]; s.t -= dt; if (s.t <= 0 && s.local) { P.statuses.splice(i, 1); G.ui.dirtyStatus = true; } }
    if (P.casting) {
      const c = P.casting; c.t += dt;
      if (c.t >= c.total) {
        P.casting = null; c.circle && c.circle.remove(); P.model.setLoop(null);
        if (c.sk) this.finishCast(c); else if (c.npc) c.npc();
        P.animLock = 0.3;
      }
    }
    if (P.queued && !P.casting && P.animLock <= 0) { const q = P.queued; if (!q.gcd || P.gcd <= 0) { P.queued = null; this.use(q); } }
    P.drawnT = Math.max(0, (P.drawnT || 0) - (this.inCombat() ? 0 : dt));
    // 其他实体：插值到服务器位置，状态时间倒数
    const Z = G.zone, k = 1 - Math.exp(-dt * 10);
    for (const e of this.ents.values()) {
      for (const s of e.statuses) if (s.t > 0) s.t = Math.max(0, s.t - dt);
      if (e.casting) e.casting.t = Math.min(e.casting.total, e.casting.t + dt);
      if (e.kb) continue;
      const n = e.np, dx = n.x - e.pos.x, dz = n.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > 10) { e.pos.x = n.x; e.pos.z = n.z; } else { e.pos.x += dx * k; e.pos.z += dz * k; }
      const h = Z.heightAt(e.pos.x, e.pos.z); e.pos.y = h ?? n.y ?? e.pos.y;
      if (!e.dead) e.rot += angDiff(e.rot, n.r) * Math.min(1, dt * 10);
      e.moveSpeed = e.dead ? 0 : n.sp > 0.1 ? n.sp : d > 0.3 ? Math.min(6, d * 6) : 0;
    }
    for (const r of Net.remotes.values()) { if (r.casting) r.casting.t = Math.min(r.casting.total, r.casting.t + dt); for (const s of r.statuses) if (s.t > 0) s.t = Math.max(0, s.t - dt); }
    // 选中目标同步给服务器（自动攻击以此为准）
    const tid = P.target && P.target.sid ? P.target.sid : '';
    if (Net.id && tid !== this.sentTgt) { this.sentTgt = tid; Net.send({ t: 'tgt', id: tid }); }
    this.recentLines = this.recentLines.filter((l) => G.time - l.at < 1);
  },
  // 自己是否在战斗中：野外只算与自己交过手的魔物，副本里全队共享
  inCombat() {
    const P = G.player;
    for (const e of this.ents.values()) {
      if (e.faction !== 'enemy' || e.dead || !e.inCombat) continue;
      if (G.zone.dungeon || e.target === P || this.engaged.has(e.sid)) return true;
    }
    return false;
  },
  mine(e) { return G.zone.dungeon ? e.inCombat : e.inCombat && (this.engaged.has(e.sid) || e.target === G.player); },

  // ---------- 玩家操作 → 意图 ----------
  use(sk) {
    const P = G.player, C = Combat;
    const err = C.canUse(P, sk);
    if (err === 'gcd' || (err === null && P.animLock > 0)) {
      if ((sk.gcd && P.gcd <= 0.6) || (!sk.gcd && P.animLock > 0)) { P.queued = sk; return true; }
      return false;
    }
    if (err) { UI.error(err); return false; }
    if (P.casting) { UI.error('正在咏唱'); return false; }
    if (!Net.id) { UI.error('正在连接服务器…'); return false; }
    const tgt = C.resolveTarget(P, sk);
    if (!tgt && sk.target !== 'none') { UI.error(sk.target === 'dead' ? '请选中无法战斗的队员' : '没有可用的目标'); return false; }
    if (tgt && tgt !== P && (sk.target === 'enemy' || sk.target === 'ally' || sk.target === 'dead')) {
      if (P.edge(tgt) > (sk.range || 3)) { UI.error('目标不在射程内'); return false; }
      P.face(tgt.pos);
    }
    if (sk.target === 'enemy') G.game.setTarget(tgt);
    const ct = C.castTime(P, sk), tg = tgt && tgt !== P ? tgt.sid || '' : '';
    if (sk.gcd) P.gcd = P.gcdMax = Math.max(2.5, ct);
    if (!sk.gcd && sk.recast) P.cd[sk.id] = sk.recast;
    P.model.setDrawn(true); P.drawnT = 12; this.lastUseT = G.time;
    if (tgt && tgt.faction === 'enemy') this.engaged.add(tgt.sid);
    if (ct > 0) {
      const col = CAST_COLOR[sk.element] || (sk.heal || sk.raise || sk.esuna ? '#8affb0' : '#c89aff');
      P.casting = { sk, t: 0, total: ct, tgt, circle: VFX.castCircle(P, col), name: sk.name, start: G.time };
      P.model.setLoop('cast'); Audio.sfxPlay('cast', 0.4);
      Net.send({ t: 'cast', sk: sk.id, tg });
      return true;
    }
    P.animLock = 0.6;
    this.sendUse(sk, tg);
    return true;
  },
  finishCast(c) {
    const P = G.player, sk = c.sk, tgt = c.tgt;
    const bad = (sk.target === 'enemy' && (!tgt || tgt.dead)) || (sk.target === 'ally' && tgt && tgt.dead) || (sk.target === 'dead' && tgt && !tgt.dead);
    if (bad) { UI.error('目标无效'); Net.send({ t: 'int' }); return; }
    if (tgt && tgt !== P) P.face(tgt.pos);
    this.sendUse(sk, tgt && tgt !== P ? tgt.sid || '' : '');
  },
  sendUse(sk, tg) {
    const P = G.player;
    if (sk.anim) P.model.play(sk.anim, sk.anim === 'shoot' ? 0.7 : sk.anim === 'heavy' ? 0.75 : sk.anim === 'spin' ? 0.6 : 0.55);
    Net.send({ t: 'use', sk: sk.id, tg });
  },
  interrupted() { if (Net.id) Net.send({ t: 'int' }); },
  potion() { Net.send({ t: 'gen', g: 'potion' }); },
  limitBreak() {
    if (!Combat.inParty()) { UI.error('只能在副本中使用'); return; }
    if (Combat.lb < Combat.lbMax) { UI.error('极限槽未满'); return; }
    Net.send({ t: 'gen', g: 'lb' });
  },
  checkpoint() { Net.send({ t: 'gen', g: 'rv' }); },
  openChest() { Net.send({ t: 'chest' }); },
  obj(id) { Net.send({ t: 'obj', id }); },
  loot(i, c) { Net.send({ t: 'loot', i, c }); },

  // ---------- 服务器 → 画面 ----------
  onWorld(m) {
    if (!G.online || !G.zone) return;
    if (m.ss) this.applySS(m.ss);
    if (m.st) this.applyST(m.st);
    if (m.lb !== undefined) Combat.lb = m.lb;
    if (m.di) this.applyDI(m.di);
    for (const e of m.ev || []) { try { this.event(e); } catch (err) { console.warn('online event', e && e.k, err); } }
  },
  event(e) {
    const P = G.player, S = Story;
    switch (e.k) {
      case 'sp': this.spawn(e); break;
      case 'rm': this.remove(this.ents.get(e.id)); break;
      case 'hit': this.onHit(e); break;
      case 'heal': {
        const s = this.byId(e.s), t = this.byId(e.t); if (!t) break;
        if (!t.dead) t.hp = Math.min(t.effMaxHp, t.hp + e.v);
        if (s === P || t === P || e.sh) Combat.fly(t, (e.c ? '暴击! ' : '') + e.v, 'heal');
        break;
      }
      case 'die': this.markDead(this.byId(e.id), !!e.q); break;
      case 'rv': this.revived(this.byId(e.id)); break;
      case 'kill': {
        const x = this.ents.get(e.id); this.engaged.delete(e.id);
        if ((e.cr || []).includes(Net.id)) S.credit({ mobKind: e.mob, level: e.lv, boss: !!e.boss, fateBoss: !!e.fb, passiveAdd: !!e.pa });
        if (x && e.boss) x.deadT = 0;
        break;
      }
      case 'cast': this.onCast(e); break;
      case 'ce': this.endCast(this.byId(e.id), !!e.i); break;
      case 'anim': { const x = this.byId(e.id); if (x && x !== P && x.kind !== 'remote') x.model.play(e.a, ANIM_DUR[e.a] || 0.6); break; }
      case 'fx': this.onFx(e); break;
      case 'tele': {
        const t = { shape: e.sh, x: e.x, z: e.z, r: e.r, rin: e.rin, angle: e.an, dir: e.dir, len: e.len, width: e.w, dur: e.d, follow: e.f ? this.byId(e.f) : null };
        this.teles.set(e.i, { vis: VFX.telegraph(t), t });
        break;
      }
      case 'tc': { const t = this.teles.get(e.i); if (t) { t.vis.kill = true; this.teles.delete(e.i); } break; }
      case 'aoe': {
        const t = this.teles.get(e.i); if (t) { t.vis.kill = true; this.teles.delete(e.i); }
        const pos = new V3(e.x, G.zone.heightAt(e.x, e.z) ?? 0, e.z);
        VFX.disc(pos, '#ffb070', e.sh === 'circle' ? e.r : 3, 0.4);
        if (e.sh === 'circle') VFX.ring(pos, '#ffd0a0', e.r, 0.4);
        if (e.sh === 'line' || e.sh === 'cone') { const fx = { pos, rot: e.dir }; if (e.sh === 'line') { VFX.line(fx, '#ffb070', e.len, e.w); this.recentLines.push({ x: e.x, z: e.z, dir: e.dir, at: G.time }); } else VFX.cone(fx, '#ffb070', e.r, e.an); }
        Audio.sfxPlay('aoe', 0.5);
        break;
      }
      case 'msg': UI.chat(e.m, e.c || 'battle-warn'); break;
      case 'err':
        UI.error(e.m);
        // 服务器拒绝了刚才的操作：撤销本地预测的公共复唱与咏唱
        if (G.time - this.lastUseT < 0.8) { P.gcd = 0; P.queued = null; if (P.casting && P.casting.sk) Combat.interrupt(P, true); }
        break;
      case 'tgt': { const x = this.byId(e.id); if (x && x !== P.target) G.game.setTarget(x); break; }
      case 'combo': P.combo = e.id ? { id: e.id, t: 15 } : null; break;
      case 'proc': Combat.fly(P, e.n, 'status'); break;
      case 'stack': { const x = this.byId(e.id); if (!x) break; VFX.stackMarker(x, e.d); if (x === P) UI.error('分摊！与队友站在一起！', 'warn'); break; }
      case 'kb': P.kb = { dx: e.dx, dz: e.dz, t: e.d / 20 }; UI.error('被击退了！', 'warn'); break;
      case 'tp': { P.pos.set(e.x, G.zone.heightAt(e.x, e.z) ?? 0, e.z); P.kb = null; G.game.snapCamera(); break; }
      case 'door': if (G.duty) Story.setDoor(e.id, !!e.open); break;
      case 'seal': G.zone.setSeal(e.s, !!e.on); if (e.on) Audio.sfxPlay('seal'); else if (G.duty) Audio.play('dungeon'); break;
      case 'lbu': this.onLB(e); break;
      case 'fate': S.netFate(e); break;
      case 'duty': S.netDuty(e); break;
    }
  },
  onHit(e) {
    const P = G.player, s = this.byId(e.s), t = this.byId(e.t); if (!t) return;
    if (!t.dead) t.hp = Math.max(0, t.hp - e.v);
    if (s === P && t.faction === 'enemy') this.engaged.add(t.sid);
    if (t === P && s && s.faction === 'enemy') this.engaged.add(s.sid);
    if (t.faction === 'party' && t !== P && t.kind !== 'remote' && !t.casting && Math.random() < 0.35) t.model.play('hit', 0.35);
    if (t === P && !P.casting && Math.random() < 0.35) P.model.play('hit', 0.35);
    const crit = !!e.c, dh = !!e.d, tag = crit && dh ? '暴击直击! ' : crit ? '暴击! ' : dh ? '直击! ' : '';
    const sf = s ? s.faction : 'enemy';
    const cls = t === P ? 'dmg-in' : s === P ? (crit ? 'dmg-crit' : 'dmg-out') : t.faction === 'party' ? 'dmg-party' : sf === 'party' ? 'dmg-ally' : 'dmg-out';
    if (s === P || t === P || (sf === 'party' && t.faction === 'enemy' && Math.random() < 0.6) || t.faction === 'party') Combat.fly(t, tag + e.v, cls + (e.dot ? ' dot' : ''));
    if (s === P && e.n) Combat.log(`你发动了「${e.n}」，${t.name}受到了${e.v}点伤害。`, 'battle');
    else if (t === P && e.n) Combat.log(`${s ? s.name : '敌人'}发动了「${e.n}」，你受到了${e.v}点伤害。`, 'battle-in');
    if (crit && s === P) Audio.sfxPlay('crit', 0.6);
  },
  markDead(e, quiet) {
    if (!e || e.dead) return;
    const P = G.player;
    e.dead = true; e.hp = 0; e.deadT = quiet && e.faction === 'enemy' ? 1.5 : 0;
    if (e.casting) this.endCast(e, false);
    if (e === P) { if (P.casting) Combat.interrupt(P, true); P.queued = null; }
    e.model.setDead(true);
    if (e.faction === 'enemy') { if (!quiet) Combat.log(`${e.name}被打倒了。`, 'battle'); return; }
    if (e === P || e.faction === 'party') Combat.log(`${e === P ? '你' : e.name}陷入了无法战斗状态。`, 'battle-in');
    if (e === P) { Audio.sfxPlay('death'); Story.onPlayerDeath(); }
  },
  revived(e, silent) {
    if (!e || !e.dead) return;
    e.dead = false; e.deadT = 0; e.model.setDead(false); e.model.setOpacity && e.model.setOpacity(1);
    if (!silent) { VFX.pillar(e.pos, '#fff0b0', 6, 1.2); Combat.fly(e, '复活', 'heal'); }
    if (e === G.player) {
      // 被队友复活：关闭「返回返回点 / 在检查点复活」的提示
      if (G.duty && G.duty.closeRevive) { const f = G.duty.closeRevive; G.duty.closeRevive = null; f(-1); }
      if (UI.win.dead) UI.closeWin('dead');
    }
  },
  onCast(e) {
    const x = this.byId(e.id); if (!x || x === G.player) return;
    if (x.casting && x.casting.circle) x.casting.circle.remove();
    const enemy = x.faction === 'enemy';
    x.casting = { name: e.n, t: 0, total: e.tt, net: true, buster: !!e.b, enemy };
    if (enemy) { x.model.play(e.a || 'cast', e.tt); x.model.setLoop && x.model.setLoop('cast'); }
    else {
      x.casting.circle = VFX.castCircle(x, CAST_COLOR[e.el] || '#c89aff');
      if (x.kind !== 'remote') x.model.setLoop('cast');
    }
  },
  endCast(x, interrupted) {
    if (!x) return;
    const P = G.player;
    if (x === P) { if (interrupted && P.casting && P.casting.sk) Combat.interrupt(P); return; }
    if (!x.casting) return;
    if (x.casting.circle) x.casting.circle.remove();
    x.casting = null;
    if (x.kind !== 'remote') x.model.setLoop && x.model.setLoop(null);
  },
  onFx(e) {
    const s = this.byId(e.s), t = this.byId(e.t) || s;
    switch (e.f) {
      case 'auto': if (t) VFX.hit(t.hitPos(), '#ffffff'); break;
      case 'autoarrow': if (s && t) VFX.projectile(s.hitPos(), t, { kind: 'arrow', speed: 45, size: 0.4 }); break;
      case 'mobhit': if (t) VFX.hit(t.hitPos(), '#ff9a7a'); break;
      case 'buff': if (s) { VFX.ring(s.pos, '#ffe0a0', 2, 0.5); Audio.sfxPlay('buff', 0.6); if (s === G.player && SK[e.sk]) Combat.log(`你发动了「${SK[e.sk].name}」。`); } break;
      case 'toggle': if (s) { VFX.flash(s.hitPos(), '#8ab0ff', 2, 0.3); Audio.sfxPlay('buff', 0.5); } break;
      case 'transpose': if (s) VFX.flash(s.hitPos(), '#c080ff', 2, 0.3); break;
      case 'provoke': if (t) { VFX.flash(t.hitPos(), '#ffb040', 2, 0.4); Combat.fly(t, '挑衅', 'status'); } break;
      case 'potion': if (s) { VFX.heal(s, '#ff9ab0'); Audio.sfxPlay('heal', 0.5); } break;
      case 'esuna': if (t) { if (e.n) Combat.fly(t, '解除 ' + e.n, 'heal'); VFX.pillar(t.pos, '#a0e8ff', 4, 0.8, 0.8); Audio.sfxPlay('heal', 0.5); } break;
      case 'raise': Audio.sfxPlay('heal'); break;
      case 'stackhit': if (t) { VFX.ring(t.pos, '#7ad0ff', 4, 0.6); VFX.disc(t.pos, '#7ad0ff', 4, 0.5); Audio.sfxPlay('water'); } break;
      case 'buster': if (t) { Combat.fly(t, '⚠ 死刑', 'status'); VFX.ring(t.pos, '#ff3a2a', 2.2, 3.4); } break;
      case 'bigHit': if (t) VFX.hit(t.hitPos(), '#ff5a3a', true); break;
      case 'raidwide': if (s) { VFX.ring(s.pos, '#8ad0ff', 26, 1); Audio.sfxPlay('water'); } break;
      case 'empower': if (s) VFX.pillar(s.pos, '#ff6ab0', 12, 1.2, 4); break;
      case 'cannons':
        for (const l of this.recentLines) for (let k = 0; k < 5; k++) { const x = l.x + Math.sin(l.dir) * k * 7, z = l.z + Math.cos(l.dir) * k * 7; VFX.fire(new V3(x, (G.zone.heightAt(x, z) ?? (s ? s.pos.y : 0)) + 1, z), 0.8); }
        Audio.sfxPlay('fire');
        break;
      default: {
        if (!s || !t) break;
        const sk = SK[e.sk] || (e.r ? { aoe: { r: e.r } } : {});
        if ((e.f === 'heal' || e.f === 'heal2') && !e.sk) { VFX.heal(t); Audio.sfxPlay('heal', 0.4); break; }
        if (e.f === 'medica' && !e.sk) { VFX.ring(s.pos, '#7dffa8', 15, 0.8); Audio.sfxPlay('heal', 0.5); break; }
        Combat.fx(e.f, s, t, () => { }, sk);
      }
    }
  },
  onLB(e) {
    const P = G.player, x = this.byId(e.id), tgt = this.byId(e.t); if (!x) return;
    Combat.lb = 0;
    if (x === P) {
      P.model.play(e.kind === 'melee' ? 'jumpatk' : 'lb', 1.1); P.model.setDrawn(true); P.drawnT = 12;
      if (tgt) P.face(tgt.pos);
      UI.banner('lb', e.n, 'LIMIT BREAK'); UI.chat(`你发动了极限技「${e.n}」！`, 'battle');
    } else {
      if (x.kind !== 'remote') x.model.play(e.kind === 'melee' ? 'jumpatk' : 'lb', 1.1);
      UI.chat(`${x.name}发动了极限技「${e.n}」！`, 'battle');
    }
    Audio.sfxPlay('lb');
    VFX.lb(e.kind, x, tgt || x, null);
  },

  // ---------- 任务搜索器（联机匹配） ----------
  queue(fallback) {
    if (this.q) { UI.error('正在匹配中'); return; }
    let ws;
    try { ws = new WebSocket(`${Net.url}?zone=queue`); } catch { fallback(); return; }
    const Q = this.q = { ws, opened: false, done: false };
    const finish = () => { clearInterval(Q.hb); Q.done = true; if (this.q === Q) this.q = null; try { ws.close(1000); } catch { /* 已关闭 */ } UI.closeWin('dfq'); };
    ws.onopen = () => {
      Q.opened = true;
      ws.send(JSON.stringify({ t: 'q', ...Net.look() }));
      Q.hb = setInterval(() => { try { ws.send('{"t":"p"}'); } catch { /* 已关闭 */ } }, 15000);
      UI.chat('已申请参加「天然要害沙斯塔夏溶洞」。正在匹配其他冒险者……', 'system'); Audio.sfxPlay('confirm');
      const w = UI.openWin('dfq', '任务搜索中', `<div class="dutypop"><div class="muted">迷宫挑战</div><div class="dn">天然要害沙斯塔夏溶洞</div><div id="dfq-st" class="muted" style="margin-top:10px;font-size:13px">正在寻找队友……</div><p class="desc" style="margin-top:10px">与同时申请的冒险者组成 4 人小队（1 防护 · 1 治疗 · 2 输出）。等待超过 20 秒时，空缺的位置由亲信战友补上。</p></div>`, '<button class="btn" id="dfq-cancel">取消申请</button><button class="btn primary" id="dfq-go">立即出发</button>', { width: '420px', noClose: true });
      w.querySelector('#dfq-cancel').onclick = () => { Audio.sfxPlay('close'); try { ws.send('{"t":"cancel"}'); } catch { /* 已关闭 */ } finish(); UI.chat('取消了任务申请。', 'system'); };
      w.querySelector('#dfq-go').onclick = () => { Audio.sfxPlay('confirm'); try { ws.send('{"t":"go"}'); } catch { /* 已关闭 */ } };
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'qs') {
        const el = document.getElementById('dfq-st'); if (!el) return;
        const c = m.c || {};
        el.innerHTML = `已等待 <b class="num">${m.w}</b> 秒 · 排队中 ${m.n} 人<br>防护 ${Math.min(1, c.tank)}/1　治疗 ${Math.min(1, c.healer)}/1　输出 ${Math.min(2, c.dps)}/2`;
      } else if (m.t === 'match') { finish(); this.ready(m); }
      else if (m.t === 'qerr') { finish(); UI.error('匹配失败，请重试'); }
    };
    ws.onclose = () => { if (Q.done) return; finish(); if (!Q.opened) fallback(); else UI.chat('与任务搜索器的连接中断了。', 'system'); };
    ws.onerror = () => { };
  },
  async ready(m) {
    if (G.state !== 'play') return;
    Audio.sfxPlay('duty');
    const party = (m.party || []).map((p) => ({ name: p.name, role: JOBS[p.job] ? JOBS[p.job].role : 'tank', job: p.job, me: p.name === G.save.name }));
    const trust = trustFill(party.map((p) => p.role)).map((k) => ({ name: ALLIES[k].name, role: ALLIES[k].role, trust: true }));
    const list = party.concat(trust);
    let sec = 45;
    const body = `<div class="dutypop"><div class="muted">迷宫挑战</div><div class="dn">天然要害沙斯塔夏溶洞</div><div class="df"><div class="party-row" style="justify-content:center">${list.map((p) => `<span title="${p.trust ? '亲信战友' : '冒险者'}"><img src="${roleIcon(p.role)}" alt="">${esc(p.name)}${p.trust ? '<small class="muted">（NPC）</small>' : ''}</span>`).join('')}</div></div><div class="timer" id="dp-t" style="margin-top:12px">剩余时间 0:45</div></div>`;
    const i = await UI.modal('dutypop', '任务准备完毕', body, [{ text: '稍后再说' }, { text: '突入', primary: true }], { width: '440px', mount: (w, close) => { const iv = setInterval(() => { sec--; const el = w.querySelector('#dp-t'); if (!w.isConnected) { clearInterval(iv); return; } if (el) el.textContent = `剩余时间 ${fmtT(sec)}`; if (sec <= 0) { clearInterval(iv); close(0); } }, 1000); } });
    if (i === 1 && G.state === 'play') G.game.loadZone('dungeon', 'start', { duty: true, inst: m.inst, tk: m.tk });
    else UI.chat('你放弃了进入任务。空出的位置将由亲信战友补上。', 'system');
  },
};
