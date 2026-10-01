// 多角色存档：每个角色一个存档槽（localStorage），另有一份索引记录角色列表与最近游玩的角色。
// 旧版本只有一个存档，首次加载时自动迁移为第一个角色。存储不可用（隐私模式等）时只在内存中保留。
const INDEX_KEY = 'eorzea-fan-chars-v1';
const LEGACY_KEY = 'eorzea-fan-save-v1';
const slotKey = (id) => LEGACY_KEY + ':' + id;
export const MAX_CHARS = 8;

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 忽略 */ } },
};
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const Saves = {
  index: null, mem: new Map(),

  load() {
    if (this.index) return this.index;
    const idx = parse(ls.get(INDEX_KEY));
    this.index = idx && Array.isArray(idx.chars) ? idx : { v: 1, chars: [], last: null };
    // 旧版单一存档 → 第一个角色
    const legacy = parse(ls.get(LEGACY_KEY));
    if (legacy && legacy.name && !this.index.chars.length) {
      const id = newId();
      if (ls.set(slotKey(id), JSON.stringify(legacy))) {
        this.index.chars.push(this.meta(id, legacy)); this.index.last = id; this.flush();
        ls.del(LEGACY_KEY);
      }
    }
    // 去掉存档已丢失的条目
    this.index.chars = this.index.chars.filter((c) => this.mem.has(c.id) || ls.get(slotKey(c.id)) !== null);
    return this.index;
  },
  flush() { ls.set(INDEX_KEY, JSON.stringify(this.index)); },
  meta(id, s, prev = {}) {
    return { id, name: s.name, job: s.job, lv: s.level, race: (s.app || {}).race, gender: (s.app || {}).gender, zone: s.zone || 'town', created: prev.created || (s.stats && s.stats.start) || Date.now(), at: Date.now() };
  },
  // 按最近游玩排序
  list() { return [...this.load().chars].sort((a, b) => b.at - a.at); },
  count() { return this.load().chars.length; },
  last() { const idx = this.load(); return idx.chars.find((c) => c.id === idx.last) || this.list()[0] || null; },
  read(id) {
    if (this.mem.has(id)) return JSON.parse(JSON.stringify(this.mem.get(id)));
    return parse(ls.get(slotKey(id)));
  },
  write(id, save) {
    const idx = this.load();
    if (!ls.set(slotKey(id), JSON.stringify(save))) this.mem.set(id, JSON.parse(JSON.stringify(save)));
    const i = idx.chars.findIndex((c) => c.id === id), m = this.meta(id, save, idx.chars[i]);
    if (i >= 0) idx.chars[i] = m; else idx.chars.push(m);
    idx.last = id; this.flush();
  },
  create(save) {
    if (this.count() >= MAX_CHARS) return null;
    const id = newId(); this.write(id, save); return id;
  },
  remove(id) {
    const idx = this.load();
    idx.chars = idx.chars.filter((c) => c.id !== id); if (idx.last === id) idx.last = null;
    ls.del(slotKey(id)); this.mem.delete(id); this.flush();
  },
};
