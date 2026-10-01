// 联机协议：客户端与房间服务器共用的常量与数据校验（不依赖 DOM / three.js，服务器端也会打包本文件）
export const NET_ZONES = ['town', 'field'];
export const MAX_PLAYERS = 60;
export const MAX_MSG = 4096;
export const RACE_IDS = ['hyur', 'elezen', 'lalafell', 'miqote', 'roegadyn', 'aura', 'viera', 'hrothgar'];
export const JOB_IDS = ['gla', 'mrd', 'lnc', 'arc', 'cnj', 'thm'];
// 可以广播给其他玩家的一次性动作与循环动作
export const ANIMS = ['slash', 'slash2', 'heavy', 'thrust', 'spin', 'shoot', 'release', 'heal', 'buff', 'punch', 'wave', 'bow', 'cheer', 'point', 'lb', 'jumpatk', 'attune', 'victory', 'nod'];
export const LOOPS = ['cast', 'dance', 'sit', 'kneel'];
export const EMOTE_IDS = ['wave', 'bow', 'cheer', 'dance', 'sit', 'point'];

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v, lo, hi, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const int = (v, lo, hi, d = 0) => Math.round(num(v, lo, hi, d));
const color = (v, d) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d);

// 去掉控制字符与双向文本覆盖字符，防止名字或聊天内容扰乱排版
const UNSAFE = new RegExp('[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]', 'g');
export function cleanText(s, n) {
  return String(s ?? '').replace(UNSAFE, '').trim().slice(0, n);
}
export function cleanApp(a) {
  a = a && typeof a === 'object' ? a : {};
  return {
    race: RACE_IDS.includes(a.race) ? a.race : 'hyur', gender: a.gender === 'm' ? 'm' : 'f',
    height: num(a.height, 0, 1, 0.5), build: num(a.build, 0, 1, 0.5), feature: num(a.feature, 0, 1, 0.5),
    skin: color(a.skin, '#f0d2b8'), hairStyle: int(a.hairStyle, 0, 7, 1), hairColor: color(a.hairColor, '#3b2a22'), eyeColor: color(a.eyeColor, '#3f7fc0'),
    eyeShape: int(a.eyeShape, 0, 2), brows: int(a.brows, 0, 2), mouth: int(a.mouth, 0, 2), facePaint: int(a.facePaint, 0, 5),
    paintColor: color(a.paintColor, '#b8323a'), scaleColor: color(a.scaleColor, '#5d7aa8'),
  };
}
export function cleanLook(m) {
  m = m && typeof m === 'object' ? m : {};
  return { name: cleanText(m.name, 16) || '冒险者', app: cleanApp(m.app), job: JOB_IDS.includes(m.job) ? m.job : 'gla', lv: int(m.lv, 1, 15, 1), body: m.body === 'body2' ? 'body2' : 'body1' };
}
export function cleanState(m) {
  m = m && typeof m === 'object' ? m : {};
  return { x: num(m.x, -2000, 2000), y: num(m.y, -500, 500), z: num(m.z, -2000, 2000), r: num(m.r, -10, 10), sp: num(m.sp, 0, 30), m: m.m ? 1 : 0, a: m.a ? 1 : 0, d: m.d ? 1 : 0, e: LOOPS.includes(m.e) ? m.e : '' };
}
