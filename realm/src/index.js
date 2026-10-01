// 联机房间服务器。同一个 Durable Object 类承担三种房间：
//  · 城镇（zone:town）：只转发玩家的位置、外观、动作、情感动作与聊天，可以休眠
//  · 野外（zone:field）与副本实例（duty:<uuid>）：在此基础上运行战斗模拟（js/sim/world.js），
//    魔物、伤害、FATE、头目机制都由服务器计算，每 100ms 把事件与状态增量推送给房间里的玩家
//  · 任务搜索器（queue）：按 1 防护 / 1 治疗 / 2 输出 匹配玩家，创建副本实例并发放入场凭证
// 玩家的连接信息保存在 WebSocket attachment 里，房间休眠后依然可以恢复。
import { DurableObject } from 'cloudflare:workers';
import { MAX_PLAYERS, MAX_MSG, ANIMS, EMOTE_IDS, SIM_ZONES, cleanText, cleanState, cleanLook, cleanCombat, cleanId } from '../../js/protocol.js';
import { World } from '../../js/sim/world.js';
import { JOBS } from '../../js/data.js';
import { PARTY_SLOTS, slotOf } from '../../js/sim/defs.js';
import { routeRealm } from './route.js';

const IDLE_MS = 45000, SWEEP_MS = 20000; // 超过 45 秒没有任何消息（含心跳）的连接视为已断开
const TICK_MS = 100;                     // 战斗模拟步长
const QUEUE_WAIT = 20;                   // 排队超过 20 秒未凑满 4 人时，由亲信战友补位出发
const DUTY_TTL = 3 * 3600 * 1000;        // 副本实例的数据保留 3 小时
const FIELD_IDLE = 90000;                // 野外 90 秒无人操作且没有战斗时暂停模拟，让房间可以休眠
const view = (me) => ({ id: me.id, name: me.name, app: me.app, job: me.job, lv: me.lv, body: me.body, x: me.x, y: me.y, z: me.z, r: me.r, sp: me.sp, m: me.m, a: me.a, d: me.d, e: me.e });
const skId = (v) => (typeof v === 'string' && v.length <= 24 ? v : '');

export class Realm extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = new Map();
    this.world = null; this.timer = null; this.last = 0; this.tickN = 0; this.sentLb = -1; this.activeAt = Date.now();
    this.qTimer = null;
  }

  // ---------- 连接 ----------
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') return this.initDuty(await request.json());
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) return new Response('Realm full', { status: 503 });
    const zone = url.searchParams.get('zone');
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), zone, joined: false, seen: Date.now() });
    await this.ensureSweep();
    return new Response(null, { status: 101, webSocket: client });
  }

  live(except) {
    return this.ctx.getWebSockets().filter((s) => {
      if (s === except) return false;
      const a = s.deserializeAttachment();
      return a && !a.left;
    });
  }
  joined(except) { return this.live(except).filter((s) => s.deserializeAttachment().joined); }

  broadcast(from, obj) {
    const s = JSON.stringify(obj);
    for (const o of this.joined(from)) { try { o.send(s); } catch { /* 对方已断开 */ } }
  }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* 已断开 */ } }

  // 每个连接每种消息在 ms 毫秒内最多 per 条
  allow(id, kind, per, ms) {
    const k = id + ':' + kind, now = Date.now();
    let r = this.rate.get(k);
    if (!r || now - r.t > ms) { r = { t: now, n: 0 }; this.rate.set(k, r); }
    return ++r.n <= per;
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const me = ws.deserializeAttachment();
    if (!me || me.left) return;
    me.seen = Date.now();
    if (me.zone === 'queue') { ws.serializeAttachment(me); return this.queueMessage(ws, me, m); }
    const sim = SIM_ZONES.includes(me.zone);
    if (sim && m.t !== 'p' && m.t !== 's') this.activeAt = Date.now();
    if (m.t === 'hello') {
      if (me.joined) return;
      Object.assign(me, cleanLook(m), cleanState(m), { joined: true });
      if (sim) {
        const c = cleanCombat(m);
        Object.assign(me, { wt: c.wt, ear: c.ear });
        if (me.zone === 'dungeon') {
          const meta = await this.ctx.storage.get('meta');
          const slot = meta && meta.roster.find((r) => r.token === c.tk);
          if (!slot) { this.send(ws, { t: 'gone' }); me.left = true; ws.serializeAttachment(me); try { ws.close(4004, 'no such duty'); } catch { /* 已关闭 */ } return; }
          me.tk = c.tk;
          // 同一个凭证重复连接（断线重连）时，把旧连接踢掉
          for (const o of this.joined(ws)) { const a = o.deserializeAttachment(); if (a.tk === me.tk) { this.leave(o); try { o.close(4001, 'replaced'); } catch { /* 已关闭 */ } } }
          this.roster = meta.roster;
        }
        ws.serializeAttachment(me);
        const W = this.ensureWorld(me.zone, ws);
        W.addPlayer(me.id, { name: me.name, job: me.job, lv: me.lv, wt: me.wt, ear: me.ear, body: me.body, hp: c.hp, mp: c.mp, tk: me.tk }, me);
        this.ensureTick();
        this.send(ws, { t: 'welcome', id: me.id, players: this.joined(ws).map((o) => view(o.deserializeAttachment())), sim: W.initInfo() });
      } else {
        ws.serializeAttachment(me);
        this.send(ws, { t: 'welcome', id: me.id, players: this.joined(ws).map((o) => view(o.deserializeAttachment())) });
      }
      this.broadcast(ws, { t: 'join', p: view(me) });
      return;
    }
    if (!me.joined) return;
    ws.serializeAttachment(me);
    const W = sim ? this.ensureWorld(me.zone) : null;
    if (W && !W.ents.has(me.id)) this.addMember(W, me);
    switch (m.t) {
      case 's': {
        if (!this.allow(me.id, 's', 20, 1000)) return;
        const st = cleanState(m);
        // 位置或姿态有变化才算「有人在玩」（客户端静止时每 5 秒也会发一次）
        if (W && (Math.abs(st.x - me.x) + Math.abs(st.z - me.z) > 0.05 || st.d !== me.d || st.m !== me.m)) this.activeAt = Date.now();
        Object.assign(me, st); ws.serializeAttachment(me);
        if (W) W.setState(me.id, st);
        this.broadcast(ws, { t: 's', id: me.id, ...st });
        break;
      }
      case 'look': {
        if (!this.allow(me.id, 'look', 3, 5000)) return;
        Object.assign(me, cleanLook(m));
        if (W) { const c = cleanCombat(m); me.wt = c.wt; me.ear = c.ear; W.setLook(me.id, me); }
        ws.serializeAttachment(me);
        this.broadcast(ws, { t: 'look', id: me.id, name: me.name, app: me.app, job: me.job, lv: me.lv, body: me.body });
        break;
      }
      case 'chat': {
        const text = cleanText(m.text, 80);
        if (!text || !this.allow(me.id, 'chat', 3, 4000)) return;
        this.broadcast(ws, { t: 'chat', id: me.id, name: me.name, text });
        break;
      }
      case 'act': {
        if (!ANIMS.includes(m.a) || !this.allow(me.id, 'act', 8, 1000)) return;
        this.broadcast(ws, { t: 'act', id: me.id, a: m.a });
        break;
      }
      case 'em': {
        if (!EMOTE_IDS.includes(m.em) || !this.allow(me.id, 'em', 3, 3000)) return;
        this.broadcast(ws, { t: 'em', id: me.id, em: m.em, tn: cleanText(m.tn, 16) });
        break;
      }
      // ---- 战斗意图（只在模拟房间里有效）----
      case 'tgt': if (W && this.allow(me.id, 'tgt', 10, 1000)) W.setTarget(me.id, cleanId(m.id)); break;
      case 'cast': if (W && this.allow(me.id, 'sk', 12, 1000)) W.intentCast(me.id, { sk: skId(m.sk), tg: cleanId(m.tg) }); break;
      case 'use': if (W && this.allow(me.id, 'sk', 12, 1000)) W.intentUse(me.id, { sk: skId(m.sk), tg: cleanId(m.tg) }); break;
      case 'int': if (W) W.intentInterrupt(me.id); break;
      case 'gen': if (W && ['potion', 'lb', 'rv'].includes(m.g) && this.allow(me.id, 'gen', 3, 1000)) W.intentGeneral(me.id, m.g); break;
      case 'chest': if (W && W.duty) W.openChest(me.id); break;
      case 'obj': if (W && W.duty && this.allow(me.id, 'obj', 4, 1000)) W.interactObj(me.id, cleanId(m.id)); break;
      case 'loot': if (W && W.duty && this.allow(me.id, 'loot', 6, 1000)) W.lootChoice(me.id, Number(m.i) | 0, m.c); break;
    }
    if (W && !this.timer && Date.now() - this.activeAt < 1000) this.ensureTick(); // 暂停后有人开始操作：恢复模拟
  }

  // ---------- 战斗模拟 ----------
  ensureWorld(zone, except) {
    if (this.world) return this.world;
    const W = this.world = zone === 'field' ? new World('field') : new World('dungeon', { roster: this.roster || [] });
    // 房间休眠后内存中的世界会丢失：重建时把仍在线的玩家加回来，并给他们发送新的完整状态
    const others = this.joined(except);
    for (const o of others) this.addMember(W, o.deserializeAttachment());
    if (others.length) { const sync = JSON.stringify({ t: 'sync', sim: W.initInfo() }); for (const o of others) { try { o.send(sync); } catch { /* 已断开 */ } } }
    return W;
  }
  addMember(W, a) { W.addPlayer(a.id, { name: a.name, job: a.job, lv: a.lv, wt: a.wt, ear: a.ear, body: a.body, tk: a.tk }, a); }
  ensureTick() {
    if (this.timer) return;
    this.last = Date.now();
    this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error('tick', e && e.stack || e); } }, TICK_MS);
  }
  stopTick() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  tick() {
    const W = this.world, socks = this.joined();
    if (!W || !socks.length) { this.stopTick(); return; }
    if (W.kind === 'field' && Date.now() - this.activeAt > FIELD_IDLE && !W.anyCombat() && !W.fate) { this.stopTick(); return; }
    const now = Date.now(), dt = Math.min(0.5, (now - this.last) / 1000); this.last = now;
    // 卡顿时拆成多个小步，避免一次跨太远导致预兆、咏唱结算错乱
    for (let left = dt; left > 1e-4; left -= 0.1) W.step(Math.min(0.1, left));
    this.tickN++;
    const ev = W.flush(), pub = [], priv = new Map();
    for (const e of ev) { if (e.to) { if (!priv.has(e.to)) priv.set(e.to, []); priv.get(e.to).push(e); } else pub.push(e); }
    // 位置与状态 5 次/秒；事件每次都发
    const snap = this.tickN % 2 === 0, ss = snap ? W.snapshot() : null, st = snap ? W.statusSnap() : null;
    const msg = { t: 'w', ev: pub };
    if (ss && ss.length) msg.ss = ss;
    if (st) msg.st = st;
    if (W.duty) {
      const lb = Math.round(W.lb); if (lb !== this.sentLb && (Math.abs(lb - this.sentLb) >= 5 || lb === 0 || lb >= W.lbMax)) { this.sentLb = lb; msg.lb = lb; }
      if (this.tickN % 10 === 0) msg.di = W.dutyInfo();
    }
    const empty = !pub.length && !msg.ss && !msg.st && msg.lb === undefined && !msg.di;
    const shared = empty ? null : JSON.stringify(msg);
    for (const ws of socks) {
      const id = ws.deserializeAttachment().id, mine = priv.get(id);
      try {
        if (mine) ws.send(JSON.stringify({ ...msg, ev: pub.concat(mine) }));
        else if (shared) ws.send(shared);
      } catch { /* 已断开 */ }
    }
  }

  // ---------- 副本实例 ----------
  async initDuty(body) {
    const roster = Array.isArray(body && body.roster) ? body.roster.slice(0, 4).map((r) => ({ token: String(r.token).slice(0, 40), role: JOBS[r.job] ? JOBS[r.job].role : 'tank', job: JOBS[r.job] ? r.job : 'gla', lv: Math.max(1, Math.min(15, Number(r.lv) | 0)), name: cleanText(r.name, 16) })) : [];
    if (!roster.length) return new Response('bad roster', { status: 400 });
    await this.ctx.storage.put('meta', { roster, created: Date.now() });
    this.roster = roster;
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    return new Response('ok');
  }

  // ---------- 任务搜索器 ----------
  queueMessage(ws, me, m) {
    if (m.t === 'p') return;
    if (m.t === 'q') {
      if (me.q || me.matched) return;
      const look = cleanLook(m);
      me.q = { name: look.name, job: look.job, lv: look.lv, role: JOBS[look.job].role, at: Date.now() };
      me.joined = true; ws.serializeAttachment(me);
      this.match(null);
      this.queueStatus();
      if (!this.qTimer) this.qTimer = setInterval(() => { try { this.match(null); this.queueStatus(); } catch (e) { console.error('queue', e && e.stack || e); } }, 1000);
    } else if (m.t === 'go') {
      if (!me.q) return;
      this.match(ws);
    } else if (m.t === 'cancel') {
      me.q = null; ws.serializeAttachment(me);
      this.queueStatus();
    }
  }
  queued() {
    return this.live().map((ws) => ({ ws, a: ws.deserializeAttachment() })).filter((x) => x.a.q && !x.a.matched).sort((x, y) => x.a.q.at - y.a.q.at);
  }
  // 从排队最久（或按下「立即出发」）的玩家开始，按职能空位贪心组队
  match(first) {
    for (;;) {
      const list = this.queued(); if (!list.length) { if (this.qTimer) { clearInterval(this.qTimer); this.qTimer = null; } return; }
      if (first) { const i = list.findIndex((x) => x.ws === first); if (i > 0) list.unshift(...list.splice(i, 1)); }
      const need = { ...PARTY_SLOTS }, party = [];
      for (const x of list) { const s = slotOf(x.a.q.role); if (need[s] > 0) { need[s]--; party.push(x); } if (party.length === 4) break; }
      const waited = (Date.now() - list[0].a.q.at) / 1000;
      if (party.length < 4 && !first && waited < QUEUE_WAIT) return;
      this.formParty(party);
      first = null;
    }
  }
  formParty(party) {
    const inst = crypto.randomUUID();
    const roster = party.map((x) => ({ token: crypto.randomUUID(), name: x.a.q.name, job: x.a.q.job, lv: x.a.q.lv }));
    for (const x of party) { x.a.matched = true; x.ws.serializeAttachment(x.a); }
    const members = party.map((x) => ({ name: x.a.q.name, job: x.a.q.job, lv: x.a.q.lv }));
    const stub = this.env.REALM.get(this.env.REALM.idFromName('duty:' + inst));
    // 先在副本实例里登记名单，再把入场凭证发给每位成员
    this.ctx.waitUntil(stub.fetch('https://realm/init', { method: 'POST', body: JSON.stringify({ roster }) }).then((r) => {
      if (!r.ok) throw new Error('init ' + r.status);
      party.forEach((x, i) => this.send(x.ws, { t: 'match', inst, tk: roster[i].token, party: members }));
    }).catch((e) => {
      console.error('formParty', e && e.stack || e);
      for (const x of party) { x.a.matched = false; x.a.q = null; x.ws.serializeAttachment(x.a); this.send(x.ws, { t: 'qerr' }); }
    }));
  }
  queueStatus() {
    const list = this.queued(), cnt = { tank: 0, healer: 0, dps: 0 };
    for (const x of list) cnt[slotOf(x.a.q.role)]++;
    const now = Date.now();
    for (const x of list) this.send(x.ws, { t: 'qs', n: list.length, w: Math.floor((now - x.a.q.at) / 1000), max: QUEUE_WAIT, c: cnt });
  }

  // ---------- 清理 ----------
  // 客户端掉线（休眠、断网、崩溃）时服务器收不到关闭帧，靠心跳超时把「幽灵玩家」移除
  async ensureSweep() {
    const at = await this.ctx.storage.getAlarm(), next = Date.now() + SWEEP_MS;
    if (at === null || at > next) await this.ctx.storage.setAlarm(next);
  }

  async alarm() {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || a.left || now - (a.seen || 0) < IDLE_MS) continue;
      this.leave(ws);
      try { ws.close(4000, 'idle timeout'); } catch { /* 已关闭 */ }
    }
    if (this.live().length) { await this.ctx.storage.setAlarm(now + SWEEP_MS); return; }
    // 没有人了：副本实例过期后删除登记数据
    const meta = await this.ctx.storage.get('meta');
    if (meta) {
      if (now - meta.created > DUTY_TTL) { this.world = null; await this.ctx.storage.deleteAll(); }
      else await this.ctx.storage.setAlarm(meta.created + DUTY_TTL + 1000);
    }
  }

  leave(ws) {
    const me = ws.deserializeAttachment();
    if (!me || me.left) return;
    me.left = true; ws.serializeAttachment(me);
    if (me.zone === 'queue') { this.queueStatus(); return; }
    if (this.world) this.world.removePlayer(me.id);
    if (me.joined) this.broadcast(ws, { t: 'leave', id: me.id });
    for (const k of this.rate.keys()) if (k.startsWith(me.id + ':')) this.rate.delete(k);
    if (!this.joined().length) this.stopTick();
  }

  async webSocketClose(ws, code) {
    this.leave(ws);
    try { ws.close(code >= 1000 && code < 1004 ? code : 1000, 'bye'); } catch { /* 已关闭 */ }
  }

  async webSocketError(ws) {
    this.leave(ws);
  }
}

export default {
  fetch: (request, env) => routeRealm(request, env.REALM) || new Response('Eorzea realm server', { headers: { 'content-type': 'text/plain; charset=utf-8' } }),
};
