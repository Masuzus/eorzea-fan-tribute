// 游戏主循环：标题、角色创建、地图加载、玩家控制、镜头、目标选择、交互、坐骑、输入、存档
import { THREE, G, initEngine, setEnvironment, updateEngine, render, clamp, lerp, rand, pick, angDiff, disposeGroup, makeWater } from './engine.js';
import { Audio } from './audio.js';
import { Humanoid, buildModel, JOB_GEAR, DEFAULT_APP } from './character.js';
import { JOBS, GENERAL, EMOTES, RACES, SKINS, HAIR_COLORS, EYE_COLORS, PAINT_COLORS, SCALE_COLORS, NPCS, ALLIES, CITIZENS, BARKS, MOBS, QUESTS, ITEMS, TIPS, expToNext, MAX_LEVEL, weaponItem } from './data.js';
import { buildZone, aetheryte, rockVariant } from './zones.js';
import { VFX } from './vfx.js';
import { Combat, Entity, bossScript } from './combat.js';
import { UI } from './ui.js';
import { Story } from './story.js';

const $ = (id) => document.getElementById(id);
const PI = Math.PI;
const SAVE_KEY = 'eorzea-fan-save-v1', SET_KEY = 'eorzea-fan-settings-v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V3 = THREE.Vector3;

window.__eorzea = G; G.debug = { Combat, JOBS, QUESTS, Story, UI };
G.ui = UI; G.cam ={ yaw: PI, pitch: 0.32, dist: 7, tdist: 7, target: new V3() };
G.input = { keys: {}, drag: null, joy: null, bothDown: false };
G.tweens = [];
let last = performance.now(), saveT = 0, targetRing = null, chocobo = null, titleGroup = null, creator = null;

// =====================================================================
// 通用 API（供剧情与界面使用）
// =====================================================================
const game = G.game = {
  fmt(t) { const S = G.save || {}; const race = RACES.find((r) => r.id === (S.app || {}).race); return String(t).replace(/\{name\}/g, S.name || '冒险者').replace(/\{race\}/g, race ? race.name : '').replace(/\{job\}/g, S.job ? JOBS[S.job].name : ''); },
  tween(dur, fn) { return new Promise((res) => { if (G.csSkip) { fn(1); res(); return; } G.tweens.push({ t: 0, dur, fn, res }); }); },
  wait(s) { return G.csSkip ? Promise.resolve() : game.tween(s, () => { }); },
  weaponFor(tier) { return weaponItem(G.save.job, tier); },
  itemById(id) { if (ITEMS[id]) return ITEMS[id]; const m = /^w_(\w+)_(\d)$/.exec(id); return m ? weaponItem(m[1], +m[2]) : null; },
  avgIlvl() { const S = G.save; const w = game.weaponFor(S.weaponTier).ilvl, b = S.gear.body ? ITEMS[S.gear.body].ilvl : 1, e = S.gear.ear ? ITEMS[S.gear.ear].ilvl : 0; return Math.round((w * 2 + b + e) / 4); },
  eorzeaTime() { const ms = Date.now() * (3600 / 175); const h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
  save() {
    const S = G.save; if (!S) return;
    if (G.zone && !G.zone.dungeon && G.player) { S.zone = G.zone.id; S.pos = [G.player.pos.x, G.player.pos.z, G.player.rot]; }
    S.hp = G.player ? G.player.hp : null;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 存储不可用时忽略 */ }
  },
  saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(G.settings)); } catch (e) { } },
  setTarget(e) { const P = G.player; if (!P) return; if (e === P.target) return; P.target = e; if (e) Audio.sfxPlay('click', 0.4); },
  refreshStats() { computeStats(G.player); },
  addItem(id, n = 1) { const S = G.save; S.inv[id] = (S.inv[id] || 0) + n; const it = game.itemById(id); UI.chat(`获得了「${it ? it.name : id}」${n > 1 ? '×' + n : ''}。`, 'loot'); Audio.sfxPlay('loot', 0.6); },
  removeItem(id, n = 1) { const S = G.save; S.inv[id] = Math.max(0, (S.inv[id] || 0) - n); if (!S.inv[id]) delete S.inv[id]; },
  equip(id) {
    const it = ITEMS[id]; if (!it || it.type !== 'armor') return; G.save.gear[it.slot] = id; UI.chat(`装备了「${it.name}」。`, 'system'); computeStats(G.player);
    if (it.slot === 'body') rebuildPlayerModel();
  },
  useItem(id) { if (id === 'potion') game.useGeneral('potion'); },
  chatCommand(v) {
    if (v.startsWith('/')) {
      const cmd = v.split(/\s+/)[0].toLowerCase(); const em = EMOTES.find((e) => e.cmd === cmd);
      if (em) return game.emote(em.id);
      if (cmd === '/help') { UI.winHelp(); return; }
      if (cmd === '/say' || cmd === '/s') return game.say(v.slice(cmd.length).trim());
      UI.chat(`无法识别的指令：${cmd}`, 'error'); return;
    }
    game.say(v);
  },
  say(t) { if (!t) return; UI.chat(`${G.save.name}：${t}`, 'say'); G.player.bubble = { text: t, until: G.time + 5 }; },
  emote(id) {
    const em = EMOTES.find((e) => e.id === id); const P = G.player; if (!em || !P || P.dead) return;
    if (em.locked && !G.save.emotes.includes(id)) { UI.error('尚未习得这个情感动作'); return; }
    if (P.mounted) dismount();
    const T = P.target && P.target !== P ? P.target : null;
    if (T) P.face(T.pos);
    if (em.loop) P.model.setLoop(id); else { P.model.setLoop(null); P.model.play(id, em.dur); }
    P.emoteLoop = em.loop ? id : null;
    const name = G.save.name; UI.chat(game.fmt((T ? em.textT : em.text).replace('{a}', name).replace('{b}', T ? T.name : '')), 'emote');
    Story.onEmote(id, T);
  },
  useSlot(sk) {
    const P = G.player; if (!P || G.state !== 'play' || G.dialogOpen) return;
    if (sk.lv > P.level) { UI.error(`需要达到Lv${sk.lv}`); return; }
    if (P.mounted) dismount();
    if (P.emoteLoop) { P.model.setLoop(null); P.emoteLoop = null; }
    Combat.use(P, sk);
  },
  useGeneral(id) {
    const P = G.player; if (!P || G.state !== 'play' || P.dead) return;
    const g = GENERAL.find((x) => x.id === id); if (P.cd[id] > 0 && id !== 'mount') { UI.error('尚未准备好'); return; }
    if (id === 'sprint') { Combat.addStatus(P, { id: 'sprint', name: '冲刺', dur: 10, speed: 1.4, icon: g.icon }); P.cd.sprint = g.recast; VFX.ring(P.pos, '#ffe0a0', 2, 0.4); Audio.sfxPlay('buff', 0.4); }
    else if (id === 'potion') { if (!(G.save.inv.potion > 0)) { UI.error('没有回复药了'); return; } game.removeItem('potion'); Combat.heal(P, P, 0, { flat: P.effMaxHp * 0.3 }); VFX.heal(P, '#ff9ab0'); Audio.sfxPlay('heal', 0.5); P.cd.potion = g.recast; UI.chat('你使用了「回复药」。', 'system'); }
    else if (id === 'mount') { if (P.mounted) dismount(); else mount(); }
    else if (id === 'lb') Combat.useLB();
    else if (id === 'return') {
      if (G.zone.dungeon) { UI.error('副本中无法使用'); return; } if (Combat.anyCombat()) { UI.error('战斗中无法使用'); return; }
      if (P.mounted) dismount(); P.cd.return = g.recast;
      P.casting = { name: '返回', t: 0, total: 5, sk: null, circle: VFX.castCircle(P, '#7ad8ff'), npc: () => { VFX.teleport(P); Audio.sfxPlay('teleport'); setTimeout(() => loadZone('town', 'aetheryte'), 600); } };
      P.model.setLoop('cast');
    }
  },
  teleportList() { const A = G.save.attuned; return [{ id: 'limsa', name: '利姆萨·罗敏萨', cost: 80, locked: !A.limsa }, { id: 'summerford', name: '盛夏农庄', cost: 120, locked: !A.summerford }]; },
  teleport(id) {
    const P = G.player; const t = game.teleportList().find((x) => x.id === id); if (!t || t.locked) return;
    if (Combat.anyCombat()) { UI.error('战斗中无法传送'); return; }
    if (G.save.gil < t.cost) { UI.error('金币不足'); return; }
    if (P.mounted) dismount();
    G.save.gil -= t.cost; UI.chat(`支付了${t.cost}金币，开始传送至「${t.name}」。`, 'system');
    P.casting = { name: '传送', t: 0, total: 3, sk: null, circle: VFX.castCircle(P, '#7ad8ff'), npc: () => { VFX.teleport(P); Audio.sfxPlay('teleport'); setTimeout(() => loadZone(id === 'limsa' ? 'town' : 'field', 'aetheryte'), 600); } };
    P.model.setLoop('cast');
  },
  dutyParty() { return Story.partyPlan().map((k) => (k === 'player' ? { name: G.save.name, role: JOBS[G.save.job].role } : { name: ALLIES[k].name, role: ALLIES[k].role })); },
  queueDuty() { Story.queueDuty(); },
  objectiveMarkers() { return Story.markers(); },
  toTitle() { game.save(); showTitle(); },
  loadZone: (...a) => loadZone(...a),
  spawnMob: (...a) => spawnMob(...a), spawnAlly: (...a) => spawnAlly(...a), removeEntity: (e) => removeEntity(e), addEntity: (e) => addEntity(e),
  npc(id) { return G.entities.find((e) => e.npcId === id); },
  snapCamera() { snapCamera(); },
  dismount: () => dismount(),
  computeStats: (P) => computeStats(P),
  rebuildPlayerModel: () => rebuildPlayerModel(),
};

// =====================================================================
// 启动
// =====================================================================
function loadSettings() { try { const s = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); if (s) Object.assign(G.settings, s); } catch (e) { } }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }

initEngine($('gl'));
UI.init(); loadSettings(); setupInput();
Combat.on = {
  kill: (e, src) => Story.onKill(e, src),
  playerDeath: () => Story.onPlayerDeath(),
  setTarget: (e) => game.setTarget(e),
  engage: (e) => Story.onEngage(e),
  bossReset: (e) => Story.onBossReset(e),
};
document.addEventListener('pointerdown', () => { Audio.init(); Audio.setVolumes(G.settings.music, G.settings.sfx); }, { once: false });
showTitle();
requestAnimationFrame(loop);

// =====================================================================
// 世界管理
// =====================================================================
function clearWorld() {
  VFX.clear(); G.particles.clear(); Combat.reset(); UI.clearPlates();
  for (const e of G.entities.slice()) if (e !== G.player) removeEntity(e);
  if (G.player) { G.scene.remove(G.player.visual); if (chocobo) G.scene.remove(chocobo.root); }
  G.entities = G.player ? [G.player] : [];
  if (G.zone) { G.scene.remove(G.zone.group); disposeGroup(G.zone.group); G.zone = null; }
  if (titleGroup) { G.scene.remove(titleGroup); disposeGroup(titleGroup); titleGroup = null; }
  if (creator) { G.scene.remove(creator.group); creator.preview.dispose(); disposeGroup(creator.group); creator = null; }
  if (targetRing) { G.scene.remove(targetRing); }
  G.waters = []; G.fate = null; G.duty = null; UI.fateInfo(null); UI.dutyInfo(null);
}
function addEntity(e) { G.entities.push(e); G.scene.add(e.visual); e.visual.position.copy(e.pos); e.visual.rotation.y = e.rot; return e; }
function removeEntity(e) {
  const i = G.entities.indexOf(e); if (i >= 0) G.entities.splice(i, 1);
  G.scene.remove(e.visual); if (e.model && e.model !== (G.player && G.player.model)) { e.model.dispose && e.model.dispose(); }
  if (G.player && G.player.target === e) G.player.target = null;
  for (const x of G.entities) if (x.target === e) x.target = null;
}
function computeStats(P) {
  const S = G.save, job = JOBS[S.job], w = game.weaponFor(S.weaponTier || 0);
  P.level = S.level; P.weaponDmg = w.dmg;
  const had = P.maxHp; P.maxHp = Math.round((260 + S.level * 62) * (job.role === 'tank' ? 1.3 : 1) + (S.gear.body ? ITEMS[S.gear.body].hp || 0 : 0));
  P.crit = 0.1 + (S.gear.ear ? ITEMS[S.gear.ear].crit || 0 : 0);
  if (!had || P.hp > P.effMaxHp) P.hp = P.effMaxHp;
}
function playerGear() { const S = G.save; const g = { ...JOB_GEAR[S.job] }; if (S.gear.body === 'body2') { g.top = '#7a1c1c'; g.top2 = '#e8dcc0'; g.accent = '#c9a44f'; g.robe = g.robe || false; } return g; }
function makePlayer() {
  const S = G.save, job = JOBS[S.job];
  const model = new Humanoid(S.app, playerGear(), { faceRes: 512 });
  const P = new Entity({ name: S.name, kind: 'player', faction: 'party', model, level: S.level, role: job.role, job: S.job, radius: 0.5, height: model.height });
  P.maxHp = 0; computeStats(P); P.hp = S.hp && S.hp > 0 ? Math.min(S.hp, P.effMaxHp) : P.effMaxHp;
  return P;
}
function rebuildPlayerModel() { const P = G.player; const d = P.model.drawn; P.model.build(G.save.app, playerGear()); P.model.setDrawn(d, true); P.height = P.model.height; }
function spawnAlly(key, slot) {
  const A = ALLIES[key]; const model = new Humanoid(A.app, A.gear, { faceRes: 256 });
  const L = G.player.level; const hp = Math.round((260 + L * 62) * (A.role === 'tank' ? 1.35 : 1));
  const e = new Entity({ name: A.name, title: A.job, kind: 'ally', faction: 'party', model, level: L, hp, role: A.role, radius: 0.5, height: model.height, x: G.player.pos.x + rand(-2, 2), y: G.player.pos.y, z: G.player.pos.z + 2 + slot, allyKey: key });
  e.slot = slot; return addEntity(e);
}
function spawnNPC(id, def) {
  const src = def.ally ? ALLIES[def.ally] : def;
  const model = new Humanoid(src.app, src.gear, { faceRes: 256 });
  const h = G.zone.heightAt(def.pos[0], def.pos[1]) ?? 0;
  const e = new Entity({ name: def.name, title: def.title, kind: 'npc', faction: 'neutral', model, x: def.pos[0], y: h, z: def.pos[1], rot: def.rot || 0, height: model.height, radius: 0.5, npcId: id, def });
  e.homeRot = e.rot; e.hp = e.maxHp = 1;
  if (def.pose) model.setLoop(def.pose);
  addEntity(e); G.zone.walk.cb(def.pos[0], def.pos[1], 0.45); return e;
}
function spawnMob(kind, level, x, z, o = {}) {
  const def = MOBS[kind];
  const model = buildModel(def.model, { scale: def.scale, weapon: def.weapon, band: def.band, patch: Math.random() < 0.3 });
  let height = model.height, radius = model.radius ?? 0.55;
  if (def.model !== 'crab' && def.scale) { model.root.scale.multiplyScalar(def.scale); height *= def.scale; radius *= def.scale; }
  if (def.model === 'sahagin' || def.model === 'pirate' || def.model === 'captain') { model.setDrawn(true); radius = 0.55 * (def.scale || 1); }
  const y = G.zone.heightAt(x, z) ?? 0;
  const maxHp = Math.round((60 + level * 30) * def.hp);
  const e = new Entity({ name: def.name, kind: 'enemy', faction: 'enemy', model, level, hp: maxHp, x, y, z, rot: o.rot ?? rand(0, PI * 2), radius, height, def, mobKind: kind, mobDmg: def.dmg, boss: !!def.boss, mp: 0, ...o });
  e.spawn = e.pos.clone(); e.wanderR = o.wanderR ?? 5;
  if (def.boss) e.plateH = height * 0.8;
  return addEntity(e);
}

// ---------- 标题画面 ----------
function showTitle() {
  G.state = 'title'; G.cutscene = false; G.csSkip = false; clearWorld();
  if (G.player) { G.player.model.dispose(); G.player = null; G.entities = []; }
  chocobo = null;
  $('title').hidden = false; $('hud').hidden = true; $('creator').hidden = true; $('dialog').hidden = true; UI.letterbox(false); UI.loading(false);
  document.querySelectorAll('#windows .win').forEach((w) => w.remove()); UI.win = {};
  $('btn-continue').disabled = !hasSave();
  titleGroup = new THREE.Group(); G.scene.add(titleGroup);
  setEnvironment({ top: '#040914', horizon: '#18305a', bottom: '#02040a', sunDir: [0.3, 0.15, -1], sunColor: '#5a7aff', clouds: 0.35, stars: 1.2, fog: ['#0a1830', 40, 220], hemiSky: '#5a7ac8', hemiGround: '#0a0a14', hemiInt: 0.7, sunInt: 0.8, sunLight: '#8aa8ff', exposure: 1.1, bloom: 1.0 });
  const ae = aetheryte(titleGroup, 0, -2, 0, true); titleGroup.userData.ae = ae;
  const sea = makeWater(1200, { deep: '#020a18', shallow: '#0a3a6a', sky: '#18305a', seg: 60, glow: 0.4 }); sea.position.y = -1.6; titleGroup.add(sea);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2, r = rand(26, 60); const m = new THREE.Mesh(rockVariant(i), new THREE.MeshStandardMaterial({ color: '#3a4458', flatShading: true, roughness: 1 })); m.position.set(Math.cos(a) * r, rand(4, 16), Math.sin(a) * r); m.scale.set(rand(2, 5), rand(1.5, 3), rand(2, 5)); m.userData.bob = rand(0, 6); titleGroup.add(m); }
  Audio.play('title');
}
function updateTitle(dt) {
  const t = G.time * 0.06; G.camera.position.set(Math.cos(t) * 22, 5 + Math.sin(G.time * 0.2) * 1.5, Math.sin(t) * 22); G.camera.lookAt(0, 6, 0); if (innerWidth > 800) G.camera.translateX(-7);
  if (titleGroup) { titleGroup.userData.ae.update(dt); titleGroup.children.forEach((m) => { if (m.userData.bob !== undefined) { m.position.y += Math.sin(G.time + m.userData.bob) * dt * 0.3; m.rotation.y += dt * 0.05; } }); }
}
$('btn-new').onclick = () => { Audio.init(); Audio.sfxPlay('confirm'); showCreator(); };
$('btn-continue').onclick = () => { Audio.init(); Audio.sfxPlay('confirm'); const s = readSave(); if (!s) return; G.save = s; normalizeSave(s); startWorld(s.zone || 'town', null, { resume: true }); };
$('btn-help').onclick = () => { Audio.init(); UI.winHelp(); };
$('btn-sound').onclick = () => { Audio.init(); const on = G.settings.music > 0; G.settings.music = on ? 0 : 0.5; Audio.setVolumes(G.settings.music, G.settings.sfx); $('btn-sound').textContent = on ? '音乐：关' : '音乐：开'; game.saveSettings(); };
$('btn-sound').textContent = G.settings.music > 0 ? '音乐：开' : '音乐：关';
function normalizeSave(s) { s.inv = s.inv || {}; s.gear = s.gear || {}; s.quests = s.quests || {}; s.flags = s.flags || {}; s.emotes = s.emotes || []; s.attuned = s.attuned || {}; s.stats = s.stats || { kills: 0, deaths: 0, start: Date.now() }; s.weaponTier = s.weaponTier || 0; }

// ---------- 角色创建 ----------
const NAMES1 = ['艾莉丝', '露娜', '卡尔', '希尔达', '雷恩', '米娅', '奥斯卡', '诺拉', '赛勒斯', '菲奥娜', '莱昂', '缇娜', '伊恩', '索菲'], NAMES2 = ['温德', '斯塔林', '月影', '星语', '布莱克', '海风', '银翼', '晨光', '白鸥', '霜语'];
function randomName() { return `${pick(NAMES1)}·${pick(NAMES2)}`; }
function randomApp(race) {
  race = race || pick(RACES).id; const clan = Math.random() < 0.5 ? 0 : 1;
  const g = race === 'hrothgar' ? 'm' : race === 'viera' ? 'f' : Math.random() < 0.5 ? 'm' : 'f';
  return { clan, app: { ...DEFAULT_APP, race, gender: g, skin: pick(SKINS[race][clan]), hairStyle: Math.floor(rand(0, 8)), hairColor: pick(HAIR_COLORS), eyeColor: pick(EYE_COLORS), height: rand(0.2, 0.8), build: rand(0.2, 0.8), eyeShape: Math.floor(rand(0, 3)), brows: Math.floor(rand(0, 3)), mouth: Math.floor(rand(0, 3)), facePaint: Math.random() < 0.5 ? 0 : Math.floor(rand(1, 6)), paintColor: pick(PAINT_COLORS), scaleColor: pick(SCALE_COLORS), feature: rand(0.3, 0.8) } };
}
function showCreator() {
  clearWorld(); G.state = 'creator';
  $('title').hidden = true; $('creator').hidden = false;
  const grp = new THREE.Group(); G.scene.add(grp);
  setEnvironment({ sky: false, top: '#000', horizon: '#000', fog: ['#0a1020', 10, 40], hemiSky: '#9ab8e8', hemiGround: '#4a3a4a', hemiInt: 1.0, sunInt: 2.2, sunLight: '#fff4e8', sunDir: [0.4, 0.8, 0.9], exposure: 0.95, bloom: 0.28 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.3, 64), new THREE.MeshStandardMaterial({ color: '#1c1e28', roughness: 0.4, metalness: 0.4 })); floor.position.y = -0.15; floor.receiveShadow = true; grp.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.75, 64), new THREE.MeshBasicMaterial({ color: '#6ab8ff', transparent: true, opacity: 0.8 })); ring.rotation.x = -PI / 2; ring.position.y = 0.02; grp.add(ring);
  const back = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: {}, vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'varying vec3 p; void main(){ float h = normalize(p).y; vec3 c = mix(vec3(0.02,0.03,0.07), vec3(0.08,0.14,0.3), smoothstep(-0.2, 0.6, h)); gl_FragColor = vec4(c, 1.); }' }));
  grp.add(back);
  const rim = new THREE.PointLight('#5a9aff', 25, 12, 1.5); rim.position.set(-2, 3, -3); grp.add(rim);
  const warm = new THREE.PointLight('#ffb070', 10, 10, 1.5); warm.position.set(2.5, 1.5, 2); grp.add(warm);
  const fill = new THREE.PointLight('#fff4ea', 3.5, 14, 1.2); fill.position.set(-0.6, 1.7, 3.2); grp.add(fill);
  const r = randomApp('miqote');
  const state = { app: { ...r.app, gender: 'f', hairStyle: 4, hairColor: '#f4f0e8', eyeColor: '#4ab0c8', facePaint: 1, paintColor: '#b8323a' }, clan: 0, job: 'gla', name: randomName(), month: 0, day: 0, deity: 4, fast: false };
  state.app.skin = SKINS.miqote[0][1];
  const preview = new Humanoid(state.app, JOB_GEAR[state.job], { faceRes: 512 }); grp.add(preview.root);
  creator = { group: grp, preview, state, rotY: 0.35, face: false, zoom: 0, anim: 0, ring };
  let deb = null;
  const rebuild = (light) => { clearTimeout(deb); const go = () => { preview.build(state.app, JOB_GEAR[state.job]); preview.setDrawn(creator.anim === 1, true); }; if (light) deb = setTimeout(go, 60); else go(); };
  const render = UI.creator(state, rebuild);
  UI.onCreatorTab = (tab) => { creator.face = tab === 'look' || tab === 'color'; };
  $('cc-back').onclick = () => { Audio.sfxPlay('close'); showTitle(); };
  $('cc-rand').onclick = () => { const rr = randomApp(); Object.assign(state.app, rr.app); state.clan = rr.clan; Audio.sfxPlay('click'); rebuild(); render(); };
  $('cc-face').onclick = () => { creator.face = !creator.face; Audio.sfxPlay('click'); };
  $('cc-anim').onclick = () => { creator.anim = (creator.anim + 1) % 5; const a = creator.anim; preview.setLoop(null); preview.setDrawn(a === 1); if (a === 2) preview.play('wave', 2.4); if (a === 3) preview.setLoop('dance'); if (a === 4) preview.play('cheer', 2); Audio.sfxPlay('click'); };
  $('cc-done').onclick = async () => {
    if (!state.name.trim()) { UI.error('请输入角色名'); return; }
    const i = await UI.modal('confirm', '确认', `<p style="line-height:1.8;margin:0">确定以「<b>${state.name}</b>」的身份，<br>作为${RACES.find((x) => x.id === state.app.race).name}的${JOBS[state.job].name}开始冒险吗？</p>`, [{ text: '再想想' }, { text: '开始冒险', primary: true }]);
    if (i === 1) newGame(state);
  };
  Audio.play('title');
}
function updateCreator(dt) {
  const c = creator; if (!c) return; const P = c.preview;
  P.root.rotation.y = c.rotY; P.update(dt, { speed: 0 }); c.ring.rotation.z += dt * 0.2;
  if (Math.random() < 0.3) G.particles.emit(rand(-3, 3), 0, rand(-3, 3), 0, rand(0.3, 0.8), 0, new THREE.Color('#6ab8ff').multiplyScalar(1.5), 0.12, 3);
  const h = P.height, hy = (P.hipY + 0.2 * 1 + 0.3 + 0.075 + P.headR * 0.86) * P.scale;
  const face = c.face; const ty = face ? h - P.headR * P.scale * 1.1 : h * 0.52; const dist = face ? Math.max(0.55, P.headR * P.scale * 6.5) : h * 1.35 + 1.2;
  c.cy = lerp(c.cy ?? ty, ty, Math.min(1, dt * 5)); c.cd = lerp(c.cd ?? dist, dist, Math.min(1, dt * 5));
  const off = innerWidth > 700 ? 0.35 * c.cd : 0; void hy;
  G.camera.position.set(-off, c.cy + (face ? 0.02 : 0.25), c.cd); G.camera.lookAt(-off, c.cy, 0);
}
function newGame(st) {
  const fast = st.fast;
  G.save = { v: 1, name: st.name.trim(), app: { ...st.app }, clan: st.clan, job: st.job, month: st.month, day: st.day, deity: st.deity, level: fast ? 15 : 1, exp: 0, gil: fast ? 3000 : 500, inv: { potion: fast ? 10 : 3 }, gear: { body: 'body1' }, weaponTier: fast ? 1 : 0, quests: {}, flags: {}, emotes: [], mount: false, attuned: {}, zone: 'town', pos: null, stats: { kills: 0, deaths: 0, start: Date.now() } };
  G.save.inv[`w_${st.job}_${G.save.weaponTier}`] = 1; G.save.inv.body1 = 1;
  if (G.player) { G.player.model.dispose(); G.player = null; }
  startWorld('town', 'start', { intro: true });
}
async function startWorld(zone, spawn, opts) {
  $('creator').hidden = true; $('title').hidden = true;
  if (G.player) { G.player.model.dispose(); }
  clearWorld(); G.player = makePlayer(); G.entities = [G.player];
  targetRing = VFX.targetRing();
  UI.chatTab = 'all'; UI.lines = []; UI.renderChat(); UI.partyKey = null;
  UI.buildHotbars(); UI.dirtyQuests = true;
  await loadZone(zone, spawn, opts);
}

// ---------- 地图加载 ----------
async function loadZone(id, spawnKey, opts = {}) {
  const prev = G.state; G.state = 'loading';
  const names = { town: ['利姆萨·罗敏萨', 'LIMSA LOMINSA'], field: ['拉诺西亚低地', 'LOWER LA NOSCEA'], dungeon: ['天然要害沙斯塔夏溶洞', 'SASTASHA'] };
  await UI.fade(true, false, prev === 'creator' || prev === 'title' ? 400 : 500);
  UI.loading(true, { name: names[id][0], en: names[id][1] }, pick(TIPS)); $('hud').hidden = true;
  document.querySelectorAll('#windows .win').forEach((w) => { if (!w.dataset.keep) w.remove(); }); UI.win = {};
  await sleep(60);
  const P = G.player; if (P.mounted) dismount(true);
  clearWorld(); G.entities = [P];
  const Z = buildZone(id); G.zone = Z; G.scene.add(Z.group); setEnvironment(Z.env); UI.buildMap(Z);
  G.scene.add(P.visual); G.scene.add(targetRing); targetRing.visible = false;
  // 出生点
  let sp = opts.resume && G.save.pos && G.save.zone === id ? G.save.pos : Z.spawns[spawnKey] || Object.values(Z.spawns)[0];
  if (opts.resume && G.save.pos && G.save.zone === id && !Z.canWalk(sp[0], sp[1], 0.3)) sp = Object.values(Z.spawns)[0];
  P.pos.set(sp[0], Z.heightAt(sp[0], sp[1]) ?? 0, sp[1]); P.rot = sp[2] ?? 0; P.target = null; P.casting = null; P.air = false; P.vy = 0;
  P.statuses = P.statuses.filter((s) => s.keep); P.combo = null; P.model.setLoop(null); P.emoteLoop = null;
  if (P.dead) { P.dead = false; P.model.setDead(false); P.hp = Math.round(P.effMaxHp * 0.5); }
  G.cam.yaw = P.rot; G.cam.pitch = 0.3; G.cam.tdist = G.cam.dist = Math.min(8, Z.camMax);
  // NPC
  for (const [nid, def] of Object.entries(NPCS)) if (def.zone === id) { const e = spawnNPC(nid, def); e.hidden = !!def.hidden && !Story.npcVisible(nid); e.visual.visible = !e.hidden; }
  if (id === 'town') {
    const ch = new Entity({ name: '小金', title: '陆行鸟', kind: 'npc', faction: 'neutral', model: buildModel('chocobo'), x: -57.5, y: 0, z: 13.2, rot: 2.6, height: 2.3, radius: 0.8, npcId: 'chocobo_npc' }); ch.hp = ch.maxHp = 1; addEntity(ch);
    CITIZENS.forEach((c, i) => { const w = Z.wander; let x, z, k = 0; do { x = rand(w.x0, w.x1); z = rand(w.z0, w.z1); k++; } while (!Z.canWalk(x, z, 0.6) && k < 30); const m = new Humanoid(c.app, c.gear, { faceRes: 128 }); m.root.traverse((o) => { if (o.isMesh) o.castShadow = false; }); const e = new Entity({ name: c.name, kind: 'npc', faction: 'neutral', model: m, x, y: 0, z, rot: rand(0, 6), height: m.height, radius: 0.45, citizen: true }); e.hp = e.maxHp = 1; e.aiT = rand(1, 5); addEntity(e); void i; });
  }
  if (id === 'field') {
    for (const g of Z.mobSpawns) for (let i = 0; i < g.n; i++) spawnFieldMob(g);
  }
  Story.onZoneLoad(Z, opts);
  snapCamera();
  for (let i = 0; i < 3; i++) { updateEngine(0.016, P.pos); render(); await sleep(16); }
  UI.loading(false); $('hud').hidden = false; UI.partyKey = null; UI.dirtyQuests = true;
  if (!G.save.zone || !Z.dungeon) G.save.zone = Z.dungeon ? G.save.zone : id;
  G.state = 'play';
  if (!opts.intro) { UI.fade(false, false, 700); UI.zoneTitle(Z.name, Z.sub, Z.en); Audio.play(Z.music); }
  UI.chat(`进入了「${Z.name}」。`, 'system');
  await Story.onZoneEnter(Z, opts);
  game.save();
}
function spawnFieldMob(g) {
  const Z = G.zone; let x, z, k = 0; do { const a = rand(0, PI * 2), r = rand(0, g.r); x = g.x + Math.cos(a) * r; z = g.z + Math.sin(a) * r; k++; } while (!Z.canWalk(x, z, 0.8) && k < 30);
  const e = spawnMob(g.mob, Math.floor(rand(g.lv[0], g.lv[1] + 1)), x, z, { wanderR: 6 }); e.group = g; return e;
}
G.game.spawnFieldMob = spawnFieldMob;

// ---------- 坐骑 ----------
function mount() {
  const P = G.player;
  if (!G.save.mount) { UI.error('还没有坐骑。完成支线任务「陆行鸟之友」即可获得'); return; }
  if (G.zone.dungeon) { UI.error('这里无法使用坐骑'); return; }
  if (Combat.anyCombat() || P.casting) { UI.error('战斗中无法使用'); return; }
  if (!chocobo) chocobo = buildModel('chocobo');
  P.mounted = true; P.model.mounted = true; P.model.setLoop(null); P.model.setDrawn(false);
  G.scene.remove(P.model.root); chocobo.seat.add(P.model.root); P.model.root.position.set(0, 0, 0); P.model.root.rotation.set(0, 0, 0);
  const s = 1 / (chocobo.root.scale.x); P.model.root.scale.setScalar(P.model.scale * s);
  P.visual = chocobo.root; G.scene.add(chocobo.root); chocobo.play('kweh', 0.8); Audio.sfxPlay('kweh');
  VFX.burst(P.hitPos(), '#ffe070', 20, { speed: 3, size: 0.4 }); UI.chat('你骑上了陆行鸟。', 'system');
}
function dismount(silent) {
  const P = G.player; if (!P.mounted) return;
  P.mounted = false; P.model.mounted = false; chocobo.seat.remove(P.model.root); G.scene.remove(chocobo.root);
  P.model.root.scale.setScalar(P.model.scale); P.visual = P.model.root; G.scene.add(P.model.root);
  if (!silent) VFX.burst(P.hitPos(), '#ffe070', 12, { speed: 2, size: 0.3 });
}

// =====================================================================
// 主循环
// =====================================================================
// 自适应画质：持续低帧率时自动关闭辉光、阴影并降低分辨率
const perf = { t: 0, frames: 0, level: 0, low: 0, warm: 0 };
function adaptQuality(rawDt) {
  if (G.state !== 'play' || G.debugSteps) { perf.t = perf.frames = perf.warm = 0; return; }
  perf.warm += rawDt; if (perf.warm < 5) return;
  perf.t += rawDt; perf.frames++;
  if (perf.t < 4) return;
  const fps = perf.frames / perf.t; perf.t = 0; perf.frames = 0;
  if (fps >= 28) { perf.low = 0; return; }
  if (++perf.low < 2 || perf.level >= 3) return;
  perf.low = 0; perf.level++;
  if (perf.level === 1) { G.settings.bloom = false; UI.chat('检测到帧率较低，已自动关闭辉光效果。（可在系统菜单中调整）', 'system'); }
  else if (perf.level === 2) { G.renderer.setPixelRatio(1); G.composer.setPixelRatio && G.composer.setPixelRatio(1); UI.chat('已自动降低渲染分辨率以提升流畅度。', 'system'); }
  else { G.settings.shadows = false; G.sun.castShadow = false; UI.chat('已自动关闭实时阴影以提升流畅度。', 'system'); }
}
function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - last) / 1000; adaptQuality(raw);
  const dt = Math.min(0.05, raw); last = now; G.time += dt; G.dt = dt;
  for (let i = G.tweens.length - 1; i >= 0; i--) { const t = G.tweens[i]; t.t += dt; const u = G.csSkip ? 1 : Math.min(1, t.t / t.dur); t.fn(u); if (u >= 1) { G.tweens.splice(i, 1); t.res(); } }
  let focus = null;
  if (G.state === 'title') updateTitle(dt);
  else if (G.state === 'creator') updateCreator(dt);
  else if ((G.state === 'play' || G.state === 'cutscene') && G.player && G.zone) { for (let i = 0; i < (G.debugSteps || 1); i++) { if (i) G.time += dt; updateGame(dt); } focus = G.player.pos; }
  VFX.update(dt);
  updateEngine(dt, focus || new V3(0, 0, 0));
  render();
}
function updateGame(dt) {
  const P = G.player, Z = G.zone;
  const canControl = G.state === 'play' && !G.dialogOpen && !G.cutscene && !P.dead && !P.stunned;
  if (canControl) playerInput(dt); else if (!G.cutscene) P.moveSpeed = 0;
  playerPhysics(dt);
  Combat.update(dt);
  for (const e of G.entities) {
    if (e.kind === 'enemy') Combat.enemyAI(e, dt);
    else if (e.kind === 'ally' && !G.cutscene) Combat.allyAI(e, dt);
    else if (e.kind === 'npc') npcAI(e, dt);
  }
  // 视觉同步
  for (let i = G.entities.length - 1; i >= 0; i--) {
    const e = G.entities[i];
    if (e.dead && e.faction === 'enemy') { e.deadT += dt; if (e.deadT > 1.5) e.model.setOpacity(Math.max(0, 1 - (e.deadT - 1.5) / 1.2)); if (e.deadT > 2.8) { removeEntity(e); Story.onRemoved(e); continue; } }
    e.visual.position.copy(e.pos); e.visual.rotation.y = e.rot;
    if (e.hidden) { e.visual.visible = false; continue; }
    const far = e !== P && G.camera.position.distanceToSquared(e.pos) > 90 * 90;
    e.visual.visible = !far;
    if (!far && !(e === P && P.mounted)) e.model.update(dt, { speed: e.moveSpeed || 0, air: e.air });
  }
  if (P.mounted && chocobo) { chocobo.update(dt, { speed: P.moveSpeed }); P.model.update(dt, { speed: 0 }); }
  if (P.drawnT <= 0 && P.model.drawn && !Combat.anyCombat() && !P.casting) P.model.setDrawn(false);
  Z.update(dt);
  // 目标圈
  const T = P.target;
  if (T && !(T.dead && T.faction === 'enemy' && T.deadT > 1.2) && !T.hidden) { targetRing.visible = true; targetRing.position.set(T.pos.x, (Z.heightAt(T.pos.x, T.pos.z) ?? T.pos.y) + 0.06, T.pos.z); const s = clamp(T.radius * 2.6, 1.2, 12); targetRing.scale.set(s, 1, s); targetRing.rotation.y += dt * 0.6; targetRing.material.color.set(T.faction === 'enemy' ? '#ff5a4a' : T.faction === 'party' ? '#5ab0ff' : '#8aff8a'); }
  else { targetRing.visible = false; if (T && T.faction === 'enemy' && T.dead && T.deadT > 1.2) P.target = null; }
  if (G.state === 'play') { checkInteract(); checkTransitions(); }
  Story.update(dt);
  if (!G.cutscene) updateCamera(dt);
  UI.updateHUD(dt); UI.updateNameplates();
  saveT += dt; if (saveT > 20 && G.state === 'play') { saveT = 0; game.save(); }
}
function npcAI(e, dt) {
  const P = G.player;
  if (e.citizen) {
    e.aiT -= dt;
    if (e.talking) { e.moveSpeed = 0; return; }
    if (e.goal) { if (Combat.moveToward(e, e.goal[0], e.goal[1], 1.7, dt, 0.4)) e.goal = null; }
    else { e.moveSpeed = 0; if (e.aiT <= 0) { e.aiT = rand(3, 10); const w = G.zone.wander; const x = rand(w.x0, w.x1), z = rand(w.z0, w.z1); if (G.zone.canWalk(x, z, 0.6)) e.goal = [x, z]; } }
    if (!e.bubble || e.bubble.until < G.time) if (Math.random() < dt * 0.02 && e.dist(P) < 14) e.bubble = { text: pick(BARKS), until: G.time + 4 };
    return;
  }
  if (e.npcId === 'chocobo_npc') { if (Math.random() < dt * 0.05) { e.model.play('kweh', 0.8); if (e.dist(P) < 12) Audio.sfxPlay('kweh', 0.3); } return; }
  // 面向靠近的玩家
  const d = e.dist(P);
  const want = d < 5 ? Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z) : e.homeRot;
  e.rot += angDiff(e.rot, want) * Math.min(1, dt * 3);
  if (d < 6 && !e.greeted && !G.dialogOpen) { e.greeted = true; if (Math.random() < 0.5) e.model.play('wave', 1.6); }
  if (d > 10) e.greeted = false;
}

// ---------- 玩家控制 ----------
function playerInput(dt) {
  const P = G.player, k = G.input.keys; let mx = 0, mz = 0;
  if (k.KeyW || k.ArrowUp) mz += 1; if (k.KeyS || k.ArrowDown) mz -= 1; if (k.KeyA || k.ArrowLeft) mx -= 1; if (k.KeyD || k.ArrowRight) mx += 1;
  if (G.input.bothDown) mz = 1;
  if (G.input.joy) { mx += G.input.joy.x; mz += -G.input.joy.y; }
  const len = Math.hypot(mx, mz);
  if (len > 0.1) {
    const yaw = G.cam.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    let dx = fx * mz + rx * mx, dz = fz * mz + rz * mx; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
    let sp = P.mounted ? 11 : 6; const s = P.has('sprint'); if (s) sp *= s.speed; if (P.casting) sp = 0;
    if (P.casting && P.casting.t < P.casting.total - 0.35) { Combat.interrupt(P); sp = P.mounted ? 11 : 6; }
    const want = Math.atan2(dx, dz); P.rot += angDiff(P.rot, want) * Math.min(1, dt * 14);
    const step = sp * Math.min(1, len) * dt;
    tryMove(P, P.pos.x + dx * step, P.pos.z + dz * step);
    P.moveSpeed = sp * Math.min(1, len);
    if (P.emoteLoop) { P.model.setLoop(null); P.emoteLoop = null; }
    if (P.model.act && ['wave', 'bow', 'cheer', 'point'].includes(P.model.act.name)) P.model.act = null;
    if (!P.air && Math.random() < dt * 3) Audio.sfxPlay('footstep', 0.3);
  } else P.moveSpeed = 0;
}
function tryMove(e, nx, nz) {
  const Z = G.zone, r = 0.35;
  const ok = (x, z) => { if (!Z.canWalk(x, z, r)) return false; const h = Z.heightAt(x, z); if (h === null) return false; return e.air ? true : h - e.pos.y < 1.1; };
  const stuck = !Z.canWalk(e.pos.x, e.pos.z, r);
  if (ok(nx, nz) || (stuck && Z.heightAt(nx, nz) !== null)) { e.pos.x = nx; e.pos.z = nz; }
  else if (ok(nx, e.pos.z)) e.pos.x = nx; else if (ok(e.pos.x, nz)) e.pos.z = nz;
}
function playerPhysics(dt) {
  const P = G.player, Z = G.zone; const ground = Z.heightAt(P.pos.x, P.pos.z) ?? P.pos.y;
  if (P.air) { P.vy -= 24 * dt; P.pos.y += P.vy * dt; if (P.pos.y <= ground && P.vy <= 0) { P.pos.y = ground; P.air = false; P.vy = 0; } }
  else if (ground < P.pos.y - 0.7) { P.air = true; P.vy = 0; }
  else P.pos.y = lerp(P.pos.y, ground, Math.min(1, dt * 20));
}
function jump() { const P = G.player; if (P.air || P.casting || P.dead || G.dialogOpen) return; P.air = true; P.vy = P.mounted ? 9 : 7.5; if (P.mounted && chocobo) chocobo.play('flap', 0.6); if (P.emoteLoop) { P.model.setLoop(null); P.emoteLoop = null; } }

// ---------- 镜头 ----------
function updateCamera(dt) {
  const P = G.player, c = G.cam, Z = G.zone;
  c.tdist = clamp(c.tdist, 2, Z.camMax || 16); c.dist += (c.tdist - c.dist) * Math.min(1, dt * 8);
  const head = P.pos.y + (P.mounted ? 2.6 : P.height * 0.88);
  c.target.x += (P.pos.x - c.target.x) * Math.min(1, dt * 14); c.target.z += (P.pos.z - c.target.z) * Math.min(1, dt * 14); c.target.y += (head - c.target.y) * Math.min(1, dt * 8);
  placeCamera();
}
function placeCamera() {
  const c = G.cam, Z = G.zone; const cp = Math.cos(c.pitch);
  let dist = c.dist;
  if (Z && Z.dungeon) { // 洞窟中镜头不穿墙
    for (let t = 0.5; t <= c.dist; t += 0.35) { const x = c.target.x - Math.sin(c.yaw) * cp * t, z = c.target.z - Math.cos(c.yaw) * cp * t; if (Z.heightAt(x, z) === null) { dist = Math.max(1.4, t - 0.4); break; } }
    c.dist = Math.min(c.dist, dist + 0.6);
  }
  const pos = new V3(c.target.x - Math.sin(c.yaw) * cp * dist, c.target.y + Math.sin(c.pitch) * dist, c.target.z - Math.cos(c.yaw) * cp * dist);
  const h = Z ? Z.heightAt(pos.x, pos.z) : null; if (h !== null && pos.y < h + 0.5) pos.y = h + 0.5;
  G.camera.position.copy(pos); G.camera.lookAt(c.target);
}
function snapCamera() { const P = G.player, c = G.cam; c.target.set(P.pos.x, P.pos.y + P.height * 0.88, P.pos.z); c.dist = c.tdist; placeCamera(); }

// ---------- 目标选择 ----------
const ray = new THREE.Raycaster();
function pickEntity(cx, cy) {
  const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, G.camera);
  const o = ray.ray.origin, d = ray.ray.direction; let best = null, bt = 1e9; const p = new V3();
  for (const e of G.entities) {
    if (e === G.player || e.hidden || (e.dead && e.faction === 'enemy')) continue;
    for (const f of [0.25, 0.55, 0.85]) {
      p.set(e.pos.x, e.pos.y + e.height * f, e.pos.z); const t = p.clone().sub(o).dot(d); if (t < 0) continue;
      const dist = o.clone().addScaledVector(d, t).distanceTo(p);
      if (dist < Math.max(0.6, e.radius * 0.9) && t < bt) { bt = t; best = e; }
    }
  }
  return best;
}
function tabTarget() {
  const P = G.player; const f = new V3(Math.sin(G.cam.yaw), 0, Math.cos(G.cam.yaw));
  const list = Combat.enemies().filter((e) => P.dist(e) < 30 && !e.hidden).map((e) => { const d = new V3(e.pos.x - P.pos.x, 0, e.pos.z - P.pos.z); const front = d.clone().normalize().dot(f); return { e, s: P.dist(e) - front * 8 - (e.inCombat ? 5 : 0) }; }).sort((a, b) => a.s - b.s).map((x) => x.e);
  if (!list.length) { UI.error('附近没有敌人'); return; }
  const i = list.indexOf(P.target); game.setTarget(list[(i + 1) % list.length]);
}

// ---------- 交互 ----------
function nearestInteract() {
  const P = G.player, Z = G.zone; let best = null, bd = 1e9;
  const T = P.target;
  if (T && T.kind === 'npc' && !T.hidden && P.dist(T) < 6) return { kind: 'npc', e: T, label: `交谈 ${T.name}` };
  for (const e of G.entities) if (e.kind === 'npc' && !e.hidden && !e.citizen) { const d = P.dist(e); if (d < 3.6 && d < bd) { bd = d; best = { kind: 'npc', e, label: `交谈 ${e.name}` }; } }
  for (const it of Z.interacts) { const d = Math.hypot(P.pos.x - it.x, P.pos.z - it.z); if (d < it.r && d < bd + 1) { bd = d; best = { kind: 'obj', it, label: Story.interactLabel(it) }; } }
  const st = Story.extraInteract(P); if (st) best = st;
  return best;
}
function checkInteract() { const n = nearestInteract(); UI.prompt(n && !G.dialogOpen && !UI.anyWin() ? n.label : null); }
async function interact() {
  if (G.dialogOpen) { if (UI.dialogAdvance) UI.dialogAdvance(); return; }
  if (G.state !== 'play') return;
  const n = nearestInteract(); if (!n) return;
  const P = G.player; if (P.mounted) dismount();
  if (n.kind === 'npc') { const e = n.e; P.face(e.pos); game.setTarget(e); if (e.citizen) { e.talking = true; await UI.dialog([[e.name, pick(BARKS)]]); e.talking = false; return; } await Story.talk(e); }
  else if (n.kind === 'obj') await Story.interactObj(n.it);
  else if (n.run) await n.run();
}
function checkTransitions() {
  const P = G.player; for (const t of G.zone.transitions) if (P.pos.x > t.x0 && P.pos.x < t.x1 && P.pos.z > t.z0 && P.pos.z < t.z1) {
    if (Combat.anyCombat()) { UI.error('战斗中无法离开'); P.pos.x += (P.pos.x < (t.x0 + t.x1) / 2 ? 1 : -1) * 0; return; }
    loadZone(t.to, t.spawn); return;
  }
}

// =====================================================================
// 输入
// =====================================================================
function setupInput() {
  const cv = $('gl');
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.code; G.input.keys[k] = true;
    if (G.state === 'cutscene' || G.cutscene) { if (k === 'Escape') { G.csSkip = true; if (UI.dialogAdvance) { UI.dialogAdvance(); UI.dialogAdvance && UI.dialogAdvance(); } } else if (k === 'Space' || k === 'Enter' || k === 'KeyF') { UI.dialogAdvance && UI.dialogAdvance(); } e.preventDefault(); return; }
    if (G.state !== 'play') { if (k === 'Escape') UI.closeTop(); return; }
    if (G.dialogOpen) { if (k === 'Space' || k === 'Enter' || k === 'KeyF' || k === 'NumpadEnter') { UI.dialogAdvance && UI.dialogAdvance(); e.preventDefault(); } return; }
    const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'].indexOf(k);
    if (idx >= 0) {
      e.preventDefault();
      if (e.shiftKey) { const g = GENERAL[idx]; if (g) { UI.pressSlot(idx, 2); game.useGeneral(g.id); } }
      else { const sk = JOBS[G.save.job].skills[idx]; if (sk) { UI.pressSlot(idx, 1); game.useSlot(sk); } }
      return;
    }
    switch (k) {
      case 'Tab': e.preventDefault(); tabTarget(); break;
      case 'Escape': if (!UI.closeTop()) { if (G.player.target) game.setTarget(null); else UI.toggle('system'); } break;
      case 'KeyF': case 'NumpadEnter': interact(); break;
      case 'Space': e.preventDefault(); jump(); break;
      case 'KeyR': game.useGeneral('sprint'); break;
      case 'KeyV': game.useGeneral('mount'); break;
      case 'KeyC': UI.toggle('char'); break; case 'KeyI': UI.toggle('inv'); break; case 'KeyJ': UI.toggle('journal'); break;
      case 'KeyM': UI.toggle('map'); break; case 'KeyU': UI.toggle('duty'); break; case 'KeyE': UI.toggle('emote'); break;
      case 'Enter': e.preventDefault(); $('chat-input').focus(); break;
    }
  });
  addEventListener('keyup', (e) => { G.input.keys[e.code] = false; });
  addEventListener('blur', () => { G.input.keys = {}; G.input.drag = null; G.input.bothDown = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  let btns = 0;
  cv.addEventListener('pointerdown', (e) => {
    btns = e.buttons; G.input.bothDown = (e.buttons & 3) === 3;
    G.input.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, id: e.pointerId, button: e.button };
    try { cv.setPointerCapture(e.pointerId); } catch (er) { }
  });
  cv.addEventListener('pointermove', (e) => {
    const d = G.input.drag; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
    G.input.bothDown = (e.buttons & 3) === 3;
    if (G.state === 'creator' && creator) { creator.rotY += dx * 0.01; return; }
    if (G.state !== 'play' || G.cutscene) return;
    G.cam.yaw -= dx * 0.0055; G.cam.pitch = clamp(G.cam.pitch + dy * 0.0045, -0.45, 1.35);
  });
  cv.addEventListener('pointerup', (e) => {
    const d = G.input.drag; G.input.bothDown = false; btns = e.buttons;
    if (d && d.moved < 6 && G.state === 'play' && !G.cutscene) {
      const hit = pickEntity(e.clientX, e.clientY);
      if (hit) { if (hit === G.player.target && hit.kind === 'npc' && G.player.dist(hit) < 6) interact(); else game.setTarget(hit); }
      else if (d.button === 0) game.setTarget(null);
    }
    G.input.drag = null; void btns;
  });
  cv.addEventListener('wheel', (e) => { if (G.state === 'creator' && creator) { creator.face = e.deltaY < 0; return; } G.cam.tdist = clamp(G.cam.tdist + e.deltaY * 0.01, 2, G.zone ? G.zone.camMax : 16); }, { passive: true });
  // 触屏
  if ('ontouchstart' in window) {
    $('touch').style.display = 'block'; const joy = $('joy'), knob = joy.querySelector('i');
    const setJoy = (t) => { const r = joy.getBoundingClientRect(); let x = (t.clientX - r.left - r.width / 2) / (r.width / 2), y = (t.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } G.input.joy = { x, y }; knob.style.transform = `translate(${x * 35}px, ${y * 35}px)`; };
    joy.addEventListener('pointerdown', (e) => { joy.setPointerCapture(e.pointerId); setJoy(e); });
    joy.addEventListener('pointermove', (e) => { if (G.input.joy) setJoy(e); });
    joy.addEventListener('pointerup', () => { G.input.joy = null; knob.style.transform = ''; });
    $('tb-f').onclick = () => interact(); $('tb-tab').onclick = () => tabTarget(); $('tb-j').onclick = () => jump();
  }
}
