// 剧情与玩法流程：任务、对话、过场动画、以太之光、采集、FATE、副本（沙斯塔夏溶洞）、战利品
import { THREE, G, rand, pick, clamp } from './engine.js';
import { Audio } from './audio.js';
import { Combat, bossScript } from './combat.js';
import { VFX } from './vfx.js';
import { UI, icon, roleIcon } from './ui.js';
import { QUESTS, NPCS, ALLIES, JOBS, ITEMS, expToNext, MAX_LEVEL, weaponItem } from './data.js';

const PI = Math.PI, V3 = THREE.Vector3;
const Q = () => G.save.quests;
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export const Story = {
  markT: 0, fateCD: 15, gathers: [],
  sorted() { return Object.values(QUESTS).sort((a, b) => (a.type === 'msq' ? 0 : 1) - (b.type === 'msq' ? 0 : 1)); },
  available(q) { return !Q()[q.id] && (q.prereq || []).every((p) => Q()[p] && Q()[p].status === 'done'); },
  npcVisible(id) { if (id === 'thancred_npc' || id === 'yshtola_npc') return !!(Q().q4 && Q().q4.status === 'done' && Q().q5); return true; },
  npcMark(id) {
    for (const q of this.sorted()) { const st = Q()[q.id]; if (!st || st.status !== 'active') continue; const s = q.steps[st.step]; if (s && (s.type === 'talk' || s.type === 'emote') && s.npc === id) return q.type === 'msq' ? 'msq-t' : 'side-t'; if (s && s.type === 'duty' && (id === 'yshtola_npc')) return 'msq-t'; }
    for (const q of this.sorted()) if (q.giver === id && this.available(q)) return q.type === 'msq' ? 'msq' : 'side';
    return null;
  },
  // ---------- 每帧 ----------
  update(dt) {
    this.markT -= dt;
    if (this.markT <= 0) {
      this.markT = 0.4;
      for (const e of G.entities) if (e.kind === 'npc' && e.npcId && NPCS[e.npcId]) { e.qmark = this.npcMark(e.npcId); const h = !!NPCS[e.npcId].hidden && !this.npcVisible(e.npcId); if (h !== !!e.hidden) { e.hidden = h; e.visual.visible = !h; } }
    }
    for (const e of Combat.party()) if (e.kb) { const k = e.kb; const step = Math.min(k.t, dt); k.t -= dt; const nx = e.pos.x + k.dx * 20 * step, nz = e.pos.z + k.dz * 20 * step; if (G.zone.canWalk(nx, nz, 0.3)) { e.pos.x = nx; e.pos.z = nz; } if (k.t <= 0) e.kb = null; }
    for (const g of this.gathers) { if (!g.active) { g.respawn -= dt; if (g.respawn <= 0) { g.active = true; g.mesh.visible = true; } continue; } g.mesh.rotation.y += dt; if (this.gatherActive()) VFX.sparkle(new V3(g.x, g.y + 0.3, g.z), '#9aff8a'); }
    if (G.duty && G.duty.chest && !G.duty.chest.opened) VFX.sparkle(new V3(0, 0.8, -226), '#ffe070');
    this.updateFate(dt); this.updateDuty(dt);
  },
  // ---------- 任务流程 ----------
  async accept(q) {
    Q()[q.id] = { status: 'active', step: 0, count: 0 };
    UI.banner('accept', q.title, 'QUEST ACCEPTED'); Audio.sfxPlay('quest');
    UI.chat(`接受了任务「${q.title}」。`, 'quest'); UI.chat(`▶ ${q.steps[0].text}`, 'quest');
    if (q.giveItem) G.game.addItem(q.giveItem);
    UI.dirtyQuests = true; this.markT = 0; G.game.save();
    if (q.id === 'q5') await this.scionsScene();
    await this.syncAttune();
  },
  // 先共鸣、后接任务时，「与以太之光共鸣」这一步视为已完成
  async syncAttune() {
    const st = Q().q2;
    if (G.save.attuned.limsa && st && st.status === 'active' && st.step === 0) {
      UI.chat('你已经与以太之光「利姆萨·罗敏萨」共鸣过了。', 'quest');
      await this.advance(QUESTS.q2);
    }
  },
  async advance(q) {
    const st = Q()[q.id]; st.step++; st.count = 0; UI.dirtyQuests = true; this.markT = 0;
    if (st.step >= q.steps.length) return this.complete(q);
    UI.chat(`任务「${q.title}」更新：${q.steps[st.step].text}`, 'quest'); Audio.sfxPlay('quest', 0.5);
    G.game.save();
  },
  async complete(q) {
    const st = Q()[q.id]; st.status = 'done';
    await UI.questReward(q);
    UI.banner('complete', q.title, 'QUEST COMPLETE'); Audio.sfxPlay('questdone');
    UI.chat(`完成了任务「${q.title}」！`, 'quest');
    const r = q.rewards;
    if (r.gil) { G.save.gil += r.gil; UI.chat(`获得了${r.gil}金币。`, 'loot'); }
    (r.items || []).forEach(([id, n]) => G.game.addItem(id, n));
    if (r.weapon) this.giveWeapon(r.weapon);
    if (r.mount) { G.save.mount = true; UI.chat('获得了坐骑「陆行鸟」！按 V 键或热键栏第二行召唤。', 'loot'); }
    if (r.emote && !G.save.emotes.includes(r.emote)) { G.save.emotes.push(r.emote); UI.chat('习得了情感动作「跳舞」！（/dance）', 'loot'); }
    if (r.exp) this.gainExp(r.exp);
    UI.dirtyQuests = true; this.markT = 0; G.game.save();
    if (q.id === 'q2') UI.chat('提示：广场西侧的冒险者导师「埃尔莎」有事找你。', 'quest');
    if (q.id === 'q5') await this.endingScene();
  },
  giveWeapon(tier) {
    const S = G.save; if (tier <= S.weaponTier) return;
    S.weaponTier = tier; const w = weaponItem(S.job, tier); S.inv[w.id] = 1; UI.chat(`获得了「${w.name}」，已自动装备。`, 'loot'); Audio.sfxPlay('loot'); G.game.computeStats(G.player);
  },
  gainExp(n) {
    const S = G.save; if (S.level >= MAX_LEVEL || n <= 0) return;
    S.exp += n; UI.chat(`获得了${n}点经验值。`, 'system'); UI.flytext(G.player, `+${n} EXP`, 'exp');
    let up = false;
    while (S.level < MAX_LEVEL && S.exp >= expToNext(S.level)) {
      S.exp -= expToNext(S.level); S.level++; up = true;
      JOBS[S.job].skills.filter((s) => s.lv === S.level).forEach((s) => UI.chat(`习得了新技能「${s.name}」！`, 'levelup'));
    }
    if (S.level >= MAX_LEVEL) S.exp = 0;
    if (up) {
      const P = G.player; G.game.computeStats(P); P.hp = P.effMaxHp; P.mp = P.maxMp;
      VFX.levelUp(P); Audio.sfxPlay('levelup'); UI.banner('levelup', 'LEVEL UP', `${JOBS[S.job].name} Lv${S.level}`);
      UI.chat(`${JOBS[S.job].name}的等级提升到了${S.level}级！`, 'levelup');
      for (const a of Combat.party()) if (a !== P) { a.level = S.level; }
    }
    UI.updateExp();
  },
  // ---------- 对话 ----------
  async talk(e) {
    const id = e.npcId; if (!id) return;
    if (id === 'chocobo_npc') { e.model.play('kweh', 0.8); Audio.sfxPlay('kweh'); UI.chat('小金：Kweh!', 'npc'); return; }
    const def = NPCS[id]; e.model.play('talk', 1.6); e.rot = Math.atan2(G.player.pos.x - e.pos.x, G.player.pos.z - e.pos.z);
    for (const q of this.sorted()) {
      const st = Q()[q.id]; if (!st || st.status !== 'active') continue; const s = q.steps[st.step]; if (!s) continue;
      if (s.type === 'talk' && s.npc === id) {
        if (s.takeItem && !(G.save.inv[s.takeItem] > 0)) { await UI.dialog([[def.name, '……东西好像还没带来呢。']]); return; }
        await UI.dialog(s.lines); if (s.takeItem) G.game.removeItem(s.takeItem, G.save.inv[s.takeItem]);
        await this.advance(q); return;
      }
      if (s.type === 'emote' && s.npc === id) { await UI.dialog([[def.name, q.offer[q.offer.length - 1][1]]]); return; }
      if (s.type === 'duty' && (id === 'yshtola_npc' || id === 'thancred_npc')) {
        const i = await UI.choice(def.name, '准备好了吗？我们随时可以出发前往沙斯塔夏溶洞。', ['现在出发！', '再准备一下']);
        if (i === 0) this.queueDuty(); return;
      }
    }
    const q = this.sorted().find((x) => x.giver === id && this.available(x));
    if (q) {
      if (q.auto) { await this.accept(q); return; }
      await UI.dialog(q.offer); const ok = await UI.questOffer(q);
      if (ok) await this.accept(q); else await UI.dialog([[def.name, '是吗……如果改变主意了，随时来找我。']]);
      return;
    }
    const mine = this.sorted().find((x) => x.giver === id && Q()[x.id] && Q()[x.id].status === 'active');
    if (mine) { await UI.dialog([[def.name, `拜托你了。（${UI.stepText(mine, Q()[mine.id])}）`]]); return; }
    if (id === 'rexa') {
      const i = await UI.choice(def.name, '欢迎光临！要来点回复药吗？冒险路上可少不了它。', ['购买回复药 ×3（150金币）', '随便看看']);
      if (i === 0) { if (G.save.gil >= 150) { G.save.gil -= 150; G.game.addItem('potion', 3); } else UI.error('金币不足'); }
      return;
    }
    await UI.dialog([[def.name, pick(def.lines)]]);
  },
  onEmote(id, T) {
    if (!T || !T.npcId) return;
    for (const q of this.sorted()) {
      const st = Q()[q.id]; if (!st || st.status !== 'active') continue; const s = q.steps[st.step];
      if (s && s.type === 'emote' && s.npc === T.npcId && s.emote === id && G.player.dist(T) < 9) {
        setTimeout(async () => { T.model.play('cheer', 1.6); await UI.dialog(s.lines); T.model.setLoop('dance'); setTimeout(() => T.model.setLoop(null), 4500); await this.advance(q); }, 900);
        return;
      }
    }
    if (T.kind === 'npc' && !T.citizen && Math.random() < 0.7) setTimeout(() => T.model.play(id === 'bow' ? 'bow' : 'wave', 1.8), 600);
  },
  // ---------- 交互物 ----------
  interactLabel(it) {
    const A = G.save.attuned;
    if (it.id === 'aetheryte') return A.limsa ? '以太之光（传送）' : '与以太之光共鸣';
    if (it.id === 'aetheryte2') return A.summerford ? '以太之晶（传送）' : '与以太之晶共鸣';
    if (it.id === 'sastasha') return '调查 沙斯塔夏溶洞';
    return it.label;
  },
  async interactObj(it) {
    const A = G.save.attuned;
    if (it.id === 'aetheryte') { if (!A.limsa) await this.attuneScene(); else if (Q().q2 && Q().q2.status === 'active' && Q().q2.step === 0) await this.syncAttune(); else UI.toggle('map'); return; }
    if (it.id === 'aetheryte2') {
      if (!A.summerford) { A.summerford = true; G.player.model.play('attune', 2); VFX.teleport(G.player); Audio.sfxPlay('teleport'); UI.banner('duty', '以太之晶「盛夏农庄」', 'AETHERYTE ATTUNED'); UI.chat('与以太之晶「盛夏农庄」共鸣了！', 'system'); G.game.save(); }
      else UI.toggle('map'); return;
    }
    if (it.id === 'sastasha') {
      const st = Q().q5; if ((st && st.status === 'active' && st.step === 0) || G.save.flags.sastasha) { const i = await UI.choice('', '洞窟深处传来海浪与人声的回响……要申请进入「天然要害沙斯塔夏溶洞」吗？', ['申请进入', '离开']); if (i === 0) this.queueDuty(); }
      else await UI.dialog([['', '（洞窟深处传来海浪的回声……现在还没有进入的理由。）']]);
    }
  },
  gatherActive() { const st = Q().s3; return st && st.status === 'active' && st.step === 0; },
  extraInteract(P) {
    if (G.zone.id === 'field') for (const g of this.gathers) if (g.active && Math.hypot(P.pos.x - g.x, P.pos.z - g.z) < 2.6) return { kind: 'run', label: '采集 基萨尔野菜', run: () => this.gather(g) };
    if (G.duty && G.duty.chest && !G.duty.chest.opened && Math.hypot(P.pos.x, P.pos.z + 226) < 3.5) return { kind: 'run', label: '打开宝箱', run: () => this.openChest() };
    return null;
  },
  async gather(g) {
    if (!this.gatherActive()) { await UI.dialog([['', '这里长着基萨尔野菜。（现在不需要采集）']]); return; }
    const P = G.player; G.dialogOpen = true; P.model.setLoop('kneel'); await sleep(1300); P.model.setLoop(null); G.dialogOpen = false;
    g.active = false; g.mesh.visible = false; g.respawn = 40; VFX.burst(new V3(g.x, g.y + 0.4, g.z), '#9aff8a', 14, { speed: 2, size: 0.3 });
    G.game.addItem('gysahl');
    const q = QUESTS.s3, st = Q().s3; st.count++; UI.dirtyQuests = true; UI.chat(`采集 基萨尔野菜 ${st.count}/3`, 'quest');
    if (st.count >= 3) await this.advance(q);
  },
  // ---------- 击杀 ----------
  onKill(e, src) {
    const P = G.player; G.save.stats.kills++;
    const party = Combat.party().map((x) => x.id); const mine = [...e.enmity.keys()].some((id) => party.includes(id)) || src === P;
    if (mine && !e.def.passiveAdd) {
      const diff = P.level - e.level; const mul = diff > 5 ? 0.2 : diff < -3 ? 1.3 : 1;
      this.gainExp(Math.round((25 + e.level * 12) * (e.boss ? 6 : e.def.fateBoss ? 4 : 1) * mul));
      for (const q of this.sorted()) {
        const st = Q()[q.id]; if (!st || st.status !== 'active') continue; const s = q.steps[st.step];
        if (s && s.type === 'kill' && s.mob === e.mobKind) { st.count++; UI.chat(`${s.text} ${Math.min(st.count, s.count)}/${s.count}`, 'quest'); UI.dirtyQuests = true; if (st.count >= s.count) this.advance(q); }
      }
    }
    if (e.fate && G.fate) this.fateKill(e);
    if (G.duty) this.dutyKill(e);
  },
  onRemoved(e) { if (e.group && G.zone && G.zone.id === 'field') Combat.later(rand(18, 30), () => { if (G.zone && G.zone.id === 'field') G.game.spawnFieldMob(e.group); }); },
  async onPlayerDeath() {
    G.save.stats.deaths++; UI.banner('death', '无法战斗', 'KNOCKED OUT');
    if (G.duty) { UI.chat(Combat.party().some((x) => !x.dead && x.role === 'healer') ? '等待治疗职业的复活……' : '你陷入了无法战斗状态。', 'system'); return; }
    await sleep(2200);
    const A = G.save.attuned; const toField = G.zone.id === 'field' && A.summerford;
    await UI.modal('dead', '无法战斗', `<p style="margin:0;line-height:1.8">你陷入了无法战斗状态。<br>要返回${toField ? '以太之晶「盛夏农庄」' : '利姆萨·罗敏萨的以太之光'}吗？</p>`, [{ text: '返回返回点', primary: true }]);
    const P = G.player; Combat.revive(P, 0.5); G.game.loadZone(toField ? 'field' : 'town', 'aetheryte');
  },
  onEngage(e) {
    if (e.pack) for (const m of e.pack) if (m !== e && !m.dead) Combat.engage(m, G.player);
    if (e.boss && G.duty) this.bossEngage(e);
  },
  onBossReset(e) { if (G.duty && e.boss) this.clearBossFight(e, false); },
  // ---------- 地图事件 ----------
  onZoneLoad(Z) {
    this.gathers = [];
    if (Z.id === 'field') {
      for (const [x, z] of Z.gather) {
        const g = new THREE.Group(); const y = Z.heightAt(x, z); g.position.set(x, y, z);
        const m = new THREE.MeshStandardMaterial({ color: '#7ad060', emissive: '#2a8a20', emissiveIntensity: 0.8 });
        for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 5), m); c.position.set(Math.cos(i) * 0.12, 0.3, Math.sin(i) * 0.12); c.rotation.set(Math.cos(i) * 0.4, 0, Math.sin(i) * 0.4); g.add(c); }
        const root = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: '#e8e0b0' })); root.position.y = 0.05; g.add(root);
        Z.group.add(g); this.gathers.push({ x, z, y, mesh: g, active: true, respawn: 0 });
      }
      this.fateCD = Math.min(this.fateCD, 20);
    }
    if (Z.dungeon) this.dutySetup();
  },
  async onZoneEnter(Z, opts) {
    if (opts.intro) return this.openingScene();
    if (Z.dungeon) { UI.banner('duty', '任务开始', 'DUTY COMMENCED'); Audio.sfxPlay('duty'); UI.chat('「天然要害沙斯塔夏溶洞」任务开始。时间限制60分钟。', 'system'); UI.chat('提示：跟随队友深入溶洞，击败三名头目。靠近敌人或攻击即可开战。', 'quest'); }
    if (Z.id === 'field' && !G.save.flags.fieldHint) { G.save.flags.fieldHint = true; UI.chat('提示：黄色名字的魔物不会主动攻击，红色的会。按 Tab 选择目标后使用技能。', 'quest'); }
    if (opts.fromDuty) { UI.chat('提示：去溺水海豚亭与雅·修特拉交谈。', 'quest'); }
    await this.syncAttune();
  },
  // ---------- 过场动画 ----------
  csBegin() { G.cutscene = true; G.state = 'cutscene'; G.csSkip = false; UI.letterbox(true); $('hud').hidden = true; UI.prompt(null); for (const w of Object.keys(UI.win)) UI.closeWin(w); },
  csEnd() { G.cutscene = false; G.state = 'play'; G.csSkip = false; UI.letterbox(false); $('hud').hidden = false; UI.csText(null); $('dialog').hidden = true; G.dialogOpen = false; G.game.snapCamera(); UI.partyKey = null; },
  async camMove(p0, l0, p1, l1, dur) {
    const a = new V3(...p0), b = new V3(...p1), la = new V3(...l0), lb = new V3(...l1), tmp = new V3();
    await G.game.tween(dur, (u) => { const e = u * u * (3 - 2 * u); G.camera.position.lerpVectors(a, b, e); G.camera.lookAt(tmp.lerpVectors(la, lb, e)); });
  },
  async openingScene() {
    const P = G.player; this.csBegin();
    Audio.play('title');
    for (const t of ['……聆听……', '……感受……', '……思考……']) { UI.csText(t); if (!G.csSkip) Audio.sfxPlay('teleport', 0.25); await G.game.wait(2.4); UI.csText(null); await G.game.wait(0.9); }
    UI.csText('光之战士啊……愿水晶照亮你的旅途。'); await G.game.wait(3); UI.csText(null); await G.game.wait(0.6);
    Audio.play('town');
    G.camera.position.set(170, 42, 150); G.camera.lookAt(0, 8, -20);
    UI.fade(false, false, 1800); if (!G.csSkip) UI.zoneTitle('利姆萨·罗敏萨', '海雄旅团的都市', 'LIMSA LOMINSA');
    await this.camMove([170, 42, 150], [0, 8, -20], [90, 9, 24], [30, 5, -10], 8);
    const ry = G.game.npc('ryssfloh');
    P.face(ry.pos); ry.rot = Math.atan2(P.pos.x - ry.pos.x, P.pos.z - ry.pos.z);
    await this.camMove([90, 9, 24], [30, 5, -10], [55.5, 2.6, -5.5], [50.5, 1.6, 1.6], 3);
    ry.model.play('talk', 3);
    await UI.dialog([
      ['瑞斯弗洛船长', '哟，醒啦？{name}，咱们到了——海雄旅团的都市，利姆萨·罗敏萨！'],
      ['瑞斯弗洛船长', '瞧瞧这白色的城墙、这满港的帆……在艾欧泽亚，再没有比这儿更热闹的港口了。'],
      ['瑞斯弗洛船长', '你是来当冒险者的吧？那就去上层甲板的「溺水海豚亭」找巴德隆。那老家伙管着这里的冒险者行会。'],
      ['瑞斯弗洛船长', '对了，路过以太之光广场时，别忘了看看那块大水晶。祝你好运，冒险者！'],
    ], { cs: true });
    UI.fade(false, false, 10);
    this.csEnd(); Audio.play('town');
    await this.accept(QUESTS.q1);
    UI.chat('欢迎来到艾欧泽亚！这是一部《最终幻想XIV》的粉丝致敬作品。', 'system');
    const body = `<div class="help-grid"><div><kbd>WASD</kbd></div><div>移动（按住鼠标拖动旋转视角）</div><div><kbd>F</kbd></div><div>与 NPC 交谈、调查物体</div><div><kbd>Tab</kbd></div><div>选择敌人，<kbd>1</kbd>~<kbd>=</kbd> 使用技能</div><div><kbd>M</kbd></div><div>地图，<kbd>J</kbd> 任务日志，<kbd>U</kbd> 任务搜索器</div></div><p class="desc" style="margin-top:12px">头顶有橙色火焰标记的 NPC 可以接受<b style="color:#ffcf6a">主线任务</b>，黄色标记是<b style="color:#ffe070">支线任务</b>。右上方的小地图会指示目标方向。</p>`;
    UI.modal('tut', '冒险指南', body, [{ text: '出发吧！', primary: true }], { width: '460px' });
  },
  async attuneScene() {
    const P = G.player; this.csBegin(); P.face(new V3(0, 0, 0)); P.model.play('attune', 3.2);
    const a0 = Math.atan2(P.pos.x, P.pos.z);
    await G.game.tween(4, (u) => { const a = a0 + 0.3 + u * 1.3; G.camera.position.set(Math.sin(a) * 13, 3 + u * 3, Math.cos(a) * 13); G.camera.lookAt(0, 5, 0); if (Math.random() < 0.5) G.particles.emit(rand(-3, 3), 1, rand(-3, 3), 0, rand(3, 7), 0, new THREE.Color('#8ae0ff').multiplyScalar(2), 0.4, 1.5); });
    VFX.pillar(new V3(0, 0, 0), '#8ae0ff', 16, 2, 3.5); VFX.teleport(P); Audio.sfxPlay('teleport');
    await G.game.wait(0.8);
    await UI.fade(true, true, 700);
    UI.csText('……你听见了吗？……'); await G.game.wait(2.3);
    UI.csText('……光之子啊……不要害怕……'); await G.game.wait(2.5);
    UI.csText('……聆听……感受……然后，思考……'); await G.game.wait(2.5); UI.csText(null);
    await UI.fade(false, true, 900);
    this.csEnd();
    G.save.attuned.limsa = true; UI.banner('duty', '以太之光「利姆萨·罗敏萨」', 'AETHERYTE ATTUNED');
    UI.chat('与以太之光「利姆萨·罗敏萨」共鸣了！打开地图（M）即可传送。', 'system');
    const st = Q().q2; if (st && st.status === 'active' && st.step === 0) await this.advance(QUESTS.q2);
    G.game.save();
  },
  async scionsScene() {
    const P = G.player; const th = G.game.npc('thancred_npc'), ys = G.game.npc('yshtola_npc');
    for (const n of [th, ys]) if (n) { n.hidden = false; n.visual.visible = true; }
    if (!th || !ys) return;
    this.csBegin();
    P.pos.set(0, 6, -47.5); P.rot = PI; th.rot = Math.atan2(P.pos.x - th.pos.x, P.pos.z - th.pos.z); ys.rot = Math.atan2(P.pos.x - ys.pos.x, P.pos.z - ys.pos.z);
    await this.camMove([4, 9.5, -41], [0, 7.4, -52], [2.5, 8.2, -45.5], [0, 7.4, -52], 3);
    const sp = (n) => { const e = n === '桑克瑞德' ? th : ys; e.model.play('talk', 2); };
    await UI.dialog([
      ['桑克瑞德', '你就是最近在拉诺西亚大显身手的冒险者？久仰了。我叫桑克瑞德。'],
      ['雅·修特拉', '我是雅·修特拉。我们是「拂晓血盟」的成员——一个致力于守护艾欧泽亚的组织。'],
      ['雅·修特拉', '……你身上的以太流动，很特别。与以太之光共鸣时，你是否看到了不属于自己的景象？'],
      ['桑克瑞德', '果然。那是「超越之力」。拥有这种力量的人，不会受到蛮神「精炼」的影响。'],
      ['雅·修特拉', '我们查到，沙哈金族正与海盗「蛇蝎帮」勾结，在沙斯塔夏溶洞里囤积水晶。一旦数量足够——'],
      ['桑克瑞德', '海洋之神「利维亚桑」就会降临。到那时，整个拉诺西亚都会被卷入战火。'],
      ['桑克瑞德', '所以，我们想请你一起去溶洞走一趟。拂晓的同伴也会与你同行。'],
      ['雅·修特拉', '准备好了就打开「任务搜索器」（U键），或者直接来找我。……别让我们等太久哦。'],
    ], { cs: true, speaker: sp });
    this.csEnd();
    UI.chat('打开任务搜索器（U）申请「天然要害沙斯塔夏溶洞」，或与雅·修特拉交谈直接出发。', 'quest');
  },
  async endingScene() {
    const P = G.player; this.csBegin(); Audio.play('ending');
    const p0 = G.camera.position.clone();
    await this.camMove([p0.x, p0.y, p0.z], [0, 7, -52], [30, 70, 80], [0, 10, -30], 7);
    UI.csText('……光之战士啊……'); await G.game.wait(2.6);
    UI.csText('你的旅途，才刚刚开始。'); await G.game.wait(3); UI.csText(null);
    const S = G.save; const mins = Math.max(1, Math.round((Date.now() - S.stats.start) / 60000));
    const cr = document.createElement('div'); cr.className = 'credits';
    cr.innerHTML = `<div class="roll"><h2>艾欧泽亚</h2><p>第一章「拂晓的来访者」 完</p><p>&nbsp;</p><p>光之战士　${esc(S.name)}</p><p>${JOBS[S.job].name}　Lv${S.level}</p><p>讨伐魔物　${S.stats.kills}</p><p>无法战斗　${S.stats.deaths} 次</p><p>冒险时长　${mins} 分钟</p><p>&nbsp;</p><p>—— 登场人物 ——</p><p>瑞斯弗洛船长 · 巴德隆 · 埃尔莎</p><p>桑克瑞德 · 雅·修特拉 · 阿尔菲诺 · 伊达</p><p>&nbsp;</p><p>本作为《最终幻想XIV》的非官方粉丝致敬作品</p><p>与 SQUARE ENIX 无任何关联</p><p>全部画面与音乐均由程序实时生成</p><div class="s">THANK YOU FOR PLAYING</div><p style="margin-top:30px">To be continued……</p></div>`;
    $('app').appendChild(cr); requestAnimationFrame(() => cr.classList.add('on'));
    await new Promise((res) => { const t = setTimeout(res, 27000); cr.onclick = () => { clearTimeout(t); res(); }; const k = (e) => { if (e.code === 'Escape' || e.code === 'Space') { clearTimeout(t); removeEventListener('keydown', k); res(); } }; addEventListener('keydown', k); });
    cr.classList.remove('on'); setTimeout(() => cr.remove(), 1500);
    this.csEnd(); Audio.play('town');
    UI.chat('感谢游玩！你可以继续自由探索：与各处的 NPC 交谈、挑战 FATE、或再次攻略副本。', 'system');
  },
  // ---------- FATE ----------
  updateFate(dt) {
    const Z = G.zone; if (!Z || Z.id !== 'field' || G.state !== 'play') return;
    const P = G.player; const d = Math.hypot(P.pos.x - Z.fate.x, P.pos.z - Z.fate.z);
    if (!G.fate) { this.fateCD -= dt; if (this.fateCD <= 0 && d < 75 && G.save.level >= 3) this.startFate(); return; }
    const F = G.fate; F.t -= dt; F.uiT -= dt; const inside = d < Z.fate.r + 12; if (inside) F.joined = true;
    if (F.uiT <= 0) { F.uiT = 0.3; UI.fateInfo(`<h4>沙哈金族的奇袭<span class="num">${fmtT(F.t)}</span></h4><div class="muted" style="font-size:12px">击退袭击东部海滩的沙哈金族！</div><div class="fbar"><i style="width:${F.p}%"></i></div><div style="font-size:12px;display:flex;justify-content:space-between"><span>进度 ${F.p}%</span><span style="color:${inside ? '#9affc8' : '#aaa'}">${inside ? '参加中' : '范围外'}</span></div>`); }
    if (F.t <= 0) this.endFate(false);
  },
  startFate() {
    const L = clamp(G.save.level, 6, 9);
    G.fate = { t: 480, p: 0, kills: 0, boss: null, uiT: 0, L, joined: false };
    UI.banner('fate', 'FATE 开始', '沙哈金族的奇袭'); Audio.sfxPlay('duty'); UI.chat('FATE「沙哈金族的奇袭」开始了！地点：拉诺西亚低地 东部海滩', 'fate');
    this.fateWave(4);
  },
  fateWave(n) {
    const Z = G.zone, F = G.fate;
    for (let i = 0; i < n; i++) { let x, z, k = 0; do { const a = rand(0, PI * 2), r = rand(6, 14); x = Z.fate.x + Math.cos(a) * r; z = Z.fate.z + Math.sin(a) * r; k++; } while (!Z.canWalk(x, z, 0.6) && k < 20); const m = G.game.spawnMob('sahagin', F.L, x, z, { wanderR: 4, aggroR: 16 }); m.fate = true; VFX.burst(m.hitPos(), '#7ad0ff', 16, { speed: 3 }); }
  },
  fateKill(e) {
    const F = G.fate; if (e.def.fateBoss) { F.p = 100; this.endFate(true); return; }
    F.kills++; F.p = Math.min(80, F.kills * 10);
    if (F.kills === 4) { this.fateWave(4); UI.chat('更多的沙哈金族从海里冒了出来！', 'fate'); }
    if (F.kills >= 8 && !F.boss) { const Z = G.zone; F.boss = G.game.spawnMob('sahagin_chief', F.L + 2, Z.fate.x, Z.fate.z, { wanderR: 2, aggroR: 18 }); F.boss.fate = true; VFX.pillar(F.boss.pos, '#7ad0ff', 10, 1.5, 2); UI.chat('沙哈金族战士长出现了！', 'fate'); UI.error('沙哈金族战士长出现了！', 'warn'); }
  },
  endFate(ok) {
    const F = G.fate; if (!F) return; G.fate = null; UI.fateInfo(null); this.fateCD = ok ? 150 : 90;
    for (const e of Combat.enemies()) if (e.fate) { e.dead = true; e.deadT = 1.5; e.model.setDead(true); }
    if (ok) { UI.banner('fate', 'FATE 完成', '金牌 · GOLD RATING'); Audio.sfxPlay('fanfare'); UI.chat('FATE「沙哈金族的奇袭」完成了！评价：金牌', 'fate'); if (F.joined) { this.gainExp(1200); G.save.gil += 300; UI.chat('获得了300金币。', 'loot'); } }
    else { UI.banner('fate', 'FATE 失败', 'FAILED'); UI.chat('FATE「沙哈金族的奇袭」失败了……', 'fate'); }
  },
  // ---------- 副本 ----------
  partyPlan() { const role = JOBS[G.save.job].role; if (role === 'tank') return ['player', 'alphinaud', 'yda', 'yshtola']; if (role === 'healer') return ['thancred', 'player', 'yda', 'yshtola']; if (role === 'melee') return ['thancred', 'alphinaud', 'player', 'yshtola']; return ['thancred', 'alphinaud', 'yda', 'player']; },
  queueDuty() {
    if (G.zone.dungeon) { UI.error('已经在任务中'); return; }
    const st = Q().q5; if (!(st && st.status === 'active' && st.step === 0) && !G.save.flags.sastasha) { UI.error('尚未解锁此任务'); return; }
    if (this.queued) return; this.queued = true;
    UI.chat('已申请参加「天然要害沙斯塔夏溶洞」。正在匹配亲信战友……', 'system'); Audio.sfxPlay('confirm');
    setTimeout(async () => {
      this.queued = false; if (G.state !== 'play') return;
      Audio.sfxPlay('duty'); let sec = 45;
      const party = G.game.dutyParty();
      const body = `<div class="dutypop"><div class="muted">迷宫挑战</div><div class="dn">天然要害沙斯塔夏溶洞</div><div class="df"><div class="party-row" style="justify-content:center">${party.map((p) => `<span><img src="${roleIcon(p.role)}" alt="">${esc(p.name)}</span>`).join('')}</div></div><div class="timer" id="dp-t" style="margin-top:12px">剩余时间 0:45</div></div>`;
      const i = await UI.modal('dutypop', '任务准备完毕', body, [{ text: '稍后再说' }, { text: '突入', primary: true }], { width: '420px', mount: (w, close) => { const iv = setInterval(() => { sec--; const el = w.querySelector('#dp-t'); if (!w.isConnected) { clearInterval(iv); return; } if (el) el.textContent = `剩余时间 ${fmtT(sec)}`; if (sec <= 0) { clearInterval(iv); close(0); } }, 1000); } });
      if (i === 1) G.game.loadZone('dungeon', 'start', { duty: true }); else UI.chat('你放弃了进入任务。', 'system');
    }, 2200);
  },
  dutySetup() {
    const L = Math.max(1, G.save.level);
    G.duty = { t: 3600, done: { chopper: false, madison: false, denn: false }, complete: false, chest: null, wipeT: 0, uiT: 0, seen: {} };
    let slot = 1; for (const k of this.partyPlan()) if (k !== 'player') G.game.spawnAlly(k, slot++);
    const pack = (list) => { const ms = list.map(([k, x, z]) => G.game.spawnMob(k, L, x, z, { wanderR: 1.5, rot: 0, aggroR: 9 })); ms.forEach((m) => (m.pack = ms)); return ms; };
    pack([['pirate', 0, -46], ['pirate2', -4, -53], ['pirate', 4, -54]]);
    pack([['pirate2', -3, -130], ['pirate', 3, -131], ['pirate', 0, -137]]);
    const b1 = G.game.spawnMob('chopper', L + 1, 0, -97, { rot: 0, noWander: true, aggroR: 13, sealId: 'b1', key: 'chopper' });
    const b2 = G.game.spawnMob('madison', L + 1, 0, -182, { rot: 0, noWander: true, aggroR: 12, sealId: 'b2', key: 'madison' });
    const b3 = G.game.spawnMob('denn', L + 2, 0, -247, { rot: 0, noWander: true, aggroR: 31, sealId: 'b3', key: 'denn' });
    for (const b of [b1, b2, b3]) { b.aggro = true; b.leash = 999; }
    b3.radius = 9.6; b3.plateH = 7.5;
    G.duty.bosses = { chopper: b1, madison: b2, denn: b3 };
  },
  bossEngage(e) {
    const names = { b1: '隐秘码头', b2: '海盗甲板', b3: '虎鲸之穴' }, nm = names[e.sealId];
    UI.chat(`「${nm}」将在5秒后被封锁！`, 'battle-warn'); Audio.play('boss');
    Combat.bossScript = bossScript(e, this.bossApi());
    if (e.key === 'madison') UI.chat('麦迪逊船长：「哪来的老鼠？敢闯我蛇蝎帮的地盘！」', 'npc');
    if (e.key === 'denn') UI.chat('虎鲸牙·丹恩发出了震耳欲聋的咆哮！', 'npc');
    Combat.later(5, () => {
      if (!e.inCombat || e.dead) return;
      G.zone.setSeal(e.sealId, true); Audio.sfxPlay('seal'); UI.chat(`「${nm}」被封锁了！`, 'battle-warn');
      const c = { b1: [0, -94, 16], b2: [0, -176, 16], b3: [0, -222, 17] }[e.sealId];
      for (const m of Combat.party()) if (Math.hypot(m.pos.x - c[0], m.pos.z - c[1]) > c[2] - 0.5) { m.pos.set(c[0] + rand(-2, 2), 0, c[1] + c[2] - 3); }
    });
  },
  clearBossFight(e, killed) {
    G.zone.setSeal(e.sealId, false); Combat.bossScript = null; Combat.stack = null;
    for (const t of Combat.teles) t.cancel = true;
    for (const x of Combat.enemies()) if (x.add) { x.dead = true; x.deadT = 1.5; x.model.setDead(true); }
    if (!killed) { e.hp = e.maxHp; e.pos.copy(e.spawn); e.rot = 0; e.statuses = []; e.addsSpawned = false; }
    Audio.play('dungeon');
  },
  bossApi() {
    return {
      markBuster: (tk) => { Combat.fly(tk, '⚠ 死刑', 'status'); VFX.ring(tk.pos, '#ff3a2a', 2.2, 3.4); },
      spawnAdds: (boss, n) => { for (let i = 0; i < n; i++) { const a = rand(0, PI * 2); const x = boss.spawn.x + Math.cos(a) * 12, z = boss.spawn.z + 6 + Math.sin(a) * 8; const m = G.game.spawnMob('madison_add', boss.level - 1, x, z, { noWander: true }); m.add = true; VFX.burst(m.hitPos(), '#ffb070', 12); const tgt = Combat.party().filter((p) => !p.dead && p.role !== 'tank')[0] || G.player; Combat.engage(m, tgt); m.enmity.set(tgt.id, 50); } },
      spawnClams: (boss) => {
        for (const sx of [-9, 9]) {
          const m = G.game.spawnMob('clam', boss.level, sx, -230, { noWander: true, rot: 0 }); m.add = true; Combat.engage(m, G.player); VFX.burst(m.hitPos(), '#ff8ad0', 16);
          Combat.later(26, () => { if (m.dead || boss.dead) return; m.dead = true; m.deadT = 1.5; m.model.setDead(true); const s = boss.has('empower'); Combat.addStatus(boss, { id: 'empower', name: '海之力', dur: 60, dmgUp: 0.15 * ((s ? s.stacks : 0) + 1), stacks: (s ? s.stacks : 0) + 1, icon: ['drop', '#ff6ab0', '#4a0a2a'] }); VFX.pillar(boss.pos, '#ff6ab0', 12, 1.2, 4); UI.chat('巨蚌释放了海之力！虎鲸牙·丹恩变得更加强大了！', 'battle-warn'); });
        }
      },
      knockback: (boss, d) => { for (const m of Combat.party()) if (!m.dead) { const dx = m.pos.x - boss.pos.x, dz = m.pos.z - boss.pos.z, l = Math.hypot(dx, dz) || 1; m.kb = { dx: dx / l, dz: dz / l, t: d / 20 }; } UI.error('被击退了！', 'warn'); },
    };
  },
  dutyKill(e) {
    const D = G.duty;
    if (e.boss) {
      D.done[e.key] = true; this.clearBossFight(e, true);
      UI.chat(`${{ b1: '「隐秘码头」', b2: '「海盗甲板」', b3: '「虎鲸之穴」' }[e.sealId]}的封锁解除了。`, 'system');
      if (e.key === 'chopper') { G.game.addItem('shell'); }
      if (e.key === 'madison') UI.chat('麦迪逊船长：「可恶……这群……冒险者……」', 'npc');
      if (e.key === 'denn') this.dutyComplete();
    }
  },
  dutyComplete() {
    const D = G.duty; D.complete = true;
    setTimeout(() => { UI.banner('duty', '任务完成', 'DUTY COMPLETE'); Audio.sfxPlay('fanfare'); for (const m of Combat.party()) { if (m.dead) Combat.revive(m, 0.5); m.model.play('victory', 2.5); } }, 1200);
    G.save.flags.sastasha = true;
    const st = Q().q5; if (st && st.status === 'active' && st.step === 0) this.advance(QUESTS.q5);
    this.gainExp(1000);
    const g = new THREE.Group(); g.position.set(0, 0, -226);
    const wood = new THREE.MeshStandardMaterial({ color: '#8a4a2a', roughness: 0.6 }), gold = new THREE.MeshStandardMaterial({ color: '#e8c050', metalness: 0.9, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), wood); base.position.y = 0.4; g.add(base);
    const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.45); const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 12, 1, false, 0, PI), wood); lm.rotation.z = PI / 2; lm.position.z = 0.45; lid.add(lm); g.add(lid);
    for (const x of [-0.6, 0, 0.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.92), gold); b.position.set(x, 0.4, 0); g.add(b); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    G.zone.group.add(g); D.chest = { g, lid, opened: false };
    VFX.pillar(new V3(0, 0, -226), '#ffe070', 8, 1.5, 1.4);
    UI.chat('宝箱出现了！调查宝箱获得战利品，之后可以通过右侧「离开任务」按钮返回。', 'quest');
  },
  async openChest() {
    const D = G.duty; if (D.chest.opened) return; D.chest.opened = true;
    G.game.tween(0.8, (u) => { D.chest.lid.rotation.x = -u * 1.9; }); Audio.sfxPlay('loot'); VFX.burst(new V3(0, 1.2, -226), '#ffe070', 40, { speed: 4, size: 0.4 });
    const S = G.save, items = [weaponItem(S.job, 2), ITEMS.body2, ITEMS.ring1];
    const allies = Combat.party().filter((p) => p !== G.player);
    const rows = items.map((it, i) => `<div class="li" data-i="${i}"><img src="${icon(it.icon, 64)}" alt=""><div class="nm"><b>${esc(it.name)}</b><small>物品等级 ${it.ilvl}${it.job ? ' · ' + JOBS[it.job].name + '专用' : ''}</small></div><div class="rolls"><button class="btn primary" data-r="need">需求</button><button class="btn" data-r="greed">贪婪</button><button class="btn ghost" data-r="pass">放弃</button></div></div>`).join('');
    const choice = {};
    await UI.modal('loot', '战利品分配', `<div class="loot">${rows}</div><p class="desc">「需求」优先于「贪婪」。点数高者获得物品。</p>`, [{ text: '确定', primary: true }], { width: '520px', mount: (w) => { w.querySelectorAll('.li').forEach((li) => li.querySelectorAll('button').forEach((b) => (b.onclick = () => { choice[li.dataset.i] = b.dataset.r; li.querySelectorAll('button').forEach((x) => (x.disabled = x !== b)); Audio.sfxPlay('click'); }))); } });
    items.forEach((it, i) => {
      const c = choice[i] || 'need'; const mine = Math.floor(rand(1, 100));
      if (c === 'pass') UI.chat(`你放弃了「${it.name}」。`, 'loot'); else UI.chat(`你为「${it.name}」投掷了${c === 'need' ? '需求' : '贪婪'}骰子，点数为${mine}。`, 'loot');
      let best = c === 'pass' ? null : { who: 'me', v: mine + (c === 'need' ? 1000 : 0) };
      for (const a of allies) { const v = Math.floor(rand(1, 100)); if (Math.random() < 0.5) { UI.chat(`${a.name}为「${it.name}」投掷了贪婪骰子，点数为${v}。`, 'loot'); if (!best || v > best.v) best = { who: a.name, v }; } else UI.chat(`${a.name}放弃了「${it.name}」。`, 'loot'); }
      if (best && best.who === 'me') { if (it.type === 'weapon') this.giveWeapon(2); else { G.game.addItem(it.id); G.game.equip(it.id); } }
      else if (best) UI.chat(`${best.who}获得了「${it.name}」。`, 'loot');
    });
    G.game.save();
  },
  updateDuty(dt) {
    const D = G.duty; if (!D || !G.zone || !G.zone.dungeon) return;
    D.t -= dt; D.uiT -= dt;
    if (D.uiT <= 0) {
      D.uiT = 0.5; const o = (k, n) => `<div class="obj ${D.done[k] ? 'done' : ''}"><span>击败 ${n}</span><span class="num">${D.done[k] ? 1 : 0}/1</span></div>`;
      UI.dutyInfo(`<h4>沙斯塔夏溶洞<span class="num">${fmtT(D.t)}</span></h4>${o('chopper', '切割者')}${o('madison', '麦迪逊船长')}${o('denn', '虎鲸牙·丹恩')}${D.complete ? '<button class="btn primary" id="leave-duty" style="margin-top:8px;width:100%">离开任务</button>' : ''}`);
      const lb = $('leave-duty'); if (lb) lb.onclick = () => { UI.dutyInfo(null); G.game.loadZone('town', 'wench', { fromDuty: true }); };
    }
    // 区域名称提示
    const P = G.player; const areas = [['b1', 0, -94, 16, '隐秘码头', 'THE HIDDEN DOCK'], ['b2', 0, -176, 16, '海盗甲板', 'THE PIRATE DECK'], ['b3', 0, -222, 17, '虎鲸之穴', "THE ORCATOOTH'S DEN"]];
    for (const [id, x, z, r, n, en] of areas) if (!D.seen[id] && Math.hypot(P.pos.x - x, P.pos.z - z) < r + 4) { D.seen[id] = true; UI.zoneTitle(n, '', en); }
    // 团灭
    if (!D.wiping && Combat.party().every((m) => m.dead)) { D.wipeT += dt; if (D.wipeT > 2.5) this.wipe(); } else D.wipeT = 0;
    // 玩家倒下且没有可复活的治疗职业时，提供在检查点复活
    if (P.dead && !D.wiping && !Combat.party().some((m) => !m.dead && m.role === 'healer' && m !== P)) {
      D.deadT = (D.deadT || 0) + dt;
      if (D.deadT > 6 && !D.asking && Combat.party().some((m) => !m.dead)) {
        D.asking = true;
        UI.modal('revive', '无法战斗', '<p style="margin:0;line-height:1.8">队伍中没有能够复活你的治疗职业。<br>要在最近的检查点重新站起来吗？</p>', [{ text: '在检查点复活', primary: true }]).then(() => {
          D.asking = false; D.deadT = 0; if (!P.dead) return;
          const cp = D.done.madison ? [0, -196] : D.done.chopper ? [0, -114] : [0, -4];
          Combat.revive(P, 0.6); P.pos.set(cp[0], 0, cp[1]); G.game.snapCamera();
        });
      }
    } else D.deadT = 0;
    if (D.t <= 0 && !D.complete && !D.ended) { D.ended = true; UI.chat('时间到了……任务失败。', 'system'); G.game.loadZone('town', 'wench'); }
  },
  async wipe() {
    const D = G.duty; D.wiping = true; UI.banner('death', '全员倒下', 'PARTY WIPED'); UI.chat('队伍全灭了……将在入口处重整旗鼓。', 'system');
    await sleep(2600); await UI.fade(true);
    for (const t of Combat.teles) t.cancel = true; Combat.stack = null; Combat.bossScript = null;
    for (const e of Combat.enemies()) { if (e.add) { e.dead = true; e.deadT = 2.7; continue; } if (e.inCombat) { Combat.resetEnemy(e); e.hp = e.maxHp; e.pos.copy(e.spawn); e.wander = null; e.statuses = []; e.addsSpawned = false; } }
    for (const id of ['b1', 'b2', 'b3']) G.zone.setSeal(id, false);
    const cp = D.done.madison ? [0, -196] : D.done.chopper ? [0, -114] : [0, -4];
    for (const m of Combat.party()) { m.dead = false; m.model.setDead(false); m.hp = m.effMaxHp; m.mp = m.maxMp; m.pos.set(cp[0] + rand(-2, 2), 0, cp[1] + rand(-1, 2)); m.statuses = m.statuses.filter((s) => s.keep); m.casting = null; m.model.setLoop(null); }
    G.player.rot = PI; G.cam.yaw = PI; G.game.snapCamera(); Audio.play('dungeon');
    await UI.fade(false); D.wiping = false; D.wipeT = 0;
  },
  markers() {
    const out = [], Z = G.zone; if (!Z || !G.save) return out;
    for (const q of this.sorted()) {
      const st = Q()[q.id]; if (!st || st.status !== 'active') continue; const s = q.steps[st.step]; if (!s) continue; const ic = q.type === 'msq' ? 'msq-t' : 'side-t';
      const exitTown = { x: -67, z: 0, icon: ic }, exitField = { x: -192, z: 0, icon: ic };
      if (s.type === 'kill') { if (Z.id === 'field') { const g = Z.mobSpawns.find((x) => x.mob === s.mob); if (g) out.push({ x: g.x, z: g.z, icon: ic, area: g.r }); } else if (Z.id === 'town') out.push(exitTown); }
      if (s.type === 'gather') { if (Z.id === 'field') out.push({ x: -25, z: 50, icon: ic, area: 30 }); else if (Z.id === 'town') out.push(exitTown); }
      if (s.type === 'interact' && Z.id === 'town') out.push({ x: 0, z: 0, icon: ic });
      if (s.type === 'duty' && Z.id === 'field') out.push({ x: 124, z: -84, icon: ic });
      if ((s.type === 'talk' || s.type === 'emote') && !Z.dungeon) { const def = NPCS[s.npc]; if (def && def.zone !== Z.id) out.push(Z.id === 'town' ? exitTown : exitField); }
    }
    return out;
  },
};
