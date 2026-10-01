// 战斗模拟的共享定义：NPC 技能组、状态登记表（客户端据此显示名称与图标）、魔物判定半径、职能分配
import { JOBS } from '../data.js';

export const NPC_KIT = {
  tank: { gcd: [{ name: '利刃斩', p: 200, anim: 'slash', fx: 'slash' }, { name: '残暴弹', p: 300, anim: 'slash2', fx: 'slash' }, { name: '迅连斩', p: 380, anim: 'heavy', fx: 'slash' }], aoe: { name: '恶魔切', p: 110, r: 5, anim: 'spin', fx: 'spin' } },
  melee: { gcd: [{ name: '连击', p: 230, anim: 'punch', fx: 'hit' }, { name: '正拳', p: 270, anim: 'punch', fx: 'hit' }, { name: '崩拳', p: 310, anim: 'punch', fx: 'hit' }], aoe: { name: '破坏神冲', p: 110, r: 5, anim: 'spin', fx: 'spin' } },
  caster: { gcd: [{ name: '火炎', p: 240, cast: 2.3, anim: 'release', fx: 'fire' }, { name: '冰结', p: 200, cast: 2.3, anim: 'release', fx: 'ice' }], aoe: { name: '烈炎', p: 120, r: 5, cast: 2.8, anim: 'release', fx: 'fire2' } },
  healer: { dmg: { name: '毁灭', p: 170, cast: 1.5, anim: 'release', fx: 'ruin' } },
};

// 魔物的判定半径（与客户端模型尺寸一致）
export const MOB_RADIUS = { ladybug: 0.55, rat: 0.6, sahagin: 0.55, sahagin_chief: 0.8, pirate: 0.55, pirate2: 0.55, chopper: 3.3, madison: 0.6, madison_add: 0.55, denn: 9.6, clam: 1.1 };

// 状态登记表：服务器只同步 sid，客户端查表得到名称、图标、是否减益
export const STATUS = {
  astral_fire: { name: '星极火', icon: ['fire', '#ff6a2a', '#5a0a0a'] },
  umbral_ice: { name: '灵极冰', icon: ['ice', '#6ac8ff', '#0a2a5a'] },
  stun: { name: '眩晕', icon: ['star', '#f0e060', '#4a3a0a'], debuff: true },
  weak: { name: '衰弱', icon: ['skull', '#8a8a8a', '#2a2a2a'], debuff: true },
  poison: { name: '水毒', icon: ['drop', '#6ac040', '#1a3a0a'], debuff: true },
  empower: { name: '海之力', icon: ['drop', '#ff6ab0', '#4a0a2a'] },
  nebula: { name: '星云', icon: ['shield', '#6a8ae0', '#1a2a5a'] },
  shieldwall: { name: '盾墙', icon: ['shield', '#f0d060', '#6a4a0a'] },
  royal_guard: { name: '王室亲卫', icon: ['shield', '#5a7ab0', '#1a2440'] },
};
for (const j of Object.values(JOBS)) for (const s of j.skills) {
  if (s.buff) STATUS[s.buff.id] = { name: s.buff.name, icon: s.buff.icon };
  if (s.combo && s.combo.buff) STATUS[s.combo.buff.id] = { name: s.combo.buff.name, icon: s.combo.buff.icon };
  if (s.dot) STATUS[s.dot.id] = { name: s.dot.name, icon: s.dot.icon, debuff: true };
  if (s.proc) STATUS[s.proc.id] = { name: s.proc.name, icon: s.proc.icon };
  if (s.toggle) STATUS[s.toggle] = { name: s.name, icon: s.icon };
}

// 职能 → 亲信战友；副本标准编成：1 防护、1 治疗、2 输出
export const TRUST = { tank: 'thancred', healer: 'alphinaud', melee: 'yda', dps: 'yshtola' };
export const dpsRole = (role) => role === 'melee' || role === 'ranged' || role === 'caster';
export const slotOf = (role) => (dpsRole(role) ? 'dps' : role);
export const PARTY_SLOTS = { tank: 1, healer: 1, dps: 2 };

// 技能命中前的延迟：与客户端特效（刀光、投射物飞行）对齐，伤害数字在特效落地时出现
export const FX_DELAY = { slash: 0.12, thrust: 0.15, spin: 0.15, cone: 0.15, line: 0.15, fire: 0.25, fire2: 0.25, fire3: 0.25, ice: 0.25, bolt: 0.1, stone: 0.35, wind: 0.1, hit: 0.15 };
export const FX_SPEED = { arrow: 48, arrow2: 48, arrowpoison: 48, arrowwind: 48, shieldlob: 30, axe: 30, spearthrow: 30, ruin: 20 };
// 按编成补足亲信战友：roles 为玩家的职能，have 为已在队伍中的亲信战友 [{ role, key }]
export function trustFill(roles, have = []) {
  const need = { ...PARTY_SLOTS };
  for (const r of roles) { const s = slotOf(r); if (need[s] > 0) need[s]--; }
  for (const a of have) { const s = slotOf(a.role); if (need[s] > 0) need[s]--; }
  const used = new Set(have.map((a) => a.key)), keys = [];
  if (need.tank > 0 && !used.has(TRUST.tank)) keys.push(TRUST.tank);
  if (need.healer > 0 && !used.has(TRUST.healer)) keys.push(TRUST.healer);
  for (const k of roles.includes('melee') ? [TRUST.dps, TRUST.melee] : [TRUST.melee, TRUST.dps]) if (need.dps > 0 && !used.has(k)) { keys.push(k); need.dps--; }
  return keys;
}
