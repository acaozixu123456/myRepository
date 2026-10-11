import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/content/story';
import { CHAPTERS } from '../src/content/campaign';
import { HEROES } from '../src/data/heroes';

const expectedIds = [1, 2, 3, 4, 5, 6].flatMap((chapter) => ['open', 'mid', 'boss_pre', 'boss_post'].map((part) => `c${chapter}_${part}`));
const speakers = new Set(['narrator', 'player', ...HEROES.map((hero) => hero.id)]);
const moods = new Set(['normal', 'happy', 'angry', 'sad', 'surprised', 'sly']);

describe('六章剧情对白', () => {
  it('二十四段标识唯一且完整，标题是非空中文', () => {
    expect(STORIES).toHaveLength(24);
    expect(new Set(STORIES.map((story) => story.id)).size).toBe(24);
    expect(STORIES.map((story) => story.id).sort()).toEqual([...expectedIds].sort());
    for (const story of STORIES) {
      expect(story.title.trim()).not.toBe('');
      expect(story.title).not.toMatch(/[a-zA-Z]/);
    }
  });

  it('每段十二至二十四句，所有说话者与表情有效，单句不超过五十字', () => {
    for (const story of STORIES) {
      expect(story.lines.length, story.id).toBeGreaterThanOrEqual(12);
      expect(story.lines.length, story.id).toBeLessThanOrEqual(24);
      for (const line of story.lines) {
        expect(speakers.has(line.who), `${story.id}: ${line.who}`).toBe(true);
        expect(line.text.trim(), story.id).not.toBe('');
        expect(line.text, story.id).toBe(line.text.trim());
        expect(Array.from(line.text).length, `${story.id}: ${line.text}`).toBeLessThanOrEqual(50);
        expect(line.text, story.id).not.toMatch(/[a-zA-Z]/);
        if (line.mood !== undefined) expect(moods.has(line.mood), story.id).toBe(true);
      }
    }
  });

  it('六章出场角色覆盖剧情要求，铲屎官的台词保持少量', () => {
    const required = [
      ['shu_zhugemiaoliang', 'qun_dongzhuo'],
      ['wei_caomiaode', 'wei_guojia', 'shu_liumiaobei', 'shu_guanyunmiao', 'shu_zhangmiaofei'],
      ['wu_zhoumiaoyu', 'shu_zhugemiaoliang', 'wu_huanggai', 'wei_caomiaode'],
      ['man_mengmiaohuo', 'man_zhurong', 'man_mulu', 'man_wutugu', 'shu_zhugemiaoliang'],
      ['xian_zuoci', 'xian_zhangzhua', 'xian_shuijing', 'xian_guanlu'],
      ['qun_lvbuding', 'qun_dongzhuo', 'wei_caomiaode', 'shu_liumiaobei', 'player'],
    ];
    required.forEach((ids, chapter) => {
      const who = new Set(STORIES.filter((story) => story.id.startsWith(`c${chapter + 1}_`)).flatMap((story) => story.lines.map((line) => line.who)));
      for (const id of ids) expect(who.has(id), `第${chapter + 1}章: ${id}`).toBe(true);
    });
    for (const story of STORIES) expect(story.lines.filter((line) => line.who === 'player').length, story.id).toBeLessThanOrEqual(2);
    const lines = STORIES.flatMap((story) => story.lines);
    expect(lines.filter((line) => line.who === 'player').length / lines.length).toBeLessThanOrEqual(0.15);
  });

  it('全部关卡前后剧情引用均能解析，无未挂接的对白', () => {
    const hookedIds = CHAPTERS.flatMap((chapter) => chapter.stages.flatMap((stage) =>
      [stage.storyId, stage.storyPostId].filter((id): id is string => id !== undefined)));
    expect(hookedIds.sort()).toEqual([...expectedIds].sort());
    const byId = new Map(STORIES.map((story) => [story.id, story]));
    for (const id of hookedIds) expect(byId.has(id), id).toBe(true);
  });
});
