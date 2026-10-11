import { describe, expect, it } from 'vitest';
import { checksum, exportSave, importSave } from '../src/game/backup';
import { ensureEvents } from '../src/game/events';
import { joinGuild } from '../src/game/guild';
import { newPlayer } from '../src/game/state';

describe('存档备份', () => {
  it('导出再导入：内容原样读回（含中文昵称和新玩法状态）', () => {
    const s = newPlayer(1000); s.name = '曹子胥·铲屎官'; s.res.fish = 123456; s.res.moon = 200000;
    joinGuild(s, 'g_box', 5000); ensureEvents(s, 5000).spinTotal = 7;
    const text = exportSave(s);
    expect(text.startsWith('MGZ1.')).toBe(true);
    const r = importSave(text, 1000);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.state.name).toBe('曹子胥·铲屎官'); expect(r.state.res.fish).toBe(123456); expect(r.state.res.moon).toBe(200000); expect(r.state.guild?.id).toBe('g_box'); expect(r.state.events?.spinTotal).toBe(7); expect(JSON.parse(r.raw).v).toBe(1); }
  });
  it('粘贴时有空白 / 换行也能导入', () => {
    const text = exportSave(newPlayer(0));
    const messy = `  ${text.slice(0, 40)}\n${text.slice(40, 90)}  \r\n${text.slice(90)} `;
    expect(importSave(messy).ok).toBe(true);
  });
  it('不是存档 / 丢字符 / 被改动 / 缺字段都会被拒绝，且给出原因', () => {
    expect(importSave('hello').ok).toBe(false);
    const text = exportSave(newPlayer(0));
    const cut = importSave(text.slice(0, -6));
    expect(cut.ok).toBe(false);
    const dot = text.indexOf('.', 5);
    const tampered = importSave(text.slice(0, dot + 1) + 'AAAA' + text.slice(dot + 5));
    expect(tampered.ok).toBe(false);
    expect(importSave('MGZ1.').ok).toBe(false);
    const bad = JSON.stringify({ v: 1, heroes: {}, res: {} });
    const b64 = btoa(bad);
    const fake = importSave(`MGZ1.${checksum(bad)}.${b64}`);
    expect(fake.ok).toBe(false);
  });
  it('导入后的存档能通过正常读档流程补全旧版缺失字段', () => {
    const s = newPlayer(0) as unknown as Record<string, unknown>;
    delete s.tower; delete s.stories;
    const json = JSON.stringify(s);
    const r = importSave(`MGZ1.${checksum(json)}.${btoa(unescape(encodeURIComponent(json)))}`);
    expect(r.ok && r.state.tower).toEqual({ floor: 0 });
  });
});
