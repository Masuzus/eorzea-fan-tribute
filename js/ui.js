// 界面系统：图标、HUD、热键栏、队伍列表、目标栏、窗口、对话、小地图、名牌、飞字、角色创建面板
import { G, canvas, clamp } from './engine.js';
import { Audio } from './audio.js';
import { JOBS, GENERAL, EMOTES, RACES, SKINS, HAIR_COLORS, EYE_COLORS, PAINT_COLORS, SCALE_COLORS, DEITIES, MONTHS, QUESTS, ITEMS, NPCS, expToNext, MAX_LEVEL } from './data.js';
import { Combat } from './combat.js';
import { fieldH, dRoad } from './zones.js';
import { Online } from './online.js';

const $ = (id) => document.getElementById(id);
const PI = Math.PI;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 图标 ----------
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const L = (c, pts, w) => { c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
const F = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
const GLYPH = {
  sword: (c) => { F(c, [[49, 11], [53, 15], [27, 41], [23, 37]]); L(c, [[17, 34], [30, 47]], 5); L(c, [[24, 40], [14, 50]], 5); c.beginPath(); c.arc(13, 51, 3.5, 0, 7); c.fill(); },
  swords: (c) => { GLYPH.sword(c); c.save(); c.translate(64, 0); c.scale(-1, 1); c.globalAlpha = 0.8; GLYPH.sword(c); c.restore(); },
  shield: (c) => { c.beginPath(); c.moveTo(32, 9); c.lineTo(51, 16); c.quadraticCurveTo(51, 42, 32, 55); c.quadraticCurveTo(13, 42, 13, 16); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; L(c, [[32, 16], [32, 48]], 3); L(c, [[20, 28], [44, 28]], 3); },
  axe: (c) => { L(c, [[20, 53], [42, 13]], 5); c.beginPath(); c.moveTo(37, 15); c.quadraticCurveTo(58, 16, 55, 38); c.lineTo(40, 27); c.closePath(); c.fill(); },
  spear: (c) => { L(c, [[12, 52], [44, 20]], 4); F(c, [[55, 9], [39, 19], [45, 25]]); },
  bow: (c) => { c.lineWidth = 4; c.beginPath(); c.arc(22, 32, 22, -1.15, 1.15); c.stroke(); c.lineWidth = 1.5; L(c, [[31, 12], [31, 52]], 1.5); L(c, [[18, 32], [52, 32]], 3); F(c, [[56, 32], [48, 27], [48, 37]]); },
  arrow: (c) => { L(c, [[14, 50], [45, 19]], 4); F(c, [[52, 12], [40, 18], [46, 24]]); L(c, [[14, 50], [10, 44]], 3); L(c, [[14, 50], [20, 54]], 3); },
  arrows: (c) => { for (const o of [-9, 0, 9]) { c.save(); c.translate(o, -o); L(c, [[16, 48], [44, 20]], 3); F(c, [[50, 14], [40, 19], [45, 24]]); c.restore(); } },
  fire: (c) => { c.beginPath(); c.moveTo(32, 7); c.bezierCurveTo(46, 22, 52, 32, 46, 44); c.bezierCurveTo(42, 54, 35, 57, 32, 57); c.bezierCurveTo(22, 57, 15, 50, 17, 40); c.bezierCurveTo(19, 31, 26, 29, 26, 20); c.bezierCurveTo(31, 27, 33, 29, 35, 25); c.bezierCurveTo(37, 19, 35, 13, 32, 7); c.fill(); c.fillStyle = 'rgba(255,200,120,.8)'; c.beginPath(); c.ellipse(32, 45, 7, 9, 0, 0, 7); c.fill(); },
  ice: (c) => { for (let i = 0; i < 3; i++) { c.save(); c.translate(32, 32); c.rotate(i * PI / 3); L(c, [[0, -22], [0, 22]], 4); for (const s of [-1, 1]) { L(c, [[0, s * 13], [-6, s * 19]], 3); L(c, [[0, s * 13], [6, s * 19]], 3); } c.restore(); } },
  bolt: (c) => F(c, [[37, 6], [17, 36], [30, 36], [24, 58], [47, 25], [34, 25], [41, 6]]),
  cross: (c) => { rr(c, 26, 11, 12, 42, 3); c.fill(); rr(c, 11, 26, 42, 12, 3); c.fill(); },
  crosses: (c) => { for (const [x, y, s] of [[22, 22, 1], [42, 26, 0.8], [30, 44, 0.9]]) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -4, -12, 8, 24, 2); c.fill(); rr(c, -12, -4, 24, 8, 2); c.fill(); c.restore(); } },
  wind: (c) => { c.lineWidth = 4; for (const [y, r] of [[22, 12], [34, 16], [46, 10]]) { c.beginPath(); c.moveTo(10, y); c.lineTo(38, y); c.arc(38, y - r * 0.5, r * 0.5, PI / 2, -PI * 0.7, true); c.stroke(); } },
  rock: (c) => F(c, [[18, 44], [14, 30], [24, 16], [40, 14], [52, 26], [50, 44], [36, 52]]),
  star: (c) => { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 22, a = (i / 10) * PI * 2 - PI / 2; c.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r); } c.closePath(); c.fill(); },
  burst: (c) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; L(c, [[32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12], [32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24]], 4); } c.beginPath(); c.arc(32, 32, 8, 0, 7); c.fill(); },
  heart: (c) => { c.beginPath(); c.moveTo(32, 52); c.bezierCurveTo(8, 36, 12, 12, 32, 22); c.bezierCurveTo(52, 12, 56, 36, 32, 52); c.fill(); },
  eye: (c) => { c.beginPath(); c.moveTo(8, 32); c.quadraticCurveTo(32, 10, 56, 32); c.quadraticCurveTo(32, 54, 8, 32); c.fill(); c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.arc(32, 32, 8, 0, 7); c.fill(); },
  wing: (c) => { for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(28 + i * 5, 24 + i * 6, 18 - i * 2, 5, -0.5, 0, 7); c.fill(); } },
  drop: (c) => { c.beginPath(); c.moveTo(32, 8); c.bezierCurveTo(44, 26, 48, 34, 46, 42); c.bezierCurveTo(44, 52, 36, 56, 32, 56); c.bezierCurveTo(28, 56, 20, 52, 18, 42); c.bezierCurveTo(16, 34, 20, 26, 32, 8); c.fill(); },
  swirl: (c) => { c.lineWidth = 5; c.beginPath(); c.arc(32, 32, 16, PI * 0.1, PI * 0.9); c.stroke(); F(c, [[14, 38], [10, 28], [20, 30]]); c.beginPath(); c.arc(32, 32, 16, PI * 1.1, PI * 1.9); c.stroke(); F(c, [[50, 26], [54, 36], [44, 34]]); },
  skull: (c) => { c.beginPath(); c.arc(32, 28, 16, 0, 7); c.fill(); rr(c, 24, 38, 16, 12, 3); c.fill(); c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(26, 28, 4.5, 0, 7); c.arc(38, 28, 4.5, 0, 7); c.fill(); },
  boot: (c) => F(c, [[20, 10], [34, 10], [34, 38], [52, 42], [54, 52], [16, 52], [20, 38]]),
  chocobo: (c) => { c.beginPath(); c.arc(30, 32, 15, 0, 7); c.fill(); F(c, [[42, 28], [58, 34], [42, 38]]); F(c, [[22, 18], [18, 4], [28, 16]]); F(c, [[28, 17], [30, 2], [34, 17]]); c.fillStyle = 'rgba(0,0,0,.7)'; c.beginPath(); c.arc(35, 28, 2.5, 0, 7); c.fill(); },
  potion: (c) => { rr(c, 26, 8, 12, 10, 2); c.fill(); c.beginPath(); c.moveTo(26, 18); c.lineTo(38, 18); c.lineTo(50, 44); c.quadraticCurveTo(52, 54, 42, 54); c.lineTo(22, 54); c.quadraticCurveTo(12, 54, 14, 44); c.closePath(); c.fill(); },
  home: (c) => { F(c, [[32, 10], [54, 30], [48, 30], [48, 52], [16, 52], [16, 30], [10, 30]]); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(28, 38, 8, 14); },
  lb: (c) => { F(c, [[32, 6], [52, 32], [32, 58], [12, 32]]); c.fillStyle = 'rgba(0,0,0,.35)'; F(c, [[32, 16], [44, 32], [32, 48], [20, 32]]); },
  bang: (c) => { rr(c, 27, 8, 10, 32, 4); c.fill(); c.beginPath(); c.arc(32, 50, 6, 0, 7); c.fill(); },
  leaf: (c) => { c.beginPath(); c.moveTo(12, 52); c.quadraticCurveTo(10, 14, 52, 10); c.quadraticCurveTo(52, 50, 12, 52); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; L(c, [[14, 50], [44, 18]], 2); },
  box: (c) => { F(c, [[12, 22], [32, 12], [52, 22], [52, 46], [32, 56], [12, 46]]); c.strokeStyle = 'rgba(0,0,0,.35)'; L(c, [[12, 22], [32, 32], [52, 22]], 2); L(c, [[32, 32], [32, 56]], 2); },
  shirt: (c) => F(c, [[22, 10], [42, 10], [56, 22], [48, 30], [44, 26], [44, 54], [20, 54], [20, 26], [16, 30], [8, 22]]),
  tooth: (c) => { c.beginPath(); c.moveTo(18, 14); c.quadraticCurveTo(32, 6, 46, 14); c.quadraticCurveTo(48, 30, 36, 56); c.lineTo(32, 40); c.lineTo(28, 56); c.quadraticCurveTo(16, 30, 18, 14); c.fill(); },
  shell: (c) => { c.beginPath(); c.moveTo(32, 54); for (let i = 0; i <= 6; i++) { const a = PI + (i / 6) * PI; c.lineTo(32 + Math.cos(a) * 24, 40 + Math.sin(a) * 26); } c.closePath(); c.fill(); },
  fist: (c) => { rr(c, 16, 20, 30, 26, 8); c.fill(); rr(c, 40, 26, 10, 14, 4); c.fill(); },
};
const ICONS = new Map();
export function icon(spec, size = 64) {
  if (!spec) spec = ['star', '#666', '#222'];
  const key = spec.join('|') + size; if (ICONS.has(key)) return ICONS.get(key);
  const cv = canvas(size, size), c = cv.getContext('2d'); c.scale(size / 64, size / 64);
  const g = c.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, spec[1]); g.addColorStop(1, spec[2]);
  rr(c, 1, 1, 62, 62, 10); c.fillStyle = g; c.fill();
  const g2 = c.createRadialGradient(18, 12, 2, 18, 12, 52); g2.addColorStop(0, 'rgba(255,255,255,.45)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.fill();
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; rr(c, 3.5, 3.5, 57, 57, 8); c.stroke();
  c.save(); c.shadowColor = 'rgba(0,0,0,.65)'; c.shadowBlur = 4; c.shadowOffsetY = 1.5; c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineJoin = 'round';
  (GLYPH[spec[0]] || GLYPH.star)(c); c.restore();
  const url = cv.toDataURL(); ICONS.set(key, url); return url;
}
export function qIcon(type) {
  const key = 'q|' + type; if (ICONS.has(key)) return ICONS.get(key);
  const cv = canvas(64, 64), c = cv.getContext('2d'); const msq = type.startsWith('msq');
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 4;
  if (type === 'aeth') { const g = c.createLinearGradient(20, 6, 44, 58); g.addColorStop(0, '#e8fbff'); g.addColorStop(1, '#2a8aff'); c.fillStyle = g; F(c, [[32, 4], [46, 32], [32, 60], [18, 32]]); }
  else if (type === 'fate') { c.fillStyle = '#ff9a3a'; c.beginPath(); c.arc(32, 32, 22, 0, 7); c.fill(); c.fillStyle = '#fff'; GLYPH.star(c); }
  else if (type === 'duty') { c.fillStyle = '#3a7ab8'; c.beginPath(); c.arc(32, 32, 22, 0, 7); c.fill(); c.fillStyle = '#fff'; c.save(); c.translate(8, 8); c.scale(0.75, 0.75); GLYPH.swords(c); c.restore(); }
  else if (type === 'gather') { c.fillStyle = '#5ad06a'; c.beginPath(); c.arc(32, 32, 16, 0, 7); c.fill(); c.fillStyle = '#fff'; c.save(); c.translate(12, 12); c.scale(0.62, 0.62); GLYPH.leaf(c); c.restore(); }
  else {
    const col = msq ? ['#fff0b0', '#ff9a2a', '#b84a0a'] : ['#fff8c0', '#ffd23a', '#b8860a'];
    const g = c.createLinearGradient(0, 6, 0, 58); g.addColorStop(0, col[0]); g.addColorStop(0.5, col[1]); g.addColorStop(1, col[2]); c.fillStyle = g;
    if (msq) { c.beginPath(); c.moveTo(32, 4); c.bezierCurveTo(48, 18, 54, 34, 46, 48); c.bezierCurveTo(40, 58, 24, 58, 18, 48); c.bezierCurveTo(10, 34, 16, 18, 32, 4); c.fill(); }
    else { rr(c, 14, 6, 36, 52, 10); c.fill(); }
    c.shadowBlur = 0; c.strokeStyle = 'rgba(60,30,0,.8)'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(80,40,0,.9)'; c.lineWidth = 2;
    if (type.endsWith('-t')) { for (const x of [23, 32, 41]) { c.beginPath(); c.arc(x, 36, 4, 0, 7); c.fill(); c.stroke(); } }
    else { rr(c, 27.5, 14, 9, 24, 3); c.fill(); c.stroke(); c.beginPath(); c.arc(32, 46, 5, 0, 7); c.fill(); c.stroke(); }
  }
  const url = cv.toDataURL(); ICONS.set(key, url); return url;
}
export function jobIcon(job, size = 64) { return icon(JOBS[job] ? JOBS[job].icon : ['star', '#888', '#222'], size); }
const ROLE_ICON = { tank: ['shield', '#4f86c8', '#1a3456'], healer: ['cross', '#5ab86a', '#143a1a'], melee: ['sword', '#c8503a', '#4a1410'], caster: ['fire', '#a05ac8', '#2a0a3a'], ranged: ['bow', '#8ab04a', '#243a10'] };
export function roleIcon(role) { return icon(ROLE_ICON[role] || ROLE_ICON.melee, 48); }

// =====================================================================
export const UI = {
  init() {
    this.chatTab = 'all'; this.lines = []; this.win = {}; this.np = new Map(); this.bannerQ = []; this.bannerBusy = false;
    document.querySelectorAll('#chat .ctabs .tab').forEach((t) => (t.onclick = () => { this.chatTab = t.dataset.ch; document.querySelectorAll('#chat .ctabs .tab').forEach((x) => x.classList.toggle('on', x === t)); this.renderChat(); }));
    document.querySelectorAll('#menubar button').forEach((b) => (b.onclick = () => { Audio.sfxPlay('click'); this.toggle(b.dataset.w); }));
    $('chat-input').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const v = e.target.value.trim(); e.target.value = ''; e.target.blur(); if (v) G.game.chatCommand(v); } if (e.key === 'Escape') e.target.blur(); });
    $('dialog').onclick = () => this.dialogAdvance && this.dialogAdvance();
    this.tip = $('tooltip');
    this.initFullscreen();
    const scale = () => { this.uiScale = clamp(Math.min(innerWidth / 1600, innerHeight / 900), 0.55, 1.15); document.documentElement.style.setProperty('--ui', this.uiScale.toFixed(3)); this.layoutRight(); };
    addEventListener('resize', scale); scale();
  },
  // ---------- 全屏（Fullscreen API：隐藏浏览器的标签栏、地址栏等全部界面） ----------
  fsSupported() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); },
  fsActive() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  async toggleFullscreen() {
    if (!this.fsSupported()) { this.error('当前浏览器不支持网页全屏'); return; }
    try {
      if (this.fsActive()) { if (document.exitFullscreen) await document.exitFullscreen(); else document.webkitExitFullscreen(); }
      else { const el = document.documentElement; if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); else el.webkitRequestFullscreen(); }
    } catch (e) { this.error('当前环境无法切换全屏'); }
  },
  initFullscreen() {
    const ok = this.fsSupported();
    $('btn-fs').hidden = !ok; $('btn-fullscreen').hidden = !ok;
    $('btn-fs').onclick = () => { Audio.sfxPlay('click'); this.toggleFullscreen(); };
    $('btn-fullscreen').onclick = () => { Audio.init(); Audio.sfxPlay('click'); this.toggleFullscreen(); };
    const sync = () => {
      const on = this.fsActive();
      $('btn-fs').classList.toggle('on', on); $('btn-fs').title = on ? '退出全屏 (Alt+Enter)' : '全屏 (Alt+Enter)'; $('btn-fs').setAttribute('aria-label', on ? '退出全屏' : '全屏');
      $('btn-fullscreen').textContent = on ? '全屏：开' : '全屏：关';
      const cb = document.getElementById('set-fs'); if (cb) cb.checked = on;
      // 全屏时锁定 Esc：Esc 继续用于关闭窗口、取消目标；Chrome / Edge 中长按 Esc 退出全屏
      const kb = navigator.keyboard;
      if (on && kb && kb.lock) kb.lock(['Escape']).then(() => this.chat('已进入全屏模式。长按 Esc 或按 Alt+Enter 退出。', 'system'), () => this.chat('已进入全屏模式。按 Esc 或 Alt+Enter 退出。', 'system'));
      else if (on) this.chat('已进入全屏模式。按 Esc 或 Alt+Enter 退出。', 'system');
      else if (kb && kb.unlock) kb.unlock();
    };
    document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  },
  layoutRight() {
    const s = this.uiScale || 1, box = $('tracker'), d = $('duty'), f = $('fate'); if (!box) return;
    let y = (292 + box.offsetHeight + 6) * s; d.style.top = y + 'px'; if (!d.hidden) y += (d.offsetHeight + 6) * s; f.style.top = y + 'px';
  },
  // ---------- 聊天 ----------
  chat(text, cls = 'system') {
    const d = new Date(); const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.lines.push({ text, cls, ts }); if (this.lines.length > 160) this.lines.shift();
    if (this.show(cls)) { const log = $('chat-log'); const p = document.createElement('p'); p.className = cls; p.innerHTML = `<span class="ts">[${ts}]</span>${esc(text)}`; log.appendChild(p); while (log.children.length > 160) log.removeChild(log.firstChild); log.scrollTop = log.scrollHeight; }
  },
  show(cls) { if (this.chatTab === 'all') return cls !== 'battle' && cls !== 'help'; if (this.chatTab === 'battle') return cls.startsWith('battle'); return cls === 'help'; },
  renderChat() {
    const log = $('chat-log'); log.innerHTML = '';
    if (this.chatTab === 'help') { ['【移动】WASD / 方向键，Space 跳跃，R 冲刺。', '【视角】按住鼠标左键或右键拖动旋转，滚轮缩放。', '【目标】鼠标点击，或 Tab 依次选择敌人，Esc 取消。', '【技能】数字键 1~0、-、= 使用热键栏第一行；Shift+1~5 使用第二行。', '【交互】F 与 NPC 交谈、调查物体。', '【窗口】C 角色 · I 物品 · J 任务 · M 地图 · U 任务搜索器 · E 情感动作 · V 坐骑', '【聊天】Enter 输入，/wave /bow /dance /cheer /sit 使用情感动作。', '【全屏】Alt+Enter 或右下角按钮切换全屏（Mac 为 Option+Enter）。'].forEach((t) => { const p = document.createElement('p'); p.className = 'system'; p.textContent = t; log.appendChild(p); }); return; }
    for (const l of this.lines) if (this.show(l.cls)) { const p = document.createElement('p'); p.className = l.cls; p.innerHTML = `<span class="ts">[${l.ts}]</span>${esc(l.text)}`; log.appendChild(p); }
    log.scrollTop = log.scrollHeight;
  },
  error(text, kind) {
    const e = $('err'); e.textContent = text; e.className = 'anchor show' + (kind ? ' ' + kind : ''); clearTimeout(this.errT); this.errT = setTimeout(() => e.classList.remove('show'), kind ? 2600 : 1400);
    if (!kind) Audio.sfxPlay('error', 0.5);
  },
  banner(kind, title, sub) {
    this.bannerQ.push([kind, title, sub]); if (!this.bannerBusy) this.nextBanner();
  },
  nextBanner() {
    const b = this.bannerQ.shift(); if (!b) { this.bannerBusy = false; return; }
    this.bannerBusy = true; const [kind, title, sub] = b; const host = $('banner');
    const el = document.createElement('div'); el.className = 'bn ' + kind; el.innerHTML = `<div class="bt">${esc(title)}</div>${sub ? `<div class="bs">${esc(sub)}</div>` : ''}`;
    host.innerHTML = ''; host.appendChild(el);
    setTimeout(() => { el.remove(); this.nextBanner(); }, kind === 'levelup' || kind === 'lb' ? 2400 : 3000);
  },
  zoneTitle(name, sub, en) { const h = $('zonetitle'); h.innerHTML = `<div class="zt"><div class="zb">${esc(name)}</div><div class="zl"></div>${sub ? `<div class="zs">${esc(sub)}</div>` : ''}<div class="ze">${esc(en || '')}</div></div>`; clearTimeout(this.ztT); this.ztT = setTimeout(() => (h.innerHTML = ''), 5200); },
  fade(on, white = false, ms = 600) { const f = $('fade'); f.style.transition = `opacity ${ms}ms`; f.classList.toggle('white', white); f.style.opacity = on ? 1 : 0; return new Promise((r) => setTimeout(r, ms)); },
  letterbox(on) { $('letterbox').classList.toggle('on', on); },
  csText(text) { const el = $('cstext'); if (!text) { el.classList.remove('on'); return; } el.textContent = text; el.classList.add('on'); },
  loading(show, zone, tip) { $('loading').hidden = !show; if (show) { $('ld-zone').textContent = zone.name; $('ld-en').textContent = zone.en || ''; $('ld-tip').textContent = tip || ''; } },
  // ---------- 对话 ----------
  async dialog(lines, o = {}) {
    G.dialogOpen = true; const d = $('dialog'); d.hidden = false; $('d-choices').innerHTML = '';
    for (const [name, text] of lines) {
      if (o.cs && G.csSkip) continue;
      $('d-name').textContent = name; $('d-name').hidden = !name; $('d-arrow').hidden = true;
      const full = G.game.fmt(text); const el = $('d-text'); el.textContent = '';
      if (o.speaker) o.speaker(name);
      await new Promise((res) => {
        let i = 0, done = false; const step = () => { if (done) return; i += 2; el.textContent = full.slice(0, i); if (i >= full.length) { done = true; $('d-arrow').hidden = false; } else this.typeT = setTimeout(step, 18); };
        step(); Audio.sfxPlay('hover', 0.4);
        this.dialogAdvance = () => { if (!done) { done = true; clearTimeout(this.typeT); el.textContent = full; $('d-arrow').hidden = false; } else { this.dialogAdvance = null; res(); } };
      });
    }
    if (!o.keep) { d.hidden = true; G.dialogOpen = false; }
  },
  choice(name, text, options) {
    G.dialogOpen = true; const d = $('dialog'); d.hidden = false; $('d-name').textContent = name; $('d-text').textContent = G.game.fmt(text); $('d-arrow').hidden = true;
    const box = $('d-choices'); box.innerHTML = '';
    return new Promise((res) => {
      this.dialogAdvance = null;
      options.forEach((o, i) => { const b = document.createElement('button'); b.textContent = o; b.onclick = (e) => { e.stopPropagation(); Audio.sfxPlay('confirm'); box.innerHTML = ''; d.hidden = true; G.dialogOpen = false; res(i); }; box.appendChild(b); });
    });
  },
  // ---------- 窗口 ----------
  openWin(id, title, body, foot, o = {}) {
    this.closeWin(id);
    const w = document.createElement('div'); w.className = 'win panel center ' + (o.cls || ''); w.style.width = o.width || ''; w.dataset.id = id;
    w.innerHTML = `<div class="wh"><h3>${esc(title)}</h3>${o.noClose ? '' : '<button class="wx" aria-label="关闭">×</button>'}</div><div class="wb scroll">${body}</div>${foot ? `<div class="wf">${foot}</div>` : ''}`;
    $('windows').appendChild(w); this.win[id] = w;
    const x = w.querySelector('.wx'); if (x) x.onclick = () => { Audio.sfxPlay('close'); this.closeWin(id); };
    if (!o.silent) Audio.sfxPlay('open');
    return w;
  },
  closeWin(id) { const w = this.win[id]; if (w) { w.remove(); delete this.win[id]; if (this.onClose && this.onClose[id]) { const f = this.onClose[id]; delete this.onClose[id]; f(); } } },
  anyWin() { return Object.keys(this.win).length > 0; },
  closeTop() { const ids = Object.keys(this.win); if (!ids.length) return false; const id = ids[ids.length - 1]; if (this.win[id].dataset.modal) return true; this.closeWin(id); Audio.sfxPlay('close'); return true; },
  toggle(kind) { if (this.win[kind]) { this.closeWin(kind); return; } ({ char: () => this.winChar(), inv: () => this.winInv(), journal: () => this.winJournal(), map: () => this.winMap(), duty: () => this.winDuty(), emote: () => this.winEmote(), system: () => this.winSystem(), help: () => this.winHelp() })[kind]?.(); },
  modal(id, title, body, buttons, o = {}) {
    return new Promise((res) => {
      const foot = buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${esc(b.text)}</button>`).join('');
      const w = this.openWin(id, title, body, foot, { ...o, noClose: true }); w.dataset.modal = '1';
      w.querySelectorAll('.wf .btn').forEach((btn) => (btn.onclick = () => { Audio.sfxPlay('confirm'); this.closeWin(id); res(+btn.dataset.i); }));
      if (o.mount) o.mount(w, (i) => { this.closeWin(id); res(i); });
    });
  },
  rewardHTML(r) {
    const parts = [];
    if (r.exp) parts.push(`<div class="rw"><img src="${icon(['star', '#d8a83a', '#5a3a0a'], 48)}" alt="">经验值 ${r.exp}</div>`);
    if (r.gil) parts.push(`<div class="rw"><img src="${icon(['burst', '#e8c040', '#6a4a0a'], 48)}" alt="">金币 ${r.gil}</div>`);
    (r.items || []).forEach(([id, n]) => { const it = ITEMS[id]; parts.push(`<div class="rw"><img src="${icon(it.icon, 48)}" alt="">${esc(it.name)} ×${n}</div>`); });
    if (r.weapon) { const w = G.game.weaponFor(r.weapon); parts.push(`<div class="rw"><img src="${icon(w.icon, 48)}" alt="">${esc(w.name)}</div>`); }
    if (r.mount) parts.push(`<div class="rw"><img src="${icon(['chocobo', '#f0d040', '#6a4a0a'], 48)}" alt="">坐骑：陆行鸟</div>`);
    if (r.emote) parts.push(`<div class="rw"><img src="${icon(['heart', '#e070a0', '#4a0a2a'], 48)}" alt="">情感动作：跳舞</div>`);
    return `<div class="rewards">${parts.join('')}</div>`;
  },
  questOffer(q) {
    const body = `<div class="qwin"><div class="qtype">${q.type === 'msq' ? '主线任务' : '支线任务'} · 等级 ${q.lv}</div><div class="qtitle">${esc(q.title)}</div><p class="qdesc">${esc(G.game.fmt(q.desc))}</p><div class="lab gold" style="font-size:12px;margin-bottom:6px">报酬</div>${this.rewardHTML(q.rewards)}</div>`;
    return this.modal('quest', '接受任务', body, [{ text: '拒绝' }, { text: '接受', primary: true }]).then((i) => i === 1);
  },
  questReward(q) {
    const body = `<div class="qwin"><div class="qtype">${q.type === 'msq' ? '主线任务' : '支线任务'}</div><div class="qtitle">${esc(q.title)}</div><p class="qdesc">任务完成！获得了以下报酬。</p>${this.rewardHTML(q.rewards)}</div>`;
    return this.modal('quest', '任务完成', body, [{ text: '完成', primary: true }]);
  },
  winChar() {
    const P = G.player, S = G.save, job = JOBS[S.job], race = RACES.find((r) => r.id === S.app.race);
    const wpn = G.game.weaponFor(S.weaponTier || 0);
    const gear = [['武器', wpn.name + ` <span class="muted">iLv${wpn.ilvl}</span>`], ['身体', (S.gear.body ? ITEMS[S.gear.body].name + ` <span class="muted">iLv${ITEMS[S.gear.body].ilvl}</span>` : '冒险者外衣')], ['耳饰', S.gear.ear ? ITEMS[S.gear.ear].name : '<span class="muted">未装备</span>']];
    const body = `<div style="display:flex;gap:18px;flex-wrap:wrap">
      <div style="min-width:220px;flex:1"><div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><img src="${jobIcon(S.job)}" width="44" height="44" style="border-radius:8px" alt=""><div><div style="font-size:18px;font-family:var(--f-display)">${esc(S.name)}</div><div class="muted">${race.name} · ${race.clans[S.clan || 0]} · ${S.app.gender === 'f' ? '女性' : '男性'}</div></div></div>
      <dl class="kv"><dt>职业</dt><dd>${job.name} <span class="muted">${job.en}</span></dd><dt>等级</dt><dd class="num">${S.level}</dd><dt>命名日</dt><dd>${MONTHS[S.month || 0]} 第${(S.day || 0) + 1}日</dd><dt>守护神</dt><dd>${DEITIES[S.deity || 0][0]}</dd><dt>金币</dt><dd class="num">${S.gil}</dd></dl></div>
      <div style="min-width:220px;flex:1"><div class="gold" style="font-size:12px;margin-bottom:6px">属性</div><dl class="kv"><dt>最大体力</dt><dd class="num">${P.effMaxHp}</dd><dt>最大魔力</dt><dd class="num">${P.maxMp}</dd><dt>${job.caster ? '魔法攻击力' : '物理攻击力'}</dt><dd class="num">${Math.round(Combat.atk(P))}</dd><dt>暴击率</dt><dd class="num">${Math.round(P.crit * 100)}%</dd><dt>平均物品等级</dt><dd class="num">${G.game.avgIlvl()}</dd></dl>
      <div class="gold" style="font-size:12px;margin:14px 0 6px">装备</div><dl class="kv">${gear.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></div></div>`;
    this.openWin('char', '角色', body, '', { width: '560px' });
  },
  winInv() {
    const S = G.save; const cells = [];
    for (const [id, n] of Object.entries(S.inv)) if (n > 0) { const it = ITEMS[id] || G.game.itemById(id); if (it) cells.push(`<div class="it ${S.gear.body === id || S.gear.ear === id ? 'eq' : ''}" data-id="${id}" title="${esc(it.name)}"><img src="${icon(it.icon, 64)}" alt=""><b>${n > 1 ? n : ''}</b></div>`); }
    while (cells.length < 25) cells.push('<div class="it"></div>');
    const body = `<div class="inv">${cells.join('')}</div><p class="desc" id="inv-desc">点击物品查看说明。装备可以点击后换上。</p><div class="muted" style="margin-top:8px">金币 <span class="num" style="color:#ffe070">${S.gil}</span></div>`;
    const w = this.openWin('inv', '物品', body, '', { width: '320px' });
    w.querySelectorAll('.it[data-id]').forEach((el) => (el.onclick = () => {
      const id = el.dataset.id, it = ITEMS[id] || G.game.itemById(id); const d = w.querySelector('#inv-desc');
      d.innerHTML = `<b style="color:#fff">${esc(it.name)}</b>${it.ilvl ? ` <span class="muted">iLv${it.ilvl}</span>` : ''}<br>${esc(it.desc)}`;
      if (it.type === 'armor') { G.game.equip(id); this.closeWin('inv'); this.winInv(); }
      if (it.type === 'use') G.game.useItem(id);
    }));
  },
  winJournal() {
    const S = G.save; const rows = [];
    for (const q of Object.values(QUESTS)) { const st = S.quests[q.id]; if (!st) continue; const step = q.steps[st.step]; rows.push(`<div class="ji ${q.type} ${st.status === 'done' ? 'done' : ''}"><h5>${q.type === 'msq' ? '【主线】' : '【支线】'}${esc(q.title)}${st.status === 'done' ? ' ✓' : ''}</h5><p>${esc(G.game.fmt(q.desc))}</p>${st.status !== 'done' && step ? `<p style="color:#e8e0c8;margin-top:4px">▶ ${esc(this.stepText(q, st))}</p>` : ''}</div>`); }
    this.openWin('journal', '任务日志', `<div class="jl">${rows.join('') || '<p class="muted">还没有接受任何任务。</p>'}</div>`, '', { width: '440px' });
  },
  stepText(q, st) { const s = q.steps[st.step]; if (!s) return ''; if (s.type === 'kill' || s.type === 'gather') return `${s.text} ${st.count || 0}/${s.count}`; return s.text; },
  winMap() {
    const Z = G.zone; const size = 560;
    const body = `<div class="mapc"><canvas id="bigmap" width="${size}" height="${size}"></canvas></div><div class="teleports" id="tp-list"></div>`;
    const w = this.openWin('map', `地图 — ${Z.name}`, body, '', { width: `${size + 34}px` });
    const cv = w.querySelector('#bigmap'); this.drawBigMap(cv);
    const tl = w.querySelector('#tp-list');
    if (!Z.dungeon) {
      const list = G.game.teleportList();
      tl.innerHTML = list.length ? '<span class="muted" style="align-self:center">传送：</span>' + list.map((a) => `<button class="btn" data-id="${a.id}" ${a.locked ? 'disabled' : ''}>${esc(a.name)} <span class="muted">${a.locked ? '未共鸣' : a.cost + ' 金币'}</span></button>`).join('') : '';
      tl.querySelectorAll('button').forEach((b) => (b.onclick = () => { this.closeWin('map'); G.game.teleport(b.dataset.id); }));
    }
  },
  winDuty() {
    const S = G.save; const unlocked = S.quests.q5 && S.quests.q5.status === 'active' && S.quests.q5.step === 0; const cleared = S.flags.sastasha;
    const party = G.game.dutyParty();
    const body = `<div class="df"><div class="duty"><div class="dimg">SASTASHA</div><div style="flex:1;min-width:0"><div style="font-size:15px;font-family:var(--f-display)">天然要害沙斯塔夏溶洞</div><div class="muted" style="font-size:12px;margin-top:2px">迷宫挑战 · 4人 · 等级同步 Lv${S.level}${cleared ? ' · 已攻略' : ''}</div><div class="muted" style="font-size:12px;margin-top:4px">海盗与沙哈金族勾结，在溶洞深处囤积水晶……</div></div></div>
      <div class="gold" style="font-size:12px;margin-top:12px">亲信战友（NPC 队友）</div><div class="party-row">${party.map((p) => `<span><img src="${roleIcon(p.role)}" alt="">${esc(p.name)}</span>`).join('')}</div>
      ${!unlocked && !cleared ? '<p class="desc" style="color:#ffb070">推进主线任务「拂晓的来访者」后可以申请此任务。</p>' : ''}</div>`;
    const w = this.openWin('duty', '任务搜索器', body, `<button class="btn primary" id="df-go" ${unlocked || cleared ? '' : 'disabled'}>申请参加</button>`, { width: '480px' });
    const b = w.querySelector('#df-go'); if (b) b.onclick = () => { this.closeWin('duty'); G.game.queueDuty(); };
  },
  winEmote() {
    const S = G.save;
    const body = `<div class="emotes">${EMOTES.map((e) => `<button class="btn ${e.locked && !S.emotes.includes(e.id) ? '' : ''}" data-id="${e.id}" ${e.locked && !S.emotes.includes(e.id) ? 'disabled title="尚未习得"' : ''}>${e.name}<br><span class="muted" style="font-size:11px">${e.cmd}</span></button>`).join('')}</div>`;
    const w = this.openWin('emote', '情感动作', body, '', { width: '340px' });
    w.querySelectorAll('button[data-id]').forEach((b) => (b.onclick = () => { G.game.emote(b.dataset.id); }));
  },
  winSystem() {
    const s = G.settings;
    const body = `<div style="display:flex;flex-direction:column;gap:12px;min-width:280px">
      <label class="field" style="margin:0"><span class="lab gold" style="display:block;font-size:12px;margin-bottom:5px">音乐音量</span><input type="range" class="slider" id="set-music" min="0" max="1" step="0.05" value="${s.music}"></label>
      <label class="field" style="margin:0"><span class="lab gold" style="display:block;font-size:12px;margin-bottom:5px">音效音量</span><input type="range" class="slider" id="set-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="set-bloom" ${s.bloom ? 'checked' : ''}> 辉光后期（关闭可提升性能）</label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="set-shadow" ${s.shadows ? 'checked' : ''}> 实时阴影</label>
      ${this.fsSupported() ? `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="set-fs" ${this.fsActive() ? 'checked' : ''}> 全屏模式（隐藏浏览器界面，Alt+Enter）</label>` : ''}</div>`;
    const w = this.openWin('system', '系统菜单', body, `<button class="btn" id="sys-help">操作说明</button><button class="btn" id="sys-save">保存进度</button><button class="btn" id="sys-chars">切换角色</button><button class="btn" id="sys-title">返回标题画面</button>`, { width: '360px' });
    w.querySelector('#set-music').oninput = (e) => { s.music = +e.target.value; Audio.setVolumes(s.music, s.sfx); G.game.saveSettings(); };
    w.querySelector('#set-sfx').oninput = (e) => { s.sfx = +e.target.value; Audio.setVolumes(s.music, s.sfx); G.game.saveSettings(); };
    w.querySelector('#set-bloom').onchange = (e) => { s.bloom = e.target.checked; G.game.saveSettings(); };
    w.querySelector('#set-shadow').onchange = (e) => { s.shadows = e.target.checked; G.sun.castShadow = s.shadows; G.game.saveSettings(); };
    const fs = w.querySelector('#set-fs'); if (fs) fs.onchange = () => { this.toggleFullscreen(); fs.checked = this.fsActive(); };
    w.querySelector('#sys-help').onclick = () => { this.closeWin('system'); this.winHelp(); };
    w.querySelector('#sys-save').onclick = () => { G.game.save(); this.chat('进度已保存。', 'system'); };
    w.querySelector('#sys-title').onclick = () => { this.closeWin('system'); G.game.toTitle(); };
    w.querySelector('#sys-chars').onclick = () => { this.closeWin('system'); G.game.toCharSelect(); };
  },
  winHelp() {
    const rows = [['W A S D', '移动（相对镜头方向）'], ['Space', '跳跃'], ['R', '冲刺'], ['鼠标拖动', '旋转视角（左键或右键）'], ['滚轮', '缩放视角'], ['鼠标点击', '选择目标'], ['Tab', '切换敌人目标'], ['Esc', '取消目标 / 关闭窗口'], ['F', '交谈 / 调查'], ['1~0 - =', '热键栏第一行技能'], ['Shift+1~5', '冲刺、回复药、坐骑、极限技、返回'], ['V', '召唤 / 解除坐骑'], ['C I J M U E', '角色 · 物品 · 任务 · 地图 · 任务搜索器 · 情感动作'], ['Enter', '聊天输入（支持 /wave 等指令）'], ['Alt+Enter', '全屏 / 退出全屏（Mac 为 Option+Enter）']];
    this.openWin('help', '操作说明', `<div class="help-grid">${rows.map(([k, v]) => `<div><kbd>${k}</kbd></div><div>${v}</div>`).join('')}</div><p class="desc" style="margin-top:14px">小提示：橙色地面预兆代表敌人的范围攻击，看到后尽快走出范围。连击技能会发光提示下一步。</p>`, '', { width: '460px' });
  },
  // ---------- 小地图 ----------
  buildMap(zone) {
    const [x0, z0, x1, z1] = zone.bounds, W = 512, H = Math.round(512 * (z1 - z0) / (x1 - x0));
    const cv = canvas(W, H), c = cv.getContext('2d'); const k = W / (x1 - x0);
    const tx = (x) => (x - x0) * k, tz = (z) => (z - z0) * k;
    if (zone.id === 'field') {
      const img = c.createImageData(W, H);
      for (let py = 0; py < H; py += 2) for (let px = 0; px < W; px += 2) {
        const x = x0 + px / k, z = z0 + py / k, h = fieldH(x, z); let r, g, b;
        if (h < -1) { r = 40; g = 90; b = 130; } else if (h < 1.4) { r = 200; g = 186; b = 140; } else { const t = clamp(h / 14, 0, 1); r = 90 + t * 60; g = 130 + t * 40; b = 70 + t * 40; }
        if (h > -1 && dRoad(x, z) < 3) { r = 190; g = 160; b = 110; }
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const i = ((py + dy) * W + px + dx) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; }
      }
      c.putImageData(img, 0, 0);
    } else {
      c.fillStyle = zone.dungeon ? '#0e1418' : '#2a5a7a'; c.fillRect(0, 0, W, H);
      c.fillStyle = zone.dungeon ? '#5a5244' : '#d8cba8'; c.strokeStyle = zone.dungeon ? '#2a2620' : '#8a7a5a'; c.lineWidth = 2;
      for (const a of zone.walk.a) { c.beginPath(); if (a.t === 'c') c.arc(tx(a.x), tz(a.z), a.r * k, 0, 7); else c.rect(tx(a.x0), tz(a.z0), (a.x1 - a.x0) * k, (a.z1 - a.z0) * k); c.fill(); c.stroke(); }
      for (const a of zone.walk.a) { c.beginPath(); if (a.t === 'c') c.arc(tx(a.x), tz(a.z), a.r * k, 0, 7); else c.rect(tx(a.x0), tz(a.z0), (a.x1 - a.x0) * k, (a.z1 - a.z0) * k); c.fill(); }
      c.fillStyle = zone.dungeon ? '#2a2620' : '#9a8a6a';
      for (const b of zone.walk.blk) if (b.t === 'b' && b.on) c.fillRect(tx(b.x0), tz(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
    }
    zone.mapImg = cv; zone.mapK = k;
  },
  w2m(zone, x, z) { const [x0, z0] = zone.bounds; return [(x - x0) * zone.mapK, (z - z0) * zone.mapK]; },
  markers() {
    const out = []; const Z = G.zone;
    if (Z.aetheryte) out.push({ x: Z.aetheryte.x, z: Z.aetheryte.z - 6, icon: 'aeth' });
    for (const e of G.entities) if (e.kind === 'npc' && e.qmark) out.push({ x: e.pos.x, z: e.pos.z, icon: e.qmark });
    for (const m of G.game.objectiveMarkers()) out.push(m);
    if (Z.fate && G.fate) out.push({ x: Z.fate.x, z: Z.fate.z, icon: 'fate' });
    if (Z.id === 'field') out.push({ x: 124, z: -84, icon: 'duty' });
    return out;
  },
  drawMinimap() {
    const cv = $('minimap'), c = cv.getContext('2d'), Z = G.zone, P = G.player; if (!Z || !P || !Z.mapImg) return;
    const S = 200, k = 1.7; c.fillStyle = Z.dungeon ? '#05080a' : '#244a66'; c.fillRect(0, 0, S, S);
    c.save(); c.translate(S / 2, S / 2); c.scale(k / Z.mapK, k / Z.mapK); const [mx, mz] = this.w2m(Z, P.pos.x, P.pos.z); c.translate(-mx, -mz); c.drawImage(Z.mapImg, 0, 0); c.restore();
    const toS = (x, z) => [S / 2 + (x - P.pos.x) * k, S / 2 + (z - P.pos.z) * k];
    for (const e of G.entities) {
      if (e === P || e.dead && e.faction === 'enemy') continue; const [sx, sy] = toS(e.pos.x, e.pos.z); if (sx < 0 || sy < 0 || sx > S || sy > S) continue;
      const col = e.faction === 'enemy' ? (e.inCombat || e.def.aggro ? '#ff5a4a' : '#ffd24a') : e.faction === 'party' ? '#5ab0ff' : e.faction === 'remote' ? '#f2f6ff' : null;
      if (!col || e.kind === 'npc') continue; c.fillStyle = col; c.beginPath(); c.arc(sx, sy, e.boss ? 5 : 3, 0, 7); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
    }
    for (const m of this.markers()) {
      let [sx, sy] = toS(m.x, m.z); const dx = sx - S / 2, dy = sy - S / 2, d = Math.hypot(dx, dy);
      const out = d > S / 2 - 12; if (out) { if (!m.icon.startsWith('msq') && !m.icon.startsWith('side') && m.icon !== 'duty') continue; sx = S / 2 + dx / d * (S / 2 - 12); sy = S / 2 + dy / d * (S / 2 - 12); }
      const img = this.img(qIcon(m.icon)); if (img.complete) c.drawImage(img, sx - 11, sy - 11, 22, 22);
      if (m.area) { c.strokeStyle = 'rgba(255,210,80,.8)'; c.fillStyle = 'rgba(255,210,80,.15)'; c.beginPath(); c.arc(toS(m.x, m.z)[0], toS(m.x, m.z)[1], m.area * k, 0, 7); c.fill(); c.stroke(); }
    }
    // 视锥与玩家箭头
    const cy = G.cam.yaw; c.save(); c.translate(S / 2, S / 2);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 60); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    const ca = Math.atan2(Math.cos(cy), Math.sin(cy)); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 60, ca - 0.6, ca + 0.6); c.closePath(); c.fill();
    const pa = Math.atan2(Math.cos(P.rot), Math.sin(P.rot)); c.rotate(pa); c.fillStyle = '#ffe070'; c.strokeStyle = '#3a2a00'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -6); c.lineTo(-3, 0); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
  },
  img(src) { this._imgs = this._imgs || new Map(); let i = this._imgs.get(src); if (!i) { i = new Image(); i.src = src; this._imgs.set(src, i); } return i; },
  drawBigMap(cv) {
    const Z = G.zone, c = cv.getContext('2d'), S = cv.width; const [x0, z0, x1, z1] = Z.bounds; const sc = Math.min(S / (x1 - x0), S / (z1 - z0));
    c.fillStyle = '#111'; c.fillRect(0, 0, S, S); const ox = (S - (x1 - x0) * sc) / 2, oz = (S - (z1 - z0) * sc) / 2;
    c.drawImage(Z.mapImg, ox, oz, (x1 - x0) * sc, (z1 - z0) * sc);
    const toS = (x, z) => [ox + (x - x0) * sc, oz + (z - z0) * sc];
    c.font = '600 14px "Noto Serif SC", serif'; c.textAlign = 'center';
    for (const [t, x, z] of Z.labels || []) { const [sx, sy] = toS(x, z); c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(t, sx, sy); c.fillStyle = '#fff4d8'; c.fillText(t, sx, sy); }
    for (const m of this.markers()) { const [sx, sy] = toS(m.x, m.z); const img = this.img(qIcon(m.icon)); c.drawImage(img, sx - 13, sy - 13, 26, 26); }
    const [px, py] = toS(G.player.pos.x, G.player.pos.z); c.save(); c.translate(px, py); c.rotate(Math.atan2(Math.cos(G.player.rot), Math.sin(G.player.rot))); c.fillStyle = '#ffe070'; c.strokeStyle = '#000'; c.beginPath(); c.moveTo(11, 0); c.lineTo(-7, -7); c.lineTo(-3, 0); c.lineTo(-7, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
  },
  // ---------- HUD ----------
  buildHotbars() {
    const P = G.player, job = JOBS[G.save.job];
    const skills = job.skills; this.slots1 = [];
    const keys1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
    const hb1 = $('hb1'); hb1.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const sk = skills[i]; const el = document.createElement('div'); el.className = 'slot' + (sk ? '' : ' empty'); el.tabIndex = -1;
      el.innerHTML = sk ? `<img src="${icon(sk.icon, 64)}" alt="${esc(sk.name)}"><div class="cdv"></div><div class="cdt"></div><span class="key">${keys1[i]}</span>` : `<span class="key">${keys1[i]}</span>`;
      if (sk) { el.onclick = () => G.game.useSlot(sk); this.tipFor(el, () => this.skillTip(sk)); }
      hb1.appendChild(el); this.slots1.push({ el, sk, cdv: el.querySelector('.cdv'), cdt: el.querySelector('.cdt') });
    }
    const hb2 = $('hb2'); hb2.innerHTML = ''; this.slots2 = [];
    GENERAL.forEach((g, i) => {
      const el = document.createElement('div'); el.className = 'slot';
      el.innerHTML = `<img src="${icon(g.icon, 64)}" alt="${esc(g.name)}"><div class="cdv"></div><div class="cdt"></div><span class="key">⇧${i + 1}</span><span class="cnt"></span>`;
      el.onclick = () => G.game.useGeneral(g.id); this.tipFor(el, () => this.skillTip(g));
      hb2.appendChild(el); this.slots2.push({ el, g, cdv: el.querySelector('.cdv'), cdt: el.querySelector('.cdt'), cnt: el.querySelector('.cnt') });
    });
    void P;
  },
  skillTip(sk) {
    const kind = { ws: '战技', spell: '魔法', ability: '能力', item: '道具', lb: '极限技' }[sk.kind] || '能力';
    const meta = [`<span>${kind}</span>`]; if (sk.range) meta.push(`<span>距离 ${sk.range}米</span>`); meta.push(`<span>咏唱 ${sk.cast ? sk.cast + '秒' : '即时'}</span>`); meta.push(`<span>复唱 ${sk.recast || 2.5}秒</span>`); if (sk.mp) meta.push(`<span>MP ${sk.mp}</span>`);
    return `<h5>${esc(sk.name)}</h5><div class="tk">${sk.lv ? '习得等级 ' + sk.lv : ''}</div><div class="tm">${meta.join('')}</div><p>${esc(sk.desc || '')}</p>`;
  },
  tipFor(el, fn) {
    el.onmouseenter = () => { this.tip.innerHTML = fn(); this.tip.hidden = false; const r = el.getBoundingClientRect(); this.tip.style.left = clamp(r.left + r.width / 2 - 140, 8, innerWidth - 296) + 'px'; this.tip.style.top = Math.max(8, r.top - this.tip.offsetHeight - 10) + 'px'; };
    el.onmouseleave = () => { this.tip.hidden = true; };
  },
  pressSlot(i, row = 1) { const s = (row === 1 ? this.slots1 : this.slots2)[i]; if (!s) return; s.el.classList.add('press'); setTimeout(() => s.el.classList.remove('press'), 120); },
  updateHotbars() {
    const P = G.player; if (!P || !this.slots1) return;
    const next = P.combo ? P.combo.id : null;
    for (const s of this.slots1) {
      if (!s.sk) continue; const sk = s.sk;
      const locked = sk.lv > P.level; s.el.classList.toggle('locked', locked);
      let rem = 0, max = 1;
      if (sk.gcd) { rem = P.gcd; max = P.gcdMax; } else { rem = P.cd[sk.id] || 0; max = sk.recast; }
      const pct = rem > 0 ? (rem / max) * 100 : 0; s.cdv.style.setProperty('--p', pct.toFixed(1) + '%'); s.cdv.style.display = rem > 0 ? '' : 'none';
      s.cdt.textContent = !sk.gcd && rem > 0.05 ? Math.ceil(rem) : '';
      const nomp = Combat.mpCost(P, sk) > P.mp, req = sk.requires && !P.has(sk.requires);
      s.el.classList.toggle('dis', !locked && !!(nomp || req));
      let oor = false; if (!locked && sk.target === 'enemy' && P.target && P.target.faction === 'enemy' && !P.target.dead) oor = P.edge(P.target) > sk.range;
      s.el.classList.toggle('oor', oor);
      s.el.classList.toggle('combo', !locked && !!(sk.combo && sk.combo.from === next));
      s.el.classList.toggle('proc', !locked && !!((sk.requires && P.has(sk.requires)) || (sk.freeWith && P.has(sk.freeWith)) || (sk.instantWith && P.has(sk.instantWith))));
    }
    for (const s of this.slots2) {
      const g = s.g; const rem = P.cd[g.id] || 0; s.cdv.style.setProperty('--p', (rem > 0 ? (rem / g.recast) * 100 : 0).toFixed(1) + '%'); s.cdv.style.display = rem > 0 ? '' : 'none'; s.cdt.textContent = rem > 0.05 ? Math.ceil(rem) : '';
      if (g.id === 'potion') s.cnt.textContent = G.save.inv.potion || 0;
      const dis = (g.id === 'potion' && !(G.save.inv.potion > 0)) || (g.id === 'mount' && !G.save.mount) || (g.id === 'lb' && (Combat.lb < Combat.lbMax || !Combat.inParty())) || (g.id === 'return' && G.zone.dungeon);
      s.el.classList.toggle('dis', !!dis); s.el.classList.toggle('proc', !!(g.id === 'lb' && Combat.lb >= Combat.lbMax && Combat.inParty()));
    }
  },
  statusHTML(e, big = true) {
    return e.statuses.filter((s) => s.icon && (big || s.debuff || s.src === G.player)).slice(0, big ? 12 : 8).map((s) => `<div class="sti ${s.debuff ? 'debuff' : ''}" title="${esc(s.name)}"><img src="${icon(s.icon, 48)}" alt=""><span class="num">${isFinite(s.t) ? Math.ceil(s.t) : ''}</span></div>`).join('');
  },
  updateHUD(dt) {
    const P = G.player; if (!P) return;
    this.hudT = (this.hudT || 0) + dt; const slow = this.hudT > 0.2; if (slow) this.hudT = 0;
    // 玩家参数
    $('p-hp').textContent = P.hp; $('p-mp').textContent = P.mp;
    $('p-hpfill').style.width = (P.hp / P.effMaxHp) * 100 + '%'; $('p-mpfill').style.width = (P.mp / P.maxMp) * 100 + '%';
    $('p-hpbar').classList.toggle('lowhp', P.hp < P.effMaxHp * 0.3);
    const inD = Combat.inParty(); $('lbbar').hidden = !inD;
    if (inD) { $('lb-fill').style.width = (Combat.lb / Combat.lbMax) * 100 + '%'; $('lb-t').textContent = Combat.lb >= Combat.lbMax ? 'READY' : Math.floor(Combat.lb / 10) + '%'; $('lbbar').classList.toggle('full', Combat.lb >= Combat.lbMax); }
    // 咏唱栏
    const c = P.casting; $('pcast').hidden = !c;
    if (c) { $('pc-name').textContent = c.name; $('pc-time').textContent = Math.max(0, c.total - c.t).toFixed(2); $('pc-fill').style.width = (c.t / c.total) * 100 + '%'; }
    this.updateHotbars();
    if (slow || this.dirtyStatus) { $('pstatus').innerHTML = this.statusHTML(P); this.dirtyStatus = false; }
    // 目标栏
    const T = P.target, tb = $('target');
    if (T && (T.faction !== 'enemy' || !T.dead || T.deadT < 1)) {
      tb.hidden = false; tb.classList.toggle('friendly', T.faction !== 'enemy');
      $('t-name').textContent = T.name; $('t-lv').textContent = T.kind === 'npc' ? '' : 'Lv' + T.level; $('t-tag').textContent = T.boss ? '★BOSS' : '';
      const pct = T.hp / (T.effMaxHp || T.maxHp); $('t-hp').style.width = pct * 100 + '%'; $('t-pct').textContent = T.kind === 'npc' ? '' : (pct * 100).toFixed(1) + '%';
      const tc = T.casting; $('t-cast').hidden = !tc; if (tc) { $('t-castname').textContent = tc.name; $('t-castfill').style.width = (tc.t / tc.total) * 100 + '%'; }
      if (slow) { $('t-sts').innerHTML = this.statusHTML(T, false); const tt = T.target; $('t-tt').textContent = tt && T.faction === 'enemy' && T.inCombat ? '▶ ' + (tt === P ? G.save.name : tt.name) : ''; }
    } else tb.hidden = true;
    if (slow) { this.updateParty(); this.updateEnmity(); this.layoutRight(); }
    this.drawMinimap();
    if (slow) { const et = G.game.eorzeaTime(); $('clock').textContent = `艾欧泽亚时间 ${et}  ☀ 晴朗`; }
    if (this.dirtyQuests) { this.updateTracker(); this.dirtyQuests = false; }
    if (slow) this.updateExp();
  },
  updateExp() {
    const S = G.save; const need = expToNext(S.level);
    $('exp-job').textContent = `${JOBS[S.job].name}  Lv${S.level}`; $('exp-t').textContent = S.level >= MAX_LEVEL ? '已达到本作等级上限' : `EXP ${S.exp} / ${need}`;
    $('exp-fill').style.width = S.level >= MAX_LEVEL ? '100%' : (S.exp / need) * 100 + '%';
  },
  updateParty() {
    const list = Combat.party(); const box = $('party');
    const key = list.map((e) => e.id).join(',');
    if (this.partyKey !== key) {
      this.partyKey = key; box.innerHTML = '';
      this.partyEls = list.map((e) => {
        const el = document.createElement('div'); el.className = 'pm';
        el.innerHTML = `<img class="ji" src="${e === G.player ? jobIcon(G.save.job, 48) : roleIcon(e.role)}" alt=""><div class="nm"><span>${esc(e === G.player ? G.save.name : e.name)}</span><span class="lv">Lv${e.level}</span></div><div class="bars"><div class="bar"><i></i></div><span class="hpn num"></span></div><div class="bars"><div class="bar mp"><i></i></div><span></span></div><div class="sts"></div>`;
        el.onclick = () => G.game.setTarget(e); box.appendChild(el);
        return { e, el, hp: el.querySelectorAll('.bar i')[0], mp: el.querySelectorAll('.bar i')[1], hpn: el.querySelector('.hpn'), sts: el.querySelector('.sts'), bar: el.querySelector('.bar') };
      });
    }
    for (const p of this.partyEls) {
      const e = p.e; p.hp.style.width = (e.hp / e.effMaxHp) * 100 + '%'; p.mp.style.width = (e.mp / e.maxMp) * 100 + '%'; p.hpn.textContent = e.dead ? '无法战斗' : e.hp;
      p.el.classList.toggle('dead', e.dead); p.el.classList.toggle('sel', G.player.target === e); p.bar.classList.toggle('lowhp', e.hp < e.effMaxHp * 0.3);
      p.sts.innerHTML = e.statuses.filter((s) => s.icon && (s.debuff || e !== G.player)).slice(0, 6).map((s) => `<img src="${icon(s.icon, 32)}" alt="" title="${esc(s.name)}">`).join('');
    }
    $('enmity').style.top = 14 + (list.length * 58 + 10) * (this.uiScale || 1) + 'px';
  },
  updateEnmity() {
    const box = $('enmity'); const en = Combat.enemies().filter((e) => (e.net ? Online.mine(e) : e.inCombat && e.enmity.has(G.player.id))).slice(0, 6);
    if (!en.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="panel" style="padding:4px 0">' + en.map((e) => { const top = Combat.topEnmity(e); const mine = top === G.player; return `<div class="row"><b style="background:${mine ? '#ff5a4a' : '#ffb03a'}"></b><span style="flex:1">${esc(e.name)}</span><span class="num muted">${Math.round((e.hp / e.maxHp) * 100)}%</span></div>`; }).join('') + '</div>';
  },
  updateTracker() {
    const S = G.save; const box = $('tracker'); const rows = [];
    const act = Object.values(QUESTS).filter((q) => S.quests[q.id] && S.quests[q.id].status === 'active').sort((a, b) => (a.type === 'msq' ? -1 : 1) - (b.type === 'msq' ? -1 : 1));
    for (const q of act.slice(0, 5)) rows.push(`<div class="tq ${q.type}" data-q="${q.id}"><div class="qt">${esc(q.title)}<img src="${qIcon(q.type === 'msq' ? 'msq' : 'side')}" alt=""></div><div class="qs">${esc(this.stepText(q, S.quests[q.id]))}</div></div>`);
    if (!act.length) { const nextMsq = Object.values(QUESTS).find((q) => q.type === 'msq' && !S.quests[q.id] && (q.prereq || []).every((p) => S.quests[p] && S.quests[p].status === 'done')); if (nextMsq) rows.push(`<div class="tq msq"><div class="qt">${esc(nextMsq.title)}<img src="${qIcon('msq')}" alt=""></div><div class="qs">与 <b>${esc(NPCS[nextMsq.giver].name)}</b> 交谈接受任务</div></div>`); }
    box.innerHTML = rows.join('');
    box.querySelectorAll('.tq').forEach((el) => (el.onclick = () => this.toggle('map')));
    this.layoutRight();
  },
  dutyInfo(html) { const d = $('duty'); if (!html) { d.hidden = true; this.layoutRight(); return; } d.hidden = false; d.innerHTML = html; this.layoutRight(); },
  fateInfo(html) { const f = $('fate'); if (!html) { f.hidden = true; return; } f.hidden = false; f.innerHTML = html; this.layoutRight(); },
  netStatus(s, count) {
    const el = $('net-status'); if (!el) return;
    const t = { connecting: '正在连接服务器…', reconnecting: '连接中断，正在重连…', online: G.zone && G.zone.dungeon ? `联机副本 · 小队中 ${count} 名冒险者` : `在线 · 本地图 ${count} 名冒险者`, offline: '离线模式（单人游戏）', solo: '副本中（单人）' }[s];
    el.hidden = !t; el.className = 'net num ' + s; el.textContent = t ? '● ' + t : '';
  },
  prompt(text) { const p = $('prompt'); if (!text) { if (!p.hidden) p.hidden = true; return; } if (p.dataset.t !== text) { p.dataset.t = text; p.innerHTML = `<kbd>F</kbd>${esc(text)}`; } p.hidden = false; },
  // ---------- 名牌与飞字 ----------
  updateNameplates() {
    const cam = G.camera, host = $('nameplates'), W = innerWidth, H = innerHeight; const seen = new Set();
    const v = this._v || (this._v = cam.position.clone());
    for (const e of G.entities) {
      if (e.hidden || (e.dead && e.faction === 'enemy' && e.deadT > 1.2)) continue;
      const d = cam.position.distanceTo(e.pos); const maxD = e.kind === 'npc' ? 32 : 45; if (d > maxD) continue;
      v.set(e.pos.x, e.pos.y + (e.plateH || e.height) + 0.35, e.pos.z).project(cam); if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
      let n = this.np.get(e.id);
      if (!n) {
        n = document.createElement('div'); host.appendChild(n); this.np.set(e.id, n); n._k = '';
      }
      const isP = e === G.player; const cls = 'np ' + (isP ? 'player' : e.faction === 'party' ? 'party' : e.kind === 'remote' ? 'remote' : e.kind === 'npc' ? 'npc' : 'enemy' + (e.inCombat || (e.def && e.def.aggro) ? ' hostile' : ''));
      const showHp = e.faction === 'enemy' && e.inCombat && !e.dead;
      const bub = e.bubble && e.bubble.until > G.time ? e.bubble.text : '';
      const key = cls + '|' + (e.qmark || '') + '|' + bub + '|' + showHp + '|' + (e.dead ? 1 : 0) + '|' + e.name;
      if (n._k !== key) {
        n._k = key; n.className = cls;
        n.innerHTML = `${bub ? `<div class="bub">${esc(bub)}</div>` : ''}${e.qmark ? `<img class="qi" src="${qIcon(e.qmark)}" alt="">` : ''}${e.title && !isP ? `<div class="t">《${esc(e.title)}》</div>` : ''}<div class="n">${isP ? esc(G.save.name) : (e.faction === 'enemy' ? `Lv${e.level} ` : '') + esc(e.name)}</div>${isP ? `<div class="t" style="color:#9fc6ff">«拂晓»</div>` : ''}${showHp ? '<div class="hp"><i></i></div>' : ''}`;
        n._hp = n.querySelector('.hp i'); n._hpw = null;
      }
      if (n._hp) { const w = Math.round((e.hp / e.maxHp) * 1000) / 10 + '%'; if (n._hpw !== w) { n._hpw = w; n._hp.style.width = w; } }
      // 位置取整像素、缩放按 0.05 分级：文字不会因为亚像素位置或缩放的细微变化每帧重新栅格化而闪动
      const sc = Math.round(clamp(1.25 - d / 50, 0.7, 1.1) * 20) / 20;
      const tf = `translate(${Math.round((v.x * 0.5 + 0.5) * W)}px, ${Math.round((-v.y * 0.5 + 0.5) * H)}px) translate(-50%, -100%) scale(${sc})`;
      if (n._tf !== tf) { n._tf = tf; n.style.transform = tf; }
      const op = e.dead ? '0.5' : '1'; if (n._op !== op) { n._op = op; n.style.opacity = op; }
      seen.add(e.id);
    }
    for (const [id, n] of this.np) if (!seen.has(id)) { n.remove(); this.np.delete(id); }
  },
  clearPlates() { for (const n of this.np.values()) n.remove(); this.np.clear(); $('flytext').innerHTML = ''; },
  flytext(e, text, cls) {
    const host = $('flytext'); if (host.children.length > 40) return;
    G.camera.updateMatrixWorld(); const v = e.hitPos().project(G.camera); if (v.z > 1) return;
    const el = document.createElement('div'); el.className = 'fly ' + cls; el.textContent = text;
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 60) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight - 20) + 'px';
    host.appendChild(el); setTimeout(() => el.remove(), 1300);
  },
  // ---------- 角色创建 ----------
  creator(state, onChange) {
    const tabs = [['race', '种族'], ['look', '外貌'], ['hair', '发型'], ['color', '色彩'], ['job', '职业'], ['id', '身份']];
    const tabEl = $('cc-tabs'); tabEl.innerHTML = '';
    let cur = 'race';
    const render = () => {
      tabEl.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.t === cur));
      const a = state.app, body = $('cc-body'); const race = RACES.find((r) => r.id === a.race);
      const opt = (key, val, label, sub, on) => `<button class="opt ${on ? 'on' : ''}" data-k="${key}" data-v="${val}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
      const sw = (key, cols, curv) => `<div class="swatches">${cols.map((c) => `<button class="sw ${c === curv ? 'on' : ''}" style="background:${c}" data-k="${key}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
      const sl = (key, label, v) => `<div class="field"><label for="sl-${key}">${label}</label><input type="range" class="slider" id="sl-${key}" data-k="${key}" min="0" max="1" step="0.01" value="${v}"></div>`;
      let h = '';
      if (cur === 'race') {
        h += `<div class="field"><div class="lab">种族</div><div class="grid-opts">${RACES.map((r) => opt('race', r.id, r.name, r.en, r.id === a.race)).join('')}</div></div>`;
        h += `<div class="field"><div class="lab">性别</div><div class="grid-opts">${opt('gender', 'm', '男性', 'MALE', a.gender === 'm')}${opt('gender', 'f', '女性', 'FEMALE', a.gender === 'f')}</div></div>`;
        h += `<div class="field"><div class="lab">部族</div><div class="grid-opts">${race.clans.map((c, i) => opt('clan', i, c, '', state.clan === i)).join('')}</div><p class="desc">${esc(race.desc)}</p></div>`;
      } else if (cur === 'look') {
        h += sl('height', '身高', a.height) + sl('build', '体型', a.build);
        if (['elezen', 'miqote', 'viera', 'aura', 'lalafell', 'hrothgar'].includes(a.race)) h += sl('feature', a.race === 'aura' ? '角与尾巴' : a.race === 'miqote' || a.race === 'hrothgar' ? '耳朵与尾巴' : '耳朵长度', a.feature);
        h += `<div class="field"><div class="lab">眼型</div><div class="grid-opts g4">${['标准', '细长', '圆润'].map((n, i) => opt('eyeShape', i, n, '', a.eyeShape === i)).join('')}</div></div>`;
        h += `<div class="field"><div class="lab">眉毛</div><div class="grid-opts g4">${['柔和', '浓眉', '细眉'].map((n, i) => opt('brows', i, n, '', a.brows === i)).join('')}</div></div>`;
        h += `<div class="field"><div class="lab">嘴型</div><div class="grid-opts g4">${['微笑', '平静', '开朗'].map((n, i) => opt('mouth', i, n, '', a.mouth === i)).join('')}</div></div>`;
        h += `<div class="field"><div class="lab">面部彩绘</div><div class="grid-opts">${['无', '猫须纹', '泪痕纹', '额心印', '雀斑', '部族纹'].map((n, i) => opt('facePaint', i, n, '', a.facePaint === i)).join('')}</div></div>`;
        h += `<div class="field"><div class="lab">彩绘颜色</div>${sw('paintColor', PAINT_COLORS, a.paintColor)}</div>`;
        if (a.race === 'aura') h += `<div class="field"><div class="lab">鳞片颜色</div>${sw('scaleColor', SCALE_COLORS, a.scaleColor)}</div>`;
      } else if (cur === 'hair') {
        h += `<div class="field"><div class="lab">发型</div><div class="grid-opts">${['清爽短发', '柔顺长发', '高马尾', '双马尾', '波波头', '刺猬头', '丸子头', '背头'].map((n, i) => opt('hairStyle', i, n, `STYLE ${String(i + 1).padStart(2, '0')}`, a.hairStyle === i)).join('')}</div>${a.race === 'hrothgar' ? '<p class="desc">硌狮族拥有独特的鬃毛，发型选项仅影响颜色。</p>' : ''}</div>`;
        h += `<div class="field"><div class="lab">发色</div>${sw('hairColor', HAIR_COLORS, a.hairColor)}</div>`;
      } else if (cur === 'color') {
        h += `<div class="field"><div class="lab">肤色 · ${race.clans[state.clan]}</div>${sw('skin', SKINS[a.race][state.clan], a.skin)}</div>`;
        h += `<div class="field"><div class="lab">瞳色</div>${sw('eyeColor', EYE_COLORS, a.eyeColor)}</div>`;
      } else if (cur === 'job') {
        h += `<div class="field"><div class="lab">初始职业</div><div class="grid-opts">${Object.entries(JOBS).map(([id, j]) => `<button class="opt ${state.job === id ? 'on' : ''}" data-k="job" data-v="${id}"><span class="jobcard"><img src="${jobIcon(id, 64)}" alt="">${j.name}</span><small>${j.en} · ${{ tank: '防护职业', healer: '治疗职业', melee: '近战进攻', ranged: '远程物理', caster: '远程魔法' }[j.role]}</small></button>`).join('')}</div></div>`;
        const j = JOBS[state.job];
        h += `<p class="desc">${esc(j.desc)}</p><div class="field" style="margin-top:12px"><div class="lab">代表技能</div>${j.skills.slice(0, 6).map((s) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><img src="${icon(s.icon, 48)}" width="28" height="28" style="border-radius:5px" alt=""><span>${s.name}</span><span class="muted" style="font-size:11px">Lv${s.lv}</span></div>`).join('')}</div>`;
      } else if (cur === 'id') {
        h += `<div class="field"><label for="cc-name">角色名</label><input class="text-in" id="cc-name" maxlength="16" value="${esc(state.name)}"></div>`;
        h += `<div class="field"><label for="cc-month">命名日</label><div style="display:flex;gap:6px"><select class="text-in" id="cc-month">${MONTHS.map((m, i) => `<option value="${i}" ${state.month === i ? 'selected' : ''}>${m}</option>`).join('')}</select><select class="text-in" id="cc-day" style="width:90px">${Array.from({ length: 32 }, (_, i) => `<option value="${i}" ${state.day === i ? 'selected' : ''}>${i + 1}日</option>`).join('')}</select></div></div>`;
        h += `<div class="field"><label for="cc-deity">守护神</label><select class="text-in" id="cc-deity">${DEITIES.map((d, i) => `<option value="${i}" ${state.deity === i ? 'selected' : ''}>${d[0]}　${d[1]}</option>`).join('')}</select></div>`;
        h += `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;line-height:1.6"><input type="checkbox" id="cc-fast" ${state.fast ? 'checked' : ''} style="margin-top:4px"><span>快速体验：直接以 Lv15 开始，解锁全部技能<br><span class="muted" style="font-size:12px">不勾选则从 Lv1 开始正常成长</span></span></label>`;
      }
      body.innerHTML = h;
      body.querySelectorAll('.opt, .sw').forEach((b) => (b.onclick = () => {
        const k = b.dataset.k; let v = b.dataset.v; Audio.sfxPlay('click', 0.6);
        if (['eyeShape', 'brows', 'mouth', 'facePaint', 'hairStyle'].includes(k)) v = +v;
        if (k === 'clan') { state.clan = +v; state.app.skin = SKINS[state.app.race][state.clan][1]; }
        else if (k === 'job') state.job = v;
        else if (k === 'race') { state.app.race = v; state.app.skin = SKINS[v][state.clan][1]; if (v === 'hrothgar') state.app.gender = 'm'; if (v === 'viera') state.app.gender = 'f'; }
        else state.app[k] = v;
        render(); onChange();
      }));
      body.querySelectorAll('.slider').forEach((s) => (s.oninput = () => { state.app[s.dataset.k] = +s.value; onChange(true); }));
      const nm = body.querySelector('#cc-name'); if (nm) { nm.oninput = () => { state.name = nm.value; }; nm.onkeydown = (e) => e.stopPropagation(); }
      const mo = body.querySelector('#cc-month'); if (mo) mo.onchange = () => (state.month = +mo.value);
      const dy = body.querySelector('#cc-day'); if (dy) dy.onchange = () => (state.day = +dy.value);
      const de = body.querySelector('#cc-deity'); if (de) de.onchange = () => (state.deity = +de.value);
      const fa = body.querySelector('#cc-fast'); if (fa) fa.onchange = () => (state.fast = fa.checked);
      $('cc-rn').textContent = race.name; $('cc-re').textContent = race.en; $('cc-rc').textContent = `${race.clans[state.clan]} · ${a.gender === 'f' ? '女性' : '男性'} · ${JOBS[state.job].name}`;
      if (this.onCreatorTab) this.onCreatorTab(cur);
    };
    tabs.forEach(([id, name]) => { const b = document.createElement('button'); b.className = 'tab'; b.dataset.t = id; b.textContent = name; b.onclick = () => { cur = id; Audio.sfxPlay('click', 0.5); render(); }; tabEl.appendChild(b); });
    render(); return render;
  },
};
