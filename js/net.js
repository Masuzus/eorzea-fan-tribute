// 联机：连接所在地图的房间，同步其他玩家的外观、位置、坐骑、动作、情感动作与聊天。
// 野外与副本实例的房间还运行服务器战斗模拟，战斗消息交给 online.js 处理。
import { G, angDiff } from './engine.js';
import { Humanoid, buildModel, gearFor } from './character.js';
import { Entity } from './combat.js';
import { UI } from './ui.js';
import { JOBS, EMOTES } from './data.js';
import { Online } from './online.js';
import { NET_ZONES, MAX_MSG, ANIMS, LOOPS, cleanState, cleanLook, cleanText } from './protocol.js';

const TAU = Math.PI * 2;
const ANIM_DUR = { slash: 0.55, slash2: 0.55, heavy: 0.75, thrust: 0.55, spin: 0.6, shoot: 0.7, release: 0.55, heal: 0.6, buff: 0.6, punch: 0.55, wave: 2, bow: 1.8, cheer: 1.6, point: 1.5, lb: 1.1, jumpatk: 1.1, attune: 3.2, victory: 2.5, nod: 0.8 };
const MAX_VISIBLE = 24;

// 部署在 Cloudflare Pages 上时连接同域名的 /realm；可用 ?realm=ws://... 指定服务器（本地调试）
function endpoint() {
  try {
    const q = new URLSearchParams(location.search).get('realm');
    if (q) return q;
    if (!/^https?:$/.test(location.protocol) || /(^|\.)claude\.ai$|claudeusercontent\.com$|^localhost$|^127\.0\.0\.1$/.test(location.hostname)) return null;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/realm`;
  } catch { return null; }
}

export const Net = {
  url: endpoint(), ws: null, zone: null, id: null, status: 'off', fails: 0, everOpen: false, timer: null,
  remotes: new Map(), sendT: 0, lastSig: '', lastSend: 0, lookSig: '', lookT: 0, cullT: 0, actTimes: [],

  enter(zone, opts = {}) {
    this.close(); this.opened = false; this.zone = zone; this.inst = opts.inst || null; this.tk = opts.tk || '';
    if (!this.url) return this.setStatus('offline');
    if (!this.netZone()) return this.setStatus('solo');
    this.fails = 0; this.connect();
  },
  netZone() { return NET_ZONES.includes(this.zone) || (this.zone === 'dungeon' && !!this.inst); },
  leave() { this.zone = null; this.close(); this.setStatus('off'); },
  close() {
    clearTimeout(this.timer); this.timer = null; clearInterval(this.hb);
    const ws = this.ws; this.ws = null; this.id = null;
    if (ws) { ws.onopen = ws.onclose = ws.onmessage = ws.onerror = null; try { ws.close(1000); } catch { /* 已关闭 */ } }
    this.clearRemotes(); this.setStatus('off');
  },
  connect() {
    this.setStatus(this.everOpen ? 'reconnecting' : 'connecting');
    let ws;
    try { ws = new WebSocket(`${this.url}?zone=${this.zone}${this.inst ? '&inst=' + this.inst : ''}`); } catch { return this.retry(); }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return; this.everOpen = this.opened = true; this.fails = 0; ws.send(JSON.stringify({ t: 'hello', ...this.look(), ...this.localState(), hp: G.player.hp, mp: G.player.mp, tk: this.tk }));
      // 心跳用定时器发送：页面在后台时 requestAnimationFrame 会暂停，但定时器仍会运行
      clearInterval(this.hb); this.hb = setInterval(() => this.send({ t: 'p' }), 15000);
    };
    ws.onmessage = (ev) => { if (this.ws === ws) this.handle(ev.data); };
    ws.onclose = () => { if (this.ws !== ws) return; clearInterval(this.hb); this.ws = null; this.id = null; this.clearRemotes(); this.retry(); };
    ws.onerror = () => { };
  },
  retry() {
    if (!this.zone || !this.netZone()) return;
    this.fails++;
    if (!this.opened && this.fails >= 2) { this.setStatus('offline'); Online.fallback(); return; }
    this.setStatus('reconnecting');
    this.timer = setTimeout(() => { if (this.zone && !this.ws) this.connect(); }, Math.min(30, 2 ** this.fails) * 1000);
  },
  setStatus(s) { this.status = s; UI.netStatus(s, this.remotes.size + 1); },
  send(obj) { if (!this.ws || this.ws.readyState !== 1 || !this.id) return; const s = JSON.stringify(obj); if (s.length <= MAX_MSG) this.ws.send(s); },

  // ---------- 本地 → 服务器 ----------
  look() { const S = G.save; return { name: S.name, app: S.app, job: S.job, lv: S.level, body: S.gear.body || 'body1', wt: S.weaponTier || 0, ear: S.gear.ear ? 1 : 0 }; },
  localState() {
    const P = G.player, q = (v) => Math.round(v * 100) / 100;
    return { x: q(P.pos.x), y: q(P.pos.y), z: q(P.pos.z), r: q(((P.rot % TAU) + TAU) % TAU), sp: q(P.moveSpeed || 0), m: P.mounted ? 1 : 0, a: P.air ? 1 : 0, d: P.model.drawn ? 1 : 0, e: LOOPS.includes(P.model.loop) ? P.model.loop : '' };
  },
  act(name) {
    if (!this.id || !ANIMS.includes(name)) return;
    const now = performance.now(); this.actTimes = this.actTimes.filter((t) => now - t < 1000);
    if (this.actTimes.length >= 6) return;
    this.actTimes.push(now); this.send({ t: 'act', a: name });
  },
  chat(text) { this.send({ t: 'chat', text }); },
  emote(id, targetName) { this.send({ t: 'em', em: id, tn: targetName || '' }); },

  // ---------- 服务器 → 本地 ----------
  handle(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const r = m.id ? this.remotes.get(m.id) : null;
    switch (m.t) {
      case 'welcome': {
        this.id = m.id; this.clearRemotes();
        if (m.sim) Online.begin(m.sim);
        (Array.isArray(m.players) ? m.players : []).forEach((p) => this.addRemote(p, false));
        this.lastSig = ''; this.lookSig = JSON.stringify(this.look()); this.setStatus('online');
        const n = this.remotes.size;
        if (G.zone.dungeon) UI.chat(n ? `已与 ${n} 名冒险者组成小队，其余位置由亲信战友补上。` : '小队成员尚未到齐，空缺的位置将由亲信战友补上。', 'system');
        else UI.chat(`已连接到「${G.zone.name}」。${n ? `这里还有 ${n} 名其他冒险者。` : '目前只有你一个人，邀请朋友打开同一个网址就能互相看见。'}${G.online ? '魔物与 FATE 由服务器同步，可以与其他冒险者一起战斗。' : ''}`, 'system');
        break;
      }
      case 'w': Online.onWorld(m); break;
      case 'sync': if (m.sim) Online.begin(m.sim); break;
      case 'gone': this.zone = null; this.close(); Online.gone(); break;
      case 'join': if (m.p && m.p.id !== this.id) { this.addRemote(m.p, true); this.setStatus('online'); if (G.zone.dungeon) UI.chat(`${cleanText(m.p.name, 16)}加入了小队。`, 'system'); } break;
      case 'leave': this.removeRemote(m.id); this.setStatus('online'); break;
      case 's': if (r) this.applyState(r, cleanState(m)); break;
      case 'look': if (r) this.applyLook(r, cleanLook(m)); break;
      case 'chat': {
        const text = cleanText(m.text, 80); if (!text) break;
        UI.chat(`${r ? r.name : cleanText(m.name, 16)}：${text}`, 'say');
        if (r) r.bubble = { text, until: G.time + 6 };
        break;
      }
      case 'act': if (r && ANIMS.includes(m.a) && !r.choco) r.model.play(m.a, ANIM_DUR[m.a] || 0.6); break;
      case 'em': {
        const em = EMOTES.find((e) => e.id === m.em); if (!r || !em) break;
        const tn = cleanText(m.tn, 16);
        UI.chat(((tn && em.textT) || em.text).replace('{a}', r.name).replace('{b}', tn), 'emote');
        break;
      }
    }
  },
  addRemote(p, announce) {
    if (!p || typeof p.id !== 'string') return;
    if (this.remotes.has(p.id)) this.removeRemote(p.id);
    const look = cleanLook(p), st = cleanState(p);
    const model = new Humanoid(look.app, gearFor(look.job, look.body), { faceRes: 256 });
    const e = new Entity({ name: look.name, title: `${JOBS[look.job].name} Lv${look.lv}`, kind: 'remote', faction: 'remote', model, x: st.x, y: st.y, z: st.z, rot: st.r, height: model.height, radius: 0.45, level: look.lv, netId: p.id });
    e.hp = e.maxHp = 1; e.look = look;
    G.game.addEntity(e); this.remotes.set(p.id, e);
    Online.onRemoteAdded(e);
    this.applyState(e, st);
    if (announce) UI.chat(`${look.name}来到了这里。`, 'system');
  },
  removeRemote(id) {
    const e = this.remotes.get(id); if (!e) return;
    this.remotes.delete(id);
    if (e.choco) { G.scene.remove(e.choco.root); e.choco.dispose(); e.choco = null; }
    G.game.removeEntity(e);
  },
  clearRemotes() { for (const id of [...this.remotes.keys()]) this.removeRemote(id); },
  applyLook(e, look) {
    const same = JSON.stringify(look.app) === JSON.stringify(e.look.app) && look.job === e.look.job && look.body === e.look.body;
    e.look = look; e.name = look.name; e.level = look.lv; e.title = `${JOBS[look.job].name} Lv${look.lv}`; e.job = look.job; if (e.faction === 'party') e.role = JOBS[look.job].role;
    if (!same) { const d = e.model.drawn; e.model.build(look.app, gearFor(look.job, look.body)); e.model.setDrawn(d, true); e.height = e.model.height; }
  },
  applyState(e, st) {
    e.net = st; e.lastNet = G.time;
    if (st.m && !e.choco) this.mountRemote(e); else if (!st.m && e.choco) this.dismountRemote(e);
    if (!e.choco) { e.model.setDrawn(!!st.d); e.model.setLoop(st.e || null); }
  },
  mountRemote(e) {
    const c = buildModel('chocobo'); e.choco = c;
    e.model.mounted = true; e.model.setLoop(null); e.model.setDrawn(false);
    G.scene.remove(e.model.root); c.seat.add(e.model.root); e.model.root.position.set(0, 0, 0); e.model.root.rotation.set(0, 0, 0);
    e.visual = c.root; G.scene.add(c.root);
  },
  dismountRemote(e) {
    const c = e.choco; c.seat.remove(e.model.root); G.scene.remove(c.root); c.dispose(); e.choco = null;
    e.model.mounted = false; e.visual = e.model.root; G.scene.add(e.model.root);
  },

  // ---------- 每帧 ----------
  update(dt) {
    if (!this.zone) return;
    const P = G.player;
    for (const e of this.remotes.values()) {
      const n = e.net, dx = n.x - e.pos.x, dy = n.y - e.pos.y, dz = n.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > 12) e.pos.set(n.x, n.y, n.z);
      else { const k = 1 - Math.exp(-dt * 12); e.pos.x += dx * k; e.pos.y += dy * k; e.pos.z += dz * k; }
      e.rot += angDiff(e.rot, n.r) * Math.min(1, dt * 12);
      e.moveSpeed = n.sp > 0.1 && G.time - e.lastNet < 0.8 ? n.sp : d > 0.3 ? Math.min(6, d * 8) : 0;
      e.air = !!n.a;
      if (e.choco) e.choco.update(dt, { speed: e.moveSpeed });
    }
    this.cullT -= dt;
    if (this.cullT <= 0 && P) {
      this.cullT = 1;
      [...this.remotes.values()].sort((a, b) => a.dist(P) - b.dist(P)).forEach((e, i) => { e.hidden = i >= MAX_VISIBLE; if (e.hidden) e.visual.visible = false; });
    }
    if (!this.id || !P) return;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.15;
      const st = this.localState(), sig = JSON.stringify(st);
      if (sig !== this.lastSig || G.time - this.lastSend > 5) { this.lastSig = sig; this.lastSend = G.time; this.send({ t: 's', ...st }); }
    }
    this.lookT -= dt;
    if (this.lookT <= 0) { this.lookT = 2; const lk = this.look(), sig = JSON.stringify(lk); if (sig !== this.lookSig) { this.lookSig = sig; this.send({ t: 'look', ...lk }); } }
  },
};

addEventListener('beforeunload', () => Net.close());
