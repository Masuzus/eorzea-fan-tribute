// 联机房间服务器：每张地图一个 Durable Object，转发玩家的位置、外观、动作、情感动作与聊天。
// 使用 WebSocket Hibernation API：没有消息时房间可以休眠，玩家数据保存在每个连接的 attachment 里。
import { DurableObject } from 'cloudflare:workers';
import { MAX_PLAYERS, MAX_MSG, ANIMS, EMOTE_IDS, cleanText, cleanState, cleanLook } from '../../js/protocol.js';
import { routeRealm } from './route.js';

const IDLE_MS = 45000, SWEEP_MS = 20000; // 超过 45 秒没有任何消息（含心跳）的连接视为已断开
const view = (me) => ({ id: me.id, name: me.name, app: me.app, job: me.job, lv: me.lv, body: me.body, x: me.x, y: me.y, z: me.z, r: me.r, sp: me.sp, m: me.m, a: me.a, d: me.d, e: me.e });

export class Realm extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = new Map();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) return new Response('Realm full', { status: 503 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), joined: false, seen: Date.now() });
    await this.ensureSweep();
    return new Response(null, { status: 101, webSocket: client });
  }

  joined(except) {
    return this.ctx.getWebSockets().filter((s) => {
      if (s === except) return false;
      const a = s.deserializeAttachment();
      return a && a.joined && !a.left;
    });
  }

  broadcast(from, obj) {
    const s = JSON.stringify(obj);
    for (const o of this.joined(from)) { try { o.send(s); } catch { /* 对方已断开 */ } }
  }

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
    if (m.t === 'hello') {
      if (me.joined) return;
      Object.assign(me, cleanLook(m), cleanState(m), { joined: true });
      ws.serializeAttachment(me);
      ws.send(JSON.stringify({ t: 'welcome', id: me.id, players: this.joined(ws).map((o) => view(o.deserializeAttachment())) }));
      this.broadcast(ws, { t: 'join', p: view(me) });
      return;
    }
    if (!me.joined) return;
    ws.serializeAttachment(me);
    switch (m.t) {
      case 's': {
        if (!this.allow(me.id, 's', 20, 1000)) return;
        const st = cleanState(m);
        Object.assign(me, st); ws.serializeAttachment(me);
        this.broadcast(ws, { t: 's', id: me.id, ...st });
        break;
      }
      case 'look': {
        if (!this.allow(me.id, 'look', 3, 5000)) return;
        Object.assign(me, cleanLook(m)); ws.serializeAttachment(me);
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
    }
  }

  // 定时清理：客户端掉线（休眠、断网、崩溃）时服务器收不到关闭帧，靠心跳超时把「幽灵玩家」移除
  async ensureSweep() {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
  }

  async alarm() {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || a.left || now - (a.seen || 0) < IDLE_MS) continue;
      this.leave(ws);
      try { ws.close(4000, 'idle timeout'); } catch { /* 已关闭 */ }
    }
    if (this.ctx.getWebSockets().some((ws) => { const a = ws.deserializeAttachment(); return a && !a.left; })) await this.ctx.storage.setAlarm(now + SWEEP_MS);
  }

  leave(ws) {
    const me = ws.deserializeAttachment();
    if (!me || me.left) return;
    me.left = true; ws.serializeAttachment(me);
    if (me.joined) this.broadcast(ws, { t: 'leave', id: me.id });
    for (const k of this.rate.keys()) if (k.startsWith(me.id + ':')) this.rate.delete(k);
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
