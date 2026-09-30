// 游戏数据：种族、职业、技能、物品、魔物、NPC、任务与剧情文本
export const RACES = [
  { id: 'hyur', name: '人族', en: 'HYUR', clans: ['中原之民', '高地之民'], desc: '艾欧泽亚人口最多的种族。来自各地的移民在这片大陆上扎根，文化与血统都极为多样。' },
  { id: 'elezen', name: '精灵族', en: 'ELEZEN', clans: ['森林之民', '黑影之民'], desc: '身形修长、耳朵尖长的古老种族。自诩为艾欧泽亚最早的主人，听觉极其敏锐。' },
  { id: 'lalafell', name: '拉拉菲尔族', en: 'LALAFELL', clans: ['平原之民', '沙漠之民'], desc: '个子小小、脸颊圆圆的种族。看似可爱，却是商业与魔法领域的顶尖好手。' },
  { id: 'miqote', name: '猫魅族', en: "MIQO'TE", clans: ['逐日之民', '护月之民'], desc: '拥有猫耳与长尾的狩猎民族。动作灵巧，在夜里也能看清猎物。' },
  { id: 'roegadyn', name: '鲁加族', en: 'ROEGADYN', clans: ['北洋之民', '红焰之民'], desc: '身材魁梧的航海民族。利姆萨·罗敏萨的水手与海盗中，有不少都是鲁加族。' },
  { id: 'aura', name: '敖龙族', en: 'AU RA', clans: ['晨曦之民', '暮晖之民'], desc: '头生双角、身覆鳞片的东方民族。相传是龙的后裔。' },
  { id: 'viera', name: '维埃拉族', en: 'VIERA', clans: ['山林之民', '密林之民'], desc: '长着兔耳的森林守护者。寿命漫长，与森林有着深刻的羁绊。' },
  { id: 'hrothgar', name: '硌狮族', en: 'HROTHGAR', clans: ['掌握之民', '迷踪之民'], desc: '外表似狮的强壮种族。性格沉稳，重视誓约与荣誉。' },
];
export const SKINS = {
  hyur: [['#f6dcc6', '#f0d2b8', '#e6c0a0', '#d9ab86', '#c99470', '#b07a58', '#8e5e42', '#6a4430'], ['#f0d0b4', '#e2b894', '#d4a47e', '#c48e68', '#b07a56', '#946244', '#7a4c34', '#5a3624']],
  elezen: [['#f8e4d4', '#f2d8c4', '#e8cab2', '#dcb99c', '#caa384', '#b88e70', '#a07a60', '#8a6850'], ['#c8c2cc', '#b4aebc', '#a09ab0', '#8e8aa4', '#7c7a96', '#6a6a88', '#5a5a78', '#4a4a66']],
  lalafell: [['#fbe2cc', '#f6d6bc', '#eec8aa', '#e2b896', '#d4a582', '#c4926e', '#b0805e', '#946a4c'], ['#e8c09c', '#dcb08a', '#cea078', '#c09068', '#b08058', '#9c6e4a', '#86603e', '#6e4e32']],
  miqote: [['#f8dcc4', '#f0ceb2', '#e6be9e', '#dab08e', '#cca07e', '#bc906e', '#a87e5e', '#906a4e'], ['#f4eeea', '#ece2dc', '#e0d2ca', '#d2c0b6', '#c4b0a4', '#b09c90', '#9a887c', '#827266']],
  roegadyn: [['#e8bc9c', '#dcac8a', '#cc9a78', '#bc8866', '#a87656', '#946446', '#7e5438', '#68442c'], ['#9a9aa0', '#8a8a92', '#7a7a84', '#6c6c78', '#5e5e6a', '#50505c', '#44444e', '#383840']],
  aura: [['#fbf1ea', '#f6e6dc', '#f0dbcf', '#e8cfc2', '#dec2b4', '#d2b4a6', '#c4a698', '#b4968a'], ['#a88a78', '#96786a', '#846a5e', '#725c52', '#624e46', '#54423c', '#463632', '#382a28']],
  viera: [['#f4dcc8', '#e8c8b0', '#d8b498', '#c8a084', '#b48a6e', '#9c745a', '#845e48', '#6a4a38'], ['#fbf4ee', '#f4e8de', '#ecdcd0', '#e0cec0', '#d4c0b0', '#c4ae9e', '#b09a8a', '#9a8676']],
  hrothgar: [['#8a6a4a', '#9a7a58', '#aa8a66', '#6e5238', '#5a442e', '#c8a878', '#3e3228', '#b89a70'], ['#6a6a70', '#7e7e84', '#94949a', '#56565c', '#44444a', '#aaa8a4', '#302e30', '#8a7a6a']],
};
export const HAIR_COLORS = ['#f4f0e8', '#d8d4cc', '#a8a8b0', '#6a6a72', '#2a2a30', '#141418', '#3b2a22', '#5a3a26', '#7a4a2a', '#a0602e', '#c8883e', '#e0b060', '#f0d890', '#8a2a20', '#b83a2a', '#e06a4a', '#f0a0b0', '#c05a8a', '#7a3a8a', '#4a3a9a', '#3a6ab0', '#5aa0c8', '#4a9a7a', '#6a8a3a'];
export const EYE_COLORS = ['#3f7fc0', '#2f5a9a', '#4ab0c8', '#3a9a6a', '#6ab04a', '#c8a030', '#d87a2a', '#b83a2a', '#c04a8a', '#8a4ac0', '#6a4a2a', '#3a2a1e', '#8a8a92', '#e8e0d0', '#f0c040', '#40e0d0'];
export const PAINT_COLORS = ['#b8323a', '#e06a2a', '#e0b030', '#3a8a4a', '#2a6ab0', '#6a3a9a', '#1a1a1e', '#f0ece4'];
export const SCALE_COLORS = ['#5d7aa8', '#3a3a44', '#8a5a9a', '#3a7a6a', '#a84a3a', '#c8c8d0', '#c8a040', '#2a4a8a'];
export const DEITIES = [
  ['哈罗妮', '战神 · 冰天使'], ['梅茵菲娜', '月神 · 爱之女神'], ['沙利亚克', '智神 · 河川之神'], ['妮美雅', '星神 · 命运纺织者'],
  ['利姆莱因', '海神 · 航海者'], ['奥修昂', '旅神 · 漫游者'], ['比尔格', '工神 · 锻造者'], ['拉尔戈', '破坏神 · 陨星之神'],
  ['阿泽玛', '日神 · 裁决之女神'], ['纳尔札尔', '商神 · 双子之神'], ['诺菲卡', '地神 · 丰饶之母'], ['阿尔基克', '时神 · 时间守护者'],
];
export const MONTHS = ['一之星极月', '一之灵极月', '二之星极月', '二之灵极月', '三之星极月', '三之灵极月', '四之星极月', '四之灵极月', '五之星极月', '五之灵极月', '六之星极月', '六之灵极月'];

// ---------- 技能 ----------
// kind: ws 战技 / spell 魔法 / ability 能力
const S = (o) => ({ kind: 'ws', gcd: true, cast: 0, recast: 2.5, range: 3, mp: 0, target: 'enemy', potency: 0, lv: 1, ...o });
export const JOBS = {
  gla: {
    name: '剑术师', en: 'GLADIATOR', role: 'tank', color: '#4f86c8', icon: ['shield', '#4f86c8', '#1a3456'], weapon: '剑', melee: true, auto: 2.4,
    desc: '以剑与盾守护同伴的防护职业。擅长吸引敌人的仇恨，在前线承受攻击。',
    skills: [
      S({ id: 'fast_blade', name: '先锋剑', lv: 1, potency: 200, anim: 'slash', vfx: 'slash', icon: ['sword', '#6aa0d8', '#1c3a5c'], desc: '对目标发动物理攻击。威力：200' }),
      S({ id: 'iron_will', name: '钢铁信念', lv: 1, kind: 'ability', gcd: false, recast: 2, target: 'self', toggle: 'iron_will', icon: ['shield', '#5a7ab0', '#1a2440'], desc: '切换防护职能状态。大幅提高攻击造成的仇恨。' }),
      S({ id: 'fight_or_flight', name: '战逃反应', lv: 2, kind: 'ability', gcd: false, recast: 60, target: 'self', buff: { id: 'fof', name: '战逃反应', dur: 20, dmgUp: 0.25, icon: ['burst', '#e05a3a', '#5a1a0a'] }, anim: 'buff', icon: ['burst', '#e05a3a', '#5a1a0a'], desc: '20秒内自身造成的伤害提高25%。' }),
      S({ id: 'riot_blade', name: '暴乱剑', lv: 4, potency: 100, combo: { from: 'fast_blade', potency: 300, mp: 1000 }, anim: 'slash2', vfx: 'slash', icon: ['swords', '#6aa0d8', '#1c3a5c'], desc: '威力：100\n连击条件：先锋剑\n连击中威力：300，恢复1000魔力' }),
      S({ id: 'total_eclipse', name: '全蚀斩', lv: 6, potency: 100, aoe: { shape: 'circle', r: 5, at: 'self' }, target: 'none', anim: 'spin', vfx: 'spin', icon: ['burst', '#8ab0e0', '#1c2a4c'], desc: '对自身周围5米内的敌人发动范围攻击。威力：100' }),
      S({ id: 'rampart', name: '铁壁', lv: 8, kind: 'ability', gcd: false, recast: 90, target: 'self', buff: { id: 'rampart', name: '铁壁', dur: 20, mit: 0.2, icon: ['shield', '#c0a060', '#4a3a1a'] }, anim: 'guard', icon: ['shield', '#c0a060', '#4a3a1a'], desc: '20秒内自身受到的伤害减轻20%。' }),
      S({ id: 'provoke', name: '挑衅', lv: 8, kind: 'ability', gcd: false, recast: 30, range: 25, provoke: true, anim: 'point', icon: ['bang', '#d8a030', '#4a2a0a'], desc: '将自身置于目标仇恨列表的首位。' }),
      S({ id: 'shield_bash', name: '盾牌猛击', lv: 10, potency: 100, stun: 4, anim: 'slash2', vfx: 'hit', icon: ['shield', '#8a9ab0', '#2a3040'], desc: '威力：100\n追加效果：眩晕4秒' }),
      S({ id: 'rage_of_halone', name: '战女神之怒', lv: 12, potency: 100, combo: { from: 'riot_blade', potency: 380 }, anim: 'heavy', vfx: 'slash', icon: ['sword', '#e0c060', '#5a3a0a'], desc: '威力：100\n连击条件：暴乱剑\n连击中威力：380' }),
      S({ id: 'shield_lob', name: '投盾', lv: 14, potency: 100, range: 20, enmityMul: 3, anim: 'release', vfx: 'shieldlob', icon: ['shield', '#6ac0e0', '#1a4050'], desc: '投掷盾牌攻击远处的目标。威力：100' }),
    ],
    lb: { name: '盾墙', icon: ['shield', '#f0d060', '#6a4a0a'], desc: '极限技：一段时间内全队受到的伤害大幅减轻。' },
  },
  mrd: {
    name: '斧术师', en: 'MARAUDER', role: 'tank', color: '#b0443a', icon: ['axe', '#b0443a', '#4a1410'], weapon: '战斧', melee: true, auto: 3.0,
    desc: '挥舞巨斧的狂战士型防护职业。以强大的自愈能力支撑在前线。',
    skills: [
      S({ id: 'heavy_swing', name: '重劈', lv: 1, potency: 200, anim: 'heavy', vfx: 'slash', icon: ['axe', '#d06050', '#4a1410'], desc: '对目标发动物理攻击。威力：200' }),
      S({ id: 'defiance', name: '守护', lv: 1, kind: 'ability', gcd: false, recast: 2, target: 'self', toggle: 'iron_will', icon: ['shield', '#b04a3a', '#3a1010'], desc: '切换防护职能状态。大幅提高攻击造成的仇恨。' }),
      S({ id: 'maim', name: '凶残裂', lv: 4, potency: 100, combo: { from: 'heavy_swing', potency: 300 }, anim: 'slash', vfx: 'slash', icon: ['axe', '#e08040', '#5a2010'], desc: '威力：100\n连击条件：重劈\n连击中威力：300' }),
      S({ id: 'berserk', name: '狂暴', lv: 6, kind: 'ability', gcd: false, recast: 60, target: 'self', buff: { id: 'berserk', name: '狂暴', dur: 15, critNext: 3, icon: ['burst', '#ff4a2a', '#5a0a0a'] }, anim: 'buff', icon: ['burst', '#ff4a2a', '#5a0a0a'], desc: '之后3次战技必定暴击。' }),
      S({ id: 'rampart', name: '铁壁', lv: 8, kind: 'ability', gcd: false, recast: 90, target: 'self', buff: { id: 'rampart', name: '铁壁', dur: 20, mit: 0.2, icon: ['shield', '#c0a060', '#4a3a1a'] }, anim: 'guard', icon: ['shield', '#c0a060', '#4a3a1a'], desc: '20秒内自身受到的伤害减轻20%。' }),
      S({ id: 'provoke', name: '挑衅', lv: 8, kind: 'ability', gcd: false, recast: 30, range: 25, provoke: true, anim: 'point', icon: ['bang', '#d8a030', '#4a2a0a'], desc: '将自身置于目标仇恨列表的首位。' }),
      S({ id: 'overpower', name: '超压斧', lv: 10, potency: 110, aoe: { shape: 'cone', r: 8, angle: 120, at: 'self' }, target: 'none', anim: 'slash2', vfx: 'cone', icon: ['axe', '#e0a040', '#4a2a0a'], desc: '对自身前方扇形范围内的敌人发动攻击。威力：110' }),
      S({ id: 'thrill', name: '战栗', lv: 10, kind: 'ability', gcd: false, recast: 90, target: 'self', healSelf: 0.2, buff: { id: 'thrill', name: '战栗', dur: 20, maxHp: 0.2, icon: ['heart', '#e05050', '#4a0a10'] }, anim: 'buff', icon: ['heart', '#e05050', '#4a0a10'], desc: '最大体力提高20%，并恢复等量体力。' }),
      S({ id: 'storms_path', name: '暴风斩', lv: 12, potency: 100, combo: { from: 'maim', potency: 380, heal: 250 }, anim: 'heavy', vfx: 'slash', icon: ['wind', '#60c0a0', '#0a3a2a'], desc: '威力：100\n连击条件：凶残裂\n连击中威力：380，恢复自身体力' }),
      S({ id: 'tomahawk', name: '飞斧', lv: 14, potency: 100, range: 20, enmityMul: 3, anim: 'release', vfx: 'axe', icon: ['axe', '#8ab0d0', '#1a3040'], desc: '投掷战斧攻击远处的目标。威力：100' }),
    ],
    lb: { name: '盾墙', icon: ['shield', '#f0d060', '#6a4a0a'], desc: '极限技：一段时间内全队受到的伤害大幅减轻。' },
  },
  lnc: {
    name: '枪术师', en: 'LANCER', role: 'melee', color: '#4a5ec0', icon: ['spear', '#4a5ec0', '#141c4a'], weapon: '长枪', melee: true, auto: 2.8,
    desc: '以长枪连击突刺的近战进攻职业。连击流畅，爆发力极强。',
    skills: [
      S({ id: 'true_thrust', name: '精准刺', lv: 1, potency: 200, anim: 'thrust', vfx: 'thrust', icon: ['spear', '#6a8ae0', '#141c4a'], desc: '对目标发动物理攻击。威力：200' }),
      S({ id: 'vorpal_thrust', name: '贯通刺', lv: 4, potency: 100, combo: { from: 'true_thrust', potency: 280 }, anim: 'thrust', vfx: 'thrust', icon: ['spear', '#8ab0f0', '#1a2a5a'], desc: '威力：100\n连击条件：精准刺\n连击中威力：280' }),
      S({ id: 'piercing_talon', name: '贯穿尖', lv: 5, potency: 150, range: 20, anim: 'release', vfx: 'spearthrow', icon: ['arrow', '#8a9ad0', '#1a2040'], desc: '投掷长枪攻击远处的目标。威力：150' }),
      S({ id: 'life_surge', name: '龙剑', lv: 6, kind: 'ability', gcd: false, recast: 40, target: 'self', buff: { id: 'life_surge', name: '龙剑', dur: 5, critNext: 1, icon: ['star', '#e0a040', '#5a3a0a'] }, anim: 'buff', icon: ['star', '#e0a040', '#5a3a0a'], desc: '下一次战技必定暴击。' }),
      S({ id: 'disembowel', name: '开膛枪', lv: 8, potency: 100, combo: { from: 'true_thrust', potency: 250, buff: { id: 'power_surge', name: '龙之力', dur: 30, dmgUp: 0.1, icon: ['wing', '#c05a5a', '#4a1414'] } }, anim: 'thrust', vfx: 'thrust', icon: ['spear', '#d06a6a', '#4a1414'], desc: '威力：100\n连击条件：精准刺\n连击中威力：250，自身伤害提高10%' }),
      S({ id: 'second_wind', name: '内丹', lv: 8, kind: 'ability', gcd: false, recast: 120, target: 'self', healPot: 500, anim: 'buff', vfx: 'heal', icon: ['cross', '#6ad08a', '#0a3a1a'], desc: '恢复自身体力。恢复力：500' }),
      S({ id: 'lance_charge', name: '猛枪', lv: 10, kind: 'ability', gcd: false, recast: 60, target: 'self', buff: { id: 'lance_charge', name: '猛枪', dur: 20, dmgUp: 0.1, icon: ['burst', '#e0602a', '#5a1a0a'] }, anim: 'buff', icon: ['burst', '#e0602a', '#5a1a0a'], desc: '20秒内自身造成的伤害提高10%。' }),
      S({ id: 'full_thrust', name: '直刺', lv: 12, potency: 100, combo: { from: 'vorpal_thrust', potency: 400 }, anim: 'thrust', vfx: 'thrust', icon: ['spear', '#f0d060', '#5a4a0a'], desc: '威力：100\n连击条件：贯通刺\n连击中威力：400' }),
      S({ id: 'doom_spike', name: '死天枪', lv: 14, potency: 110, aoe: { shape: 'line', len: 10, width: 4, at: 'self' }, target: 'none', anim: 'thrust', vfx: 'line', icon: ['spear', '#b060e0', '#2a0a4a'], desc: '对前方直线范围内的敌人发动攻击。威力：110' }),
    ],
    lb: { name: '勇猛烈斩', icon: ['sword', '#f0d060', '#6a4a0a'], desc: '极限技：对单体目标造成巨大伤害。' },
  },
  arc: {
    name: '弓箭手', en: 'ARCHER', role: 'ranged', color: '#8ab04a', icon: ['bow', '#8ab04a', '#243a10'], weapon: '短弓', melee: false, auto: 2.6, autoRange: 25,
    desc: '在远处以弓箭精准射击的远程物理进攻职业。可以边移动边攻击。',
    skills: [
      S({ id: 'heavy_shot', name: '强力射击', lv: 1, potency: 180, range: 25, proc: { id: 'straight_ready', name: '直线射击预备', chance: 0.25, dur: 30, icon: ['arrow', '#f0c040', '#5a3a0a'] }, anim: 'shoot', vfx: 'arrow', icon: ['bow', '#a0c060', '#243a10'], desc: '威力：180\n追加效果（25%）：直线射击预备' }),
      S({ id: 'straight_shot', name: '直线射击', lv: 2, potency: 220, range: 25, requires: 'straight_ready', anim: 'shoot', vfx: 'arrow2', icon: ['arrow', '#f0c040', '#5a3a0a'], desc: '威力：220\n发动条件：直线射击预备' }),
      S({ id: 'raging_strikes', name: '猛者强击', lv: 4, kind: 'ability', gcd: false, recast: 60, target: 'self', buff: { id: 'raging', name: '猛者强击', dur: 20, dmgUp: 0.15, icon: ['burst', '#e04a2a', '#5a0a0a'] }, anim: 'buff', icon: ['burst', '#e04a2a', '#5a0a0a'], desc: '20秒内自身造成的伤害提高15%。' }),
      S({ id: 'venomous_bite', name: '毒咬箭', lv: 6, potency: 100, range: 25, dot: { id: 'venom', name: '毒咬箭', potency: 40, dur: 30, icon: ['skull', '#a04ac0', '#2a0a3a'] }, anim: 'shoot', vfx: 'arrowpoison', icon: ['drop', '#a04ac0', '#2a0a3a'], desc: '威力：100\n追加效果：持续伤害 威力40 持续30秒' }),
      S({ id: 'second_wind', name: '内丹', lv: 8, kind: 'ability', gcd: false, recast: 120, target: 'self', healPot: 500, anim: 'buff', vfx: 'heal', icon: ['cross', '#6ad08a', '#0a3a1a'], desc: '恢复自身体力。恢复力：500' }),
      S({ id: 'quick_nock', name: '连珠箭', lv: 10, potency: 110, aoe: { shape: 'cone', r: 12, angle: 90, at: 'self' }, target: 'none', anim: 'shoot', vfx: 'cone', icon: ['arrows', '#c0d060', '#3a4010'], desc: '对前方扇形范围内的敌人发动攻击。威力：110' }),
      S({ id: 'bloodletter', name: '失血箭', lv: 12, kind: 'ability', gcd: false, recast: 15, potency: 110, range: 25, anim: 'shoot', vfx: 'arrow2', icon: ['drop', '#d03a3a', '#4a0a0a'], desc: '威力：110' }),
      S({ id: 'windbite', name: '风蚀箭', lv: 14, potency: 60, range: 25, dot: { id: 'windbite', name: '风蚀箭', potency: 45, dur: 30, icon: ['wind', '#4ac0b0', '#0a3a3a'] }, anim: 'shoot', vfx: 'arrowwind', icon: ['wind', '#4ac0b0', '#0a3a3a'], desc: '威力：60\n追加效果：持续伤害 威力45 持续30秒' }),
    ],
    lb: { name: '强力射击', icon: ['arrow', '#f0d060', '#6a4a0a'], desc: '极限技：对直线范围内的敌人造成巨大伤害。' },
  },
  cnj: {
    name: '幻术师', en: 'CONJURER', role: 'healer', color: '#5ab86a', icon: ['cross', '#5ab86a', '#143a1a'], weapon: '幻杖', melee: false, auto: 3.2, caster: true,
    desc: '借助自然之力治愈伤痛的治疗职业。队伍的生命线。',
    skills: [
      S({ id: 'stone', name: '飞石', lv: 1, kind: 'spell', cast: 1.5, potency: 140, range: 25, mp: 200, anim: 'release', vfx: 'stone', icon: ['rock', '#c0a070', '#3a2a10'], desc: '对目标发动土属性魔法攻击。威力：140' }),
      S({ id: 'cure', name: '治疗', lv: 2, kind: 'spell', cast: 1.5, heal: 500, range: 30, mp: 400, target: 'ally', proc: { id: 'freecure', name: '自由之心', chance: 0.15, dur: 15, icon: ['cross', '#8ae0ff', '#0a3a5a'] }, anim: 'heal', vfx: 'heal', icon: ['cross', '#6ad08a', '#0a3a1a'], desc: '恢复目标的体力。恢复力：500\n追加效果（15%）：自由之心' }),
      S({ id: 'aero', name: '疾风', lv: 4, kind: 'spell', potency: 50, range: 25, mp: 400, dot: { id: 'aero', name: '疾风', potency: 30, dur: 18, icon: ['wind', '#6ad0a0', '#0a3a2a'] }, anim: 'release', vfx: 'wind', icon: ['wind', '#6ad0a0', '#0a3a2a'], desc: '威力：50\n追加效果：持续伤害 威力30 持续18秒' }),
      S({ id: 'cure2', name: '救疗', lv: 8, kind: 'spell', cast: 2, heal: 800, range: 30, mp: 1000, target: 'ally', freeWith: 'freecure', anim: 'heal', vfx: 'heal2', icon: ['cross', '#4ac0e0', '#0a2a4a'], desc: '恢复目标的体力。恢复力：800\n自由之心状态下不消耗魔力' }),
      S({ id: 'medica', name: '医治', lv: 10, kind: 'spell', cast: 2, heal: 400, mp: 900, target: 'none', aoe: { shape: 'circle', r: 15, at: 'self', ally: true }, anim: 'heal', vfx: 'medica', icon: ['crosses', '#6ad08a', '#0a3a1a'], desc: '恢复自身及周围15米内队员的体力。恢复力：400' }),
      S({ id: 'esuna', name: '康复', lv: 10, kind: 'spell', cast: 1, mp: 400, range: 30, target: 'ally', esuna: true, anim: 'heal', vfx: 'esuna', icon: ['drop', '#a0e0ff', '#0a3a5a'], desc: '解除目标身上的一个异常状态。' }),
      S({ id: 'raise', name: '复活', lv: 12, kind: 'spell', cast: 8, mp: 2400, range: 30, target: 'dead', raise: true, anim: 'heal', vfx: 'raise', icon: ['wing', '#f0e0a0', '#5a4a1a'], desc: '令无法战斗的目标复活。' }),
      S({ id: 'lucid', name: '醒梦', lv: 14, kind: 'ability', gcd: false, recast: 60, target: 'self', buff: { id: 'lucid', name: '醒梦', dur: 21, mpTick: 550, icon: ['eye', '#b080e0', '#2a0a4a'] }, anim: 'buff', icon: ['eye', '#b080e0', '#2a0a4a'], desc: '21秒内持续恢复魔力。' }),
    ],
    lb: { name: '治愈之风', icon: ['crosses', '#f0d060', '#6a4a0a'], desc: '极限技：大幅恢复全队的体力。' },
  },
  thm: {
    name: '咒术师', en: 'THAUMATURGE', role: 'caster', color: '#a05ac8', icon: ['fire', '#a05ac8', '#2a0a3a'], weapon: '咒杖', melee: false, auto: 3.2, caster: true,
    desc: '操纵冰与火的黑魔法进攻职业。在星极火与灵极冰之间切换，打出毁灭性的伤害。',
    skills: [
      S({ id: 'blizzard', name: '冰结', lv: 1, kind: 'spell', cast: 2.5, potency: 180, range: 25, mp: 400, element: 'ice', anim: 'release', vfx: 'ice', icon: ['ice', '#7ad0ff', '#0a2a5a'], desc: '威力：180\n追加效果：灵极冰（魔力恢复加快）' }),
      S({ id: 'fire', name: '火炎', lv: 2, kind: 'spell', cast: 2.5, potency: 180, range: 25, mp: 800, element: 'fire', proc: { id: 'firestarter', name: '火苗', chance: 0.4, dur: 30, icon: ['fire', '#ffb040', '#5a1a0a'] }, anim: 'release', vfx: 'fire', icon: ['fire', '#ff7a3a', '#5a0a0a'], desc: '威力：180\n追加效果：星极火（火属性伤害提高）\n追加效果（40%）：火苗' }),
      S({ id: 'transpose', name: '星灵移位', lv: 4, kind: 'ability', gcd: false, recast: 5, target: 'self', transpose: true, anim: 'buff', icon: ['swirl', '#c080e0', '#3a0a4a'], desc: '星极火与灵极冰互相转换。' }),
      S({ id: 'thunder', name: '闪雷', lv: 6, kind: 'spell', cast: 0, potency: 40, range: 25, mp: 400, dot: { id: 'thunder', name: '闪雷', potency: 40, dur: 24, icon: ['bolt', '#e0d040', '#4a3a0a'] }, anim: 'release', vfx: 'bolt', icon: ['bolt', '#e0d040', '#4a3a0a'], desc: '威力：40\n追加效果：持续伤害 威力40 持续24秒' }),
      S({ id: 'manaward', name: '魔罩', lv: 8, kind: 'ability', gcd: false, recast: 120, target: 'self', buff: { id: 'manaward', name: '魔罩', dur: 20, mit: 0.3, icon: ['shield', '#a080e0', '#2a1a4a'] }, anim: 'buff', icon: ['shield', '#a080e0', '#2a1a4a'], desc: '20秒内受到的伤害减轻30%。' }),
      S({ id: 'swiftcast', name: '即刻咏唱', lv: 10, kind: 'ability', gcd: false, recast: 60, target: 'self', buff: { id: 'swiftcast', name: '即刻咏唱', dur: 10, instantNext: true, icon: ['star', '#e0e0ff', '#2a2a5a'] }, anim: 'buff', icon: ['star', '#e0e0ff', '#2a2a5a'], desc: '下一个魔法无需咏唱。' }),
      S({ id: 'fire2', name: '烈炎', lv: 12, kind: 'spell', cast: 3, potency: 110, range: 25, mp: 1500, element: 'fire', aoe: { shape: 'circle', r: 5, at: 'target' }, anim: 'release', vfx: 'fire2', icon: ['fire', '#ff5a2a', '#4a0a0a'], desc: '对目标及其周围的敌人发动范围攻击。威力：110' }),
      S({ id: 'fire3', name: '爆炎', lv: 14, kind: 'spell', cast: 3.5, potency: 260, range: 25, mp: 2000, element: 'fire', freeWith: 'firestarter', instantWith: 'firestarter', anim: 'release', vfx: 'fire3', icon: ['fire', '#ffd040', '#6a1a0a'], desc: '威力：260\n火苗状态下无需咏唱且不消耗魔力' }),
    ],
    lb: { name: '星体之石', icon: ['star', '#f0d060', '#6a4a0a'], desc: '极限技：对指定范围内的敌人造成巨大伤害。' },
  },
};
export const GENERAL = [
  { id: 'sprint', name: '冲刺', kind: 'ability', gcd: false, recast: 60, target: 'self', icon: ['boot', '#e0c060', '#4a3a0a'], desc: '10秒内移动速度提高。' },
  { id: 'potion', name: '回复药', kind: 'item', gcd: false, recast: 30, target: 'self', icon: ['potion', '#e0506a', '#4a0a1a'], desc: '恢复30%的最大体力。' },
  { id: 'mount', name: '陆行鸟', kind: 'ability', gcd: false, recast: 1, target: 'self', icon: ['chocobo', '#f0d040', '#6a4a0a'], desc: '骑乘或解除陆行鸟坐骑。' },
  { id: 'lb', name: '极限技', kind: 'lb', gcd: false, recast: 1, target: 'none', icon: ['lb', '#60b0ff', '#0a2a5a'], desc: '队伍的极限槽满时可以发动。' },
  { id: 'return', name: '返回', kind: 'spell', gcd: false, cast: 5, recast: 60, target: 'self', icon: ['home', '#8ac0e0', '#0a2a3a'], desc: '回到利姆萨·罗敏萨的以太之光。' },
];
export const EMOTES = [
  { id: 'wave', name: '挥手', cmd: '/wave', dur: 2, text: '{a}挥了挥手。', textT: '{a}对{b}挥了挥手。' },
  { id: 'bow', name: '鞠躬', cmd: '/bow', dur: 1.8, text: '{a}恭敬地鞠了一躬。', textT: '{a}向{b}恭敬地鞠了一躬。' },
  { id: 'cheer', name: '欢呼', cmd: '/cheer', dur: 1.6, text: '{a}开心地欢呼起来！', textT: '{a}为{b}欢呼！' },
  { id: 'dance', name: '跳舞', cmd: '/dance', loop: true, locked: true, text: '{a}跳起了舞。', textT: '{a}对着{b}跳起了舞。' },
  { id: 'sit', name: '坐下', cmd: '/sit', loop: true, text: '{a}坐了下来。' },
  { id: 'point', name: '指向', cmd: '/point', dur: 1.5, text: '{a}指向前方。', textT: '{a}指着{b}。' },
];

export function expToNext(lv) { return lv >= 15 ? Infinity : 100 + lv * 60; }
export const MAX_LEVEL = 15;

// ---------- 物品 ----------
const WNAME = { gla: '剑', mrd: '战斧', lnc: '长枪', arc: '短弓', cnj: '幻杖', thm: '咒杖' };
export function weaponItem(job, tier) {
  const pre = ['青铜', '钢铁', '海盗王的'][tier], il = [1, 5, 18][tier];
  return { id: `w_${job}_${tier}`, name: pre + WNAME[job], type: 'weapon', job, ilvl: il, dmg: [0, 4, 12][tier], icon: [JOBS[job].icon[0], ['#9a8a6a', '#b0b8c8', '#f0c050'][tier], '#2a2018'], desc: `${JOBS[job].name}专用武器` };
}
export const ITEMS = {
  potion: { id: 'potion', name: '回复药', type: 'use', icon: ['potion', '#e0506a', '#4a0a1a'], desc: '恢复30%的最大体力。' },
  gysahl: { id: 'gysahl', name: '基萨尔野菜', type: 'key', icon: ['leaf', '#6ac04a', '#1a3a10'], desc: '陆行鸟最爱的蔬菜。闻起来有股清香。' },
  package: { id: 'package', name: '雷克萨的货物', type: 'key', icon: ['box', '#c09060', '#3a2a10'], desc: '用麻绳捆好的木箱。要送去码头。' },
  whistle: { id: 'whistle', name: '陆行鸟哨子', type: 'key', icon: ['chocobo', '#f0d040', '#6a4a0a'], desc: '吹响就能召唤陆行鸟伙伴「小金」。' },
  body1: { id: 'body1', name: '冒险者外衣', type: 'armor', slot: 'body', ilvl: 1, hp: 0, icon: ['shirt', '#9a8a6a', '#2a2018'], desc: '结实耐穿的旅行外衣。' },
  body2: { id: 'body2', name: '蛇蝎帮船长外套', type: 'armor', slot: 'body', ilvl: 18, hp: 180, icon: ['shirt', '#c0402a', '#3a0a0a'], desc: '麦迪逊船长珍藏的外套。镶着金边。' },
  ring1: { id: 'ring1', name: '逆齿之牙耳饰', type: 'armor', slot: 'ear', ilvl: 18, crit: 0.05, icon: ['tooth', '#f0f0e0', '#2a3a4a'], desc: '用巨兽之牙打磨的耳饰。暴击率提高。' },
  shell: { id: 'shell', name: '泡沫蟹壳', type: 'material', icon: ['shell', '#e07050', '#4a1a0a'], desc: '切割者的外壳碎片。' },
};

// ---------- 魔物 ----------
export const MOBS = {
  ladybug: { name: '小瓢虫', model: 'ladybug', hp: 1.0, dmg: 0.8, aggro: false, speed: 4.2, range: 2.2, delay: 3 },
  rat: { name: '码头鼠', model: 'rat', hp: 1.1, dmg: 0.9, aggro: false, speed: 4.8, range: 2, delay: 2.8 },
  sahagin: { name: '沙哈金族斥候', model: 'sahagin', hp: 1.25, dmg: 0.9, aggro: true, aggroR: 7, speed: 5, range: 2.6, delay: 3, abilities: [{ name: '水之枪', cast: 2.5, every: [9, 13], shape: 'line', len: 10, width: 3, potency: 260 }] },
  sahagin_chief: { name: '沙哈金族战士长', model: 'sahagin', scale: 1.45, hp: 9, dmg: 1.2, aggro: true, speed: 5, range: 3.2, delay: 3, fateBoss: true, abilities: [{ name: '潮汐冲击', cast: 3, every: [10, 12], shape: 'circle', r: 7, at: 'self', potency: 320 }, { name: '三叉戟横扫', cast: 2.5, every: [8, 11], shape: 'cone', r: 9, angle: 120, potency: 300 }] },
  pirate: { name: '蛇蝎帮海盗', model: 'pirate', hp: 2.4, dmg: 1.0, aggro: true, speed: 5, range: 2.6, delay: 2.8, abilities: [{ name: '狂乱劈砍', cast: 2.5, every: [11, 15], shape: 'cone', r: 7, angle: 90, potency: 280 }] },
  pirate2: { name: '蛇蝎帮枪兵', model: 'pirate', weapon: 'spear', band: '#2a5a8a', hp: 2.2, dmg: 1.0, aggro: true, speed: 5, range: 3.2, delay: 3, abilities: [{ name: '突进刺击', cast: 2.5, every: [10, 14], shape: 'line', len: 12, width: 3, potency: 280 }] },
  chopper: { name: '切割者', model: 'crab', scale: 1.1, hp: 26, dmg: 1.5, speed: 3.5, range: 4.5, delay: 3, boss: 'chopper' },
  madison: { name: '麦迪逊船长', model: 'captain', scale: 1.1, hp: 27, dmg: 1.5, speed: 5, range: 3, delay: 2.8, boss: 'madison' },
  madison_add: { name: '蛇蝎帮舵手', model: 'pirate', band: '#2a2a2a', hp: 3.2, dmg: 1.0, aggro: true, speed: 5, range: 2.6, delay: 3 },
  denn: { name: '虎鲸牙·丹恩', model: 'denn', hp: 32, dmg: 1.6, speed: 0, range: 9, delay: 3.2, boss: 'denn', noMove: true },
  clam: { name: '巨蚌', model: 'clam', hp: 1.1, dmg: 0, speed: 0, range: 0, delay: 99, noMove: true, passiveAdd: true },
};

// ---------- 队友（亲信战友） ----------
export const ALLIES = {
  thancred: { name: '桑克瑞德', role: 'tank', job: '绝枪战士', app: { race: 'hyur', gender: 'm', skin: '#e8c0a0', hairStyle: 0, hairColor: '#d8d4cc', eyeColor: '#6a8aa0', height: 0.8, build: 0.6 }, gear: { top: '#4a3a2e', top2: '#6a5a4a', pants: '#2a2622', boots: '#1e1a16', gloves: '#2a2622', accent: '#8a2a2a', belt: '#1e1a16', weapon: 'gunblade', metal: '#8a8d93', shoulder: 'metal' } },
  alphinaud: { name: '阿尔菲诺', role: 'healer', job: '学者', app: { race: 'elezen', gender: 'm', skin: '#f6e2d2', hairStyle: 2, hairColor: '#f4f0e8', eyeColor: '#3f7fc0', height: 0.0, build: 0.2 }, gear: { top: '#2a4a7a', top2: '#e8e0d0', pants: '#e8e0d0', boots: '#3a2a1e', gloves: '#e8e0d0', accent: '#c9a44f', belt: '#3a2a1e', weapon: 'book', robe: true } },
  yda: { name: '伊达', role: 'melee', job: '武僧', app: { race: 'hyur', gender: 'f', skin: '#f0d2b8', hairStyle: 0, hairColor: '#b83a2a', eyeColor: '#6a4a2a', height: 0.6, build: 0.5, facePaint: 2, paintColor: '#1a1a1e' }, gear: { top: '#c85a2a', top2: '#e8dcc0', pants: '#3a2a1e', boots: '#2a1a12', gloves: '#6a2a1a', accent: '#e0b040', belt: '#e0b040' } },
  yshtola: { name: '雅·修特拉', role: 'caster', job: '黑魔法师', app: { race: 'miqote', gender: 'f', skin: '#f0dcd0', hairStyle: 4, hairColor: '#e8e4ec', eyeColor: '#b0a8c8', height: 0.3, build: 0.3, facePaint: 1, paintColor: '#4a3a6a' }, gear: { top: '#1c1a2a', top2: '#3a2a4a', pants: '#1c1a2a', boots: '#1c1a2a', gloves: '#1c1a2a', accent: '#6a4a9a', belt: '#8a6a3a', weapon: 'scepter', robe: true } },
};

// ---------- NPC ----------
export const NPCS = {
  ryssfloh: { name: '瑞斯弗洛船长', title: '远洋帆船船长', zone: 'town', pos: [50, 3.2], rot: -1.2, app: { race: 'roegadyn', gender: 'm', skin: '#d8a888', hairStyle: 7, hairColor: '#6a6a72', beard: true, height: 0.7, build: 0.8 }, gear: { top: '#2a3a5a', top2: '#e8dcc0', pants: '#2a2a33', boots: '#1e1a16', gloves: '#3a2a1e', accent: '#c9a44f', belt: '#3a2a1e', robe: true }, lines: ['海上的风今天可真舒服。', '利姆萨·罗敏萨的港口，是全艾欧泽亚最繁忙的港口！', '当年我也是个毛头小子，跟着海雄旅团四处闯荡……'] },
  baderon: { name: '巴德隆', title: '溺水海豚亭老板', zone: 'town', pos: [0, -60.6], rot: 0, app: { race: 'roegadyn', gender: 'm', skin: '#e0b090', hairStyle: 0, hairColor: '#8a7a6a', beard: true, height: 0.9, build: 1 }, gear: { top: '#e8dcc0', top2: '#e8dcc0', pants: '#4a3a2a', boots: '#2a1e14', gloves: '#e0b090', accent: '#8a3a2a', belt: '#5a3a1a', bare: false }, lines: ['要来一杯吗？本店的招牌是「海雄旅团特酿」！', '冒险者行会的委托都贴在那边的告示板上。', '不管你是哪里来的，在利姆萨·罗敏萨，只看本事。'] },
  elsa: { name: '埃尔莎', title: '冒险者导师', zone: 'town', pos: [-9, 9], rot: 0.8, app: { race: 'roegadyn', gender: 'f', skin: '#c8a888', hairStyle: 2, hairColor: '#b83a2a', height: 0.6, build: 0.8 }, gear: { ...{ top: '#6b4a36', top2: '#8a6040', pants: '#3a3028', boots: '#2e2419', gloves: '#3e2c20', accent: '#7a2a1a', metal: '#8a8d93', shoulder: 'fur', belt: '#2a1c12', weapon: 'axe' } }, lines: ['别急着冲进怪堆里。先观察，再出手。', '好的冒险者，懂得什么时候该撤退。', '记得时常查看自己的状态栏。'] },
  rexa: { name: '雷克萨', title: '杂货商人', zone: 'town', pos: [11, -9], rot: -2.4, app: { race: 'lalafell', gender: 'm', skin: '#f6d6bc', hairStyle: 5, hairColor: '#e0b060', eyeColor: '#3a9a6a' }, gear: { top: '#8a5a2a', top2: '#c8a870', pants: '#4a3a2a', boots: '#3a2a1a', gloves: '#c8a870', accent: '#3a6a3a', belt: '#3a2a1a' }, lines: ['欢迎光临！回复药、干粮，应有尽有！', '做生意嘛，讲究的是诚信和……利润！', '听说东边的海滩最近不太平哦。'] },
  popoly: { name: '波波洛', title: '好奇的孩子', zone: 'town', pos: [7, 21], rot: 3.0, app: { race: 'lalafell', gender: 'f', skin: '#fbe2cc', hairStyle: 3, hairColor: '#f0a0b0', eyeColor: '#c8a030', height: 0 }, gear: { top: '#e06a8a', top2: '#f4e0d0', pants: '#f4e0d0', boots: '#8a4a3a', gloves: '#fbe2cc', accent: '#f0d060', belt: '#8a4a3a' }, lines: ['大海好大呀！', '我长大了也要当冒险者！', '嘿嘿~'] },
  rux: { name: '鲁克斯', title: '陆行鸟房看守', zone: 'town', pos: [-56, 12.5], rot: 3.4, app: { race: 'hyur', gender: 'm', skin: '#e6c0a0', hairStyle: 0, hairColor: '#7a4a2a', height: 0.4, build: 0.6 }, gear: { top: '#6a8a3a', top2: '#c8b890', pants: '#5a4a33', boots: '#3a2d20', gloves: '#5a4028', accent: '#e0c040', belt: '#4a3420' }, lines: ['陆行鸟可是很聪明的动物。', '「Kweh!」——它们高兴的时候就会这样叫。', '小金今天精神不错。'] },
  guard1: { name: '黄衫队卫兵', title: '利姆萨·罗敏萨守卫', zone: 'town', pos: [-60, -5], rot: 1.57, app: { race: 'hyur', gender: 'm', skin: '#e6c0a0', hairStyle: 7, hairColor: '#3a2a22', height: 0.8, build: 0.8 }, gear: { top: '#d8b030', top2: '#3a3a3a', pants: '#3a3a3a', boots: '#2a2a2a', gloves: '#3a3a3a', accent: '#d8b030', metal: '#b0b6c0', shoulder: 'metal', belt: '#2a2a2a', weapon: 'spear' }, lines: ['西风门外就是拉诺西亚低地。小心魔物。', '黄衫队守护着利姆萨·罗敏萨的和平。'] },
  guard2: { name: '黄衫队卫兵', title: '利姆萨·罗敏萨守卫', zone: 'town', pos: [-60, 5], rot: 1.57, app: { race: 'roegadyn', gender: 'f', skin: '#d8a888', hairStyle: 7, hairColor: '#1a1a1e', height: 0.4, build: 0.8 }, gear: { top: '#d8b030', top2: '#3a3a3a', pants: '#3a3a3a', boots: '#2a2a2a', gloves: '#3a3a3a', accent: '#d8b030', metal: '#b0b6c0', shoulder: 'metal', belt: '#2a2a2a', weapon: 'spear' }, lines: ['站住……啊，是冒险者啊。请通过。', '最近海盗越来越猖狂了。'] },
  attendant: { name: '以太之光管理员', title: '传送网使用协会', zone: 'town', pos: [5, 7], rot: 2.6, app: { race: 'elezen', gender: 'f', skin: '#f8e4d4', hairStyle: 6, hairColor: '#5a3a26', eyeColor: '#3a6ab0' }, gear: { top: '#2a4a7a', top2: '#e8e0d0', pants: '#2a4a7a', boots: '#1e1a16', gloves: '#e8e0d0', accent: '#c9a44f', belt: '#c9a44f', robe: true }, lines: ['与以太之光共鸣后，就能通过传送网在各地之间移动了。', '传送需要支付少量金币哦。'] },
  thancred_npc: { ally: 'thancred', name: '桑克瑞德', title: '拂晓血盟', zone: 'town', pos: [-6, -52], rot: 0.5, hidden: true, lines: ['情报就是力量。', '准备好了就出发吧。'] },
  yshtola_npc: { ally: 'yshtola', name: '雅·修特拉', title: '拂晓血盟', zone: 'town', pos: [6, -52], rot: -0.5, hidden: true, lines: ['以太的流动……在告诉我一些事情。', '别小看沙哈金族。'] },
  sentry: { name: '黄衫队哨兵', title: '盛夏农庄驻守', zone: 'field', pos: [8, 20], rot: -1.6, app: { race: 'hyur', gender: 'm', skin: '#d9ab86', hairStyle: 0, hairColor: '#3a2a22', height: 0.6, build: 0.7 }, gear: { top: '#d8b030', top2: '#3a3a3a', pants: '#3a3a3a', boots: '#2a2a2a', gloves: '#3a3a3a', accent: '#d8b030', metal: '#b0b6c0', shoulder: 'metal', belt: '#2a2a2a', weapon: 'spear' }, lines: ['盛夏农庄的葡萄酒，可是一绝。', '东边海滩要多加小心。'] },
  farmer: { name: '农夫格雷', title: '盛夏农庄', zone: 'field', pos: [-24, 50], rot: 0.3, app: { race: 'hyur', gender: 'm', skin: '#c99470', hairStyle: 7, hairColor: '#8a8a92', beard: true, height: 0.3, build: 0.6 }, gear: { top: '#8a7a5a', top2: '#c8b890', pants: '#4a3a2a', boots: '#3a2a1a', gloves: '#6a5a4a', accent: '#6a8a3a', belt: '#3a2a1a' }, lines: ['今年的麦子长得真好。', '那些瓢虫啊，老是啃我的菜叶子。'] },
};
export const CITIZENS = [
  { name: '水手', app: { race: 'roegadyn', gender: 'm', hairStyle: 0, hairColor: '#2a2a30', skin: '#c99470' }, gear: { top: '#e8e0d0', top2: '#2a4a7a', pants: '#2a3a5a', boots: '#2a1a12', gloves: '#c99470', accent: '#2a4a7a', belt: '#2a1a12' } },
  { name: '市民', app: { race: 'hyur', gender: 'f', hairStyle: 1, hairColor: '#a0602e', skin: '#f0d2b8' }, gear: { top: '#8a3a4a', top2: '#e8d8c0', pants: '#4a3a3a', boots: '#3a2a22', gloves: '#f0d2b8', accent: '#e0b040', belt: '#3a2a22', robe: true } },
  { name: '商人', app: { race: 'lalafell', gender: 'm', hairStyle: 0, hairColor: '#3a2a22' }, gear: { top: '#3a6a4a', top2: '#e0d0b0', pants: '#4a3a2a', boots: '#2a1a12', gloves: '#e0d0b0', accent: '#c9a44f', belt: '#2a1a12' } },
  { name: '冒险者', app: { race: 'miqote', gender: 'f', hairStyle: 2, hairColor: '#2a2a30', skin: '#f0ceb2', eyeColor: '#6ab04a' }, gear: JOBS_GEAR_ARC() },
  { name: '冒险者', app: { race: 'elezen', gender: 'm', hairStyle: 1, hairColor: '#e0b060', skin: '#f2d8c4' }, gear: { top: '#2e2238', top2: '#6a4a7a', pants: '#221a22', boots: '#221a22', gloves: '#3a2a3a', accent: '#b0404a', belt: '#8a6a3a', weapon: 'scepter', robe: true } },
  { name: '渔夫', app: { race: 'hyur', gender: 'm', hairStyle: 7, hairColor: '#5a3a26', skin: '#b07a58', beard: true }, gear: { top: '#6a7a8a', top2: '#c8c0b0', pants: '#3a3a3a', boots: '#2a2a2a', gloves: '#b07a58', accent: '#3a5a7a', belt: '#2a2a2a' } },
  { name: '市民', app: { race: 'aura', gender: 'f', hairStyle: 4, hairColor: '#1a1a1e', skin: '#f6e6dc', scaleColor: '#3a3a44' }, gear: { top: '#c8a0c0', top2: '#f4e8e0', pants: '#8a6a8a', boots: '#4a3a4a', gloves: '#f6e6dc', accent: '#8a4a8a', belt: '#4a3a4a', robe: true } },
  { name: '旅人', app: { race: 'viera', gender: 'f', hairStyle: 1, hairColor: '#f4f0e8', skin: '#b48a6e' }, gear: { top: '#5a6a3a', top2: '#c8b890', pants: '#3a3a2a', boots: '#2a2a1a', gloves: '#5a4028', accent: '#a0b860', belt: '#3a2a1a' } },
];
function JOBS_GEAR_ARC() { return { top: '#4f6b3a', top2: '#9a8a60', pants: '#5a4a33', boots: '#3a2d20', gloves: '#5a4028', accent: '#a0b860', metal: '#9a8a70', belt: '#4a3420', weapon: 'bow' }; }
export const BARKS = ['今天的海风好舒服。', '听说溺水海豚亭又来了新的冒险者。', '海盗？哼，黄衫队会收拾他们的。', '以太之光今天也闪闪发亮呢。', '要不要去市场逛逛？', '最近鱼价又涨了……', '那边那位，是新来的冒险者吧？'];

// ---------- 任务 ----------
// step: talk / kill / interact / gather / emote / duty
export const QUESTS = {
  q1: {
    id: 'q1', type: 'msq', title: '利姆萨·罗敏萨之旅', lv: 1, giver: 'ryssfloh', auto: true,
    desc: '瑞斯弗洛船长建议你去上层甲板的「溺水海豚亭」，拜访冒险者行会的负责人巴德隆。',
    steps: [{ type: 'talk', npc: 'baderon', text: '与溺水海豚亭的巴德隆交谈', lines: [
      ['巴德隆', '哦？新面孔啊。欢迎来到溺水海豚亭！我是巴德隆，这家店的老板，也负责打理冒险者行会。'],
      ['巴德隆', '{race}的{job}吗……不错不错。看你这双眼睛，就知道是想干一番大事的人。'],
      ['巴德隆', '在利姆萨·罗敏萨，冒险者可是很吃香的。海盗、魔物、还有那些不安分的蛮族——活儿多得是！'],
      ['巴德隆', '好了，登记表我帮你填好了。从今天起，你就是冒险者行会的一员了，{name}！'],
    ] }],
    rewards: { exp: 300, gil: 100 },
  },
  q2: {
    id: 'q2', type: 'msq', title: '以太之光的共鸣', lv: 1, giver: 'baderon', prereq: ['q1'],
    desc: '巴德隆让你去下层甲板的以太之光广场，与巨大的以太之光水晶进行共鸣。',
    offer: [['巴德隆', '冒险者的第一件事：去下层甲板的以太之光广场，和那块巨大的水晶「共鸣」。'], ['巴德隆', '共鸣之后，你就可以通过传送回到这里。对冒险者来说，这可比什么都重要。']],
    steps: [
      { type: 'interact', target: 'aetheryte', text: '与以太之光广场的以太之光共鸣' },
      { type: 'talk', npc: 'baderon', text: '向巴德隆报告', lines: [
        ['巴德隆', '共鸣完成了？……嗯？你的脸色怎么有点奇怪？'],
        ['巴德隆', '听到了声音？……哈哈，大概是水晶的回响吧。据说有些人天生就能听见水晶的低语。'],
        ['巴德隆', '算了，别想太多。你已经是个像样的冒险者了！'],
      ] },
    ],
    rewards: { exp: 400, gil: 150, items: [['potion', 3]] },
  },
  q3: {
    id: 'q3', type: 'msq', title: '冒险者的试炼', lv: 2, giver: 'elsa', prereq: ['q2'],
    desc: '冒险者导师埃尔莎想要考验你的实力。前往西风门外的拉诺西亚低地，讨伐小瓢虫。',
    offer: [['埃尔莎', '你就是巴德隆说的新人？我是负责指导新手的埃尔莎。'], ['埃尔莎', '光有热情可不够。出西风门，到拉诺西亚低地去，讨伐4只「小瓢虫」。'], ['埃尔莎', '让我看看你这个{job}的本事。']],
    steps: [
      { type: 'kill', mob: 'ladybug', count: 4, text: '讨伐拉诺西亚低地的小瓢虫' },
      { type: 'talk', npc: 'elsa', text: '向埃尔莎报告', lines: [['埃尔莎', '干得漂亮！你的动作比我想象的利落多了。'], ['埃尔莎', '这把武器你拿着——比你现在用的顺手多了。好好用它。']] },
    ],
    rewards: { exp: 600, gil: 200, weapon: 1 },
  },
  q4: {
    id: 'q4', type: 'msq', title: '沙哈金族的阴影', lv: 4, giver: 'baderon', prereq: ['q3'],
    desc: '拉诺西亚沿岸出现了沙哈金族的身影。巴德隆让你去盛夏农庄找黄衫队的哨兵了解情况。',
    offer: [['巴德隆', '来得正好，{name}。最近拉诺西亚沿岸不太平——有人看见沙哈金族在海滩上集结。'], ['巴德隆', '去盛夏农庄的以太之光附近，找黄衫队的哨兵。他会告诉你详细情况。']],
    steps: [
      { type: 'talk', npc: 'sentry', text: '与盛夏农庄的黄衫队哨兵交谈', lines: [['黄衫队哨兵', '你是巴德隆派来的冒险者？太好了！'], ['黄衫队哨兵', '那些鱼人……沙哈金族，最近总在东边的海滩上转悠。它们在搜集水晶，像是在准备什么仪式。'], ['黄衫队哨兵', '帮我们击退3只沙哈金族斥候吧！它们很凶，千万小心。']] },
      { type: 'kill', mob: 'sahagin', count: 3, text: '击退东部海滩的沙哈金族斥候' },
      { type: 'talk', npc: 'baderon', text: '向巴德隆报告', lines: [['巴德隆', '干掉了？好样的！不过……沙哈金族搜集水晶，只意味着一件事。'], ['巴德隆', '它们想召唤它们的神——「利维亚桑」。'], ['巴德隆', '……这事比我想的还要麻烦。']] },
    ],
    rewards: { exp: 900, gil: 400 },
  },
  q5: {
    id: 'q5', type: 'msq', title: '拂晓的来访者', lv: 6, giver: 'baderon', prereq: ['q4'],
    desc: '神秘组织「拂晓血盟」的成员找上了你。他们邀请你一同调查海盗与沙哈金族藏身的沙斯塔夏溶洞。',
    offer: [['巴德隆', '有两位客人一直在等你。他们对你的事很感兴趣。'], ['巴德隆', '就在那边——去跟他们打个招呼吧。']],
    steps: [
      { type: 'duty', duty: 'sastasha', text: '攻略「天然要害沙斯塔夏溶洞」' },
      { type: 'talk', npc: 'yshtola_npc', text: '与溺水海豚亭的雅·修特拉交谈', lines: [
        ['雅·修特拉', '你们平安回来了。……果然没有看错人。'],
        ['雅·修特拉', '蛇蝎帮溃散了，那头巨兽也被讨伐。但沙哈金族不会就此罢手。'],
        ['桑克瑞德', '蛮神的阴影正在艾欧泽亚各地蔓延。第七灵灾的伤痕还未愈合，新的风暴已在酝酿。'],
        ['雅·修特拉', '{name}，拂晓血盟需要你的力量。……当然，决定权在你。'],
      ] },
    ],
    rewards: { exp: 2500, gil: 1500, items: [['potion', 5]] },
  },
  s1: {
    id: 's1', type: 'side', title: '跑腿的冒险者', lv: 1, giver: 'rexa', prereq: ['q1'],
    desc: '杂货商人雷克萨拜托你把一箱货物送到码头的瑞斯弗洛船长那里。',
    offer: [['雷克萨', '冒险者？正好！能帮我把这箱货送到码头的瑞斯弗洛船长那里吗？'], ['雷克萨', '我这摊子实在走不开啊，拜托啦！']],
    giveItem: 'package',
    steps: [{ type: 'talk', npc: 'ryssfloh', text: '把货物交给码头的瑞斯弗洛船长', takeItem: 'package', lines: [['瑞斯弗洛船长', '哦，是雷克萨的货！辛苦你了。'], ['瑞斯弗洛船长', '拿着，这是跑腿费。雷克萨那家伙，可从来不会亏待帮他的人。']] }],
    rewards: { exp: 200, gil: 150, items: [['potion', 2]] },
  },
  s2: {
    id: 's2', type: 'side', title: '小小的问候', lv: 1, giver: 'popoly',
    desc: '拉拉菲尔族的小女孩波波洛想看看冒险者是怎么打招呼的。',
    offer: [['波波洛', '你好呀！妈妈说，冒险者都是很有礼貌的人……'], ['波波洛', '你能对我挥挥手吗？（选中波波洛后，使用情感动作「挥手」或输入 /wave）']],
    steps: [{ type: 'emote', npc: 'popoly', emote: 'wave', text: '对波波洛使用情感动作「挥手」', lines: [['波波洛', '哇！你真的挥手了！嘿嘿嘿~'], ['波波洛', '作为回礼，我教你一个超厉害的舞蹈吧！看好了——']] }],
    rewards: { exp: 150, gil: 50, emote: 'dance' },
  },
  s3: {
    id: 's3', type: 'side', title: '陆行鸟之友', lv: 2, giver: 'rux', prereq: ['q2'],
    desc: '陆行鸟房看守鲁克斯照顾的陆行鸟「小金」饿坏了。去拉诺西亚低地采集基萨尔野菜吧。',
    offer: [['鲁克斯', '这是我照顾的陆行鸟「小金」。它饿坏了……'], ['鲁克斯', '你能去拉诺西亚低地采集3株基萨尔野菜吗？野菜长在盛夏农庄附近，会闪闪发光的。']],
    steps: [
      { type: 'gather', item: 'gysahl', count: 3, text: '在盛夏农庄附近采集基萨尔野菜' },
      { type: 'talk', npc: 'rux', text: '把基萨尔野菜交给鲁克斯', takeItem: 'gysahl', lines: [['鲁克斯', '小金吃得好开心！……看来它很喜欢你。'], ['鲁克斯', '这个「陆行鸟哨子」送给你。从今以后，它就是你的伙伴了！（按 V 键召唤坐骑）']] },
    ],
    rewards: { exp: 300, gil: 100, mount: true, items: [['whistle', 1]] },
  },
  s4: {
    id: 's4', type: 'side', title: '码头鼠患', lv: 3, giver: 'ryssfloh', prereq: ['q1'],
    desc: '港口仓库被码头鼠啃得一塌糊涂。去拉诺西亚低地的海岸消灭码头鼠。',
    offer: [['瑞斯弗洛船长', '港口的仓库最近被码头鼠啃得一塌糊涂……'], ['瑞斯弗洛船长', '那些家伙是从城外海岸跑来的。帮我在拉诺西亚低地消灭5只码头鼠吧！']],
    steps: [
      { type: 'kill', mob: 'rat', count: 5, text: '消灭拉诺西亚低地的码头鼠' },
      { type: 'talk', npc: 'ryssfloh', text: '向瑞斯弗洛船长报告', lines: [['瑞斯弗洛船长', '干得好！仓库总算能清净几天了。'], ['瑞斯弗洛船长', '今晚的酒我请！哈哈哈！']] },
    ],
    rewards: { exp: 400, gil: 300 },
  },
};
export const TIPS = [
  '按 Tab 键可以依次选中附近的敌人。',
  '连击技能在连击成立时会发出光芒，按顺序使用威力更高。',
  '橙色的范围预兆代表敌人即将发动攻击，赶快离开范围！',
  '队伍中的防护职业负责吸引仇恨，治疗职业负责恢复体力。',
  '与以太之光共鸣后，可以在地图上选择传送目的地。',
  '按 U 键打开任务搜索器，可以申请参加副本。',
  '按 V 键可以召唤陆行鸟坐骑（需要先完成支线任务「陆行鸟之友」）。',
  '在聊天框输入 /wave、/dance、/bow 等指令可以使用情感动作。',
  '艾欧泽亚时间比现实时间快约20倍，一天只有70分钟。',
  '极限槽充满后，可以发动威力强大的极限技。',
];
