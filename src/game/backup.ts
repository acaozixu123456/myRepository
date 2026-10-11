// 存档备份：导出成一段文本（带校验和），换设备 / 清缓存后可粘贴导入。纯函数，不依赖 DOM。
import { SAVE_KEY, load } from './state';
import type { PlayerState } from './state';

const PREFIX = 'MGZ1.';
/** 简单的 32 位校验（FNV-1a），用来发现粘贴时丢字符 / 改动 */
export function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const fromB64 = (s: string) => decodeURIComponent(escape(atob(s)));

export function exportSave(s: PlayerState): string {
  const json = JSON.stringify(s);
  return `${PREFIX}${checksum(json)}.${toB64(json)}`;
}
export type ImportResult = { ok: true; state: PlayerState; raw: string } | { ok: false; reason: string };
export function importSave(text: string, now = Date.now()): ImportResult {
  const t = text.trim().replace(/\s+/g, '');
  if (!t.startsWith(PREFIX)) return { ok: false, reason: '这不是猫国志的存档文本' };
  const rest = t.slice(PREFIX.length), dot = rest.indexOf('.');
  if (dot <= 0) return { ok: false, reason: '存档文本不完整' };
  let json: string;
  try { json = fromB64(rest.slice(dot + 1)); } catch { return { ok: false, reason: '存档文本损坏，无法解码' }; }
  if (checksum(json) !== rest.slice(0, dot)) return { ok: false, reason: '校验失败：粘贴时可能丢了字符' };
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, reason: '存档内容不是有效的数据' }; }
  const probe = raw as Partial<PlayerState> | null;
  if (!probe || probe.v !== 1 || !probe.heroes || !probe.res || !Array.isArray(probe.lineup)) return { ok: false, reason: '存档缺少必要的字段' };
  // 走正常读档流程，让所有迁移 / 补全生效
  const state = load({ getItem: (k) => (k === SAVE_KEY ? json : null), setItem: () => undefined }, now);
  if (state.v !== 1 || !Object.keys(state.heroes).length) return { ok: false, reason: '存档里没有猫猫' };
  return { ok: true, state, raw: json };
}
