// 状态效果（战斗语言）。名字全部猫化，一看就懂。
export type StatusKind = 'buff' | 'debuff';

export interface StatusDef {
  id: string;
  name: string;
  kind: StatusKind;
  icon: string; // UI 图标 emoji 占位（正式版换手绘图标）
  desc: string;
  note?: string;
}

export const STATUSES: StatusDef[] = [
  { id: 'fluff', name: '炸毛', kind: 'buff', icon: '⚡', desc: '攻击力提高（常见 +20%~30%）。', note: '可叠层，同名取最高。' },
  { id: 'curl', name: '团团', kind: 'buff', icon: '🛡', desc: '蜷成毛团，防御力提高。' },
  { id: 'purr', name: '呼噜', kind: 'buff', icon: '💗', desc: '每回合开始回复一定比例的最大生命。', note: '呼噜声越大，回得越多。' },
  { id: 'coat', name: '护体毛', kind: 'buff', icon: '☁', desc: '获得护盾，先于生命值承受伤害。', note: '魏势力「铁壁」的主力。' },
  { id: 'step', name: '猫步', kind: 'buff', icon: '👣', desc: '速度提高，更早出手。' },
  { id: 'nine', name: '九命', kind: 'buff', icon: '✨', desc: '受到致命伤害时免死一次，并保留少量生命。', note: '每场战斗每只猫猫最多触发 1 次。' },
  { id: 'illusion', name: '幻象', kind: 'buff', icon: '🌀', desc: '留下幻象替身，闪避下一次受到的攻击。' },
  { id: 'taunt', name: '挑衅', kind: 'buff', icon: '😼', desc: '嘲讽：敌方普攻只能选择自己。' },
  { id: 'ward', name: '护佑', kind: 'buff', icon: '🛡️', desc: '受到的所有伤害降低（数值见技能说明）。', note: '真正的“减伤”，不是加防御。' },
  { id: 'poison', name: '毒瘴', kind: 'debuff', icon: '☠️', desc: '每回合受到持续毒伤（按施加者攻击力计，可叠层）。', note: '蛮势力的山林毒瘴。' },
  { id: 'stealth', name: '潜行', kind: 'buff', icon: '🌫️', desc: '不会被敌方单体技能选中（全体技能与范围伤害仍会波及）。', note: '只在敌方还有其他目标时生效。' },
  { id: 'scratch', name: '抓痕', kind: 'debuff', icon: '🩸', desc: '流血：每回合受到持续伤害（按施加者攻击力计）。', note: '蛮势力「图腾」的叠层来源。' },
  { id: 'burn', name: '灼烧', kind: 'debuff', icon: '🔥', desc: '火焰持续伤害，可叠层，叠层越高每次越痛。', note: '对「淋湿」目标额外伤害；吴势力「赤壁」核心。' },
  { id: 'wet', name: '淋湿', kind: 'debuff', icon: '💧', desc: '浑身湿透：防御降低，并更容易被火焰与符咒影响。' },
  { id: 'dizzy', name: '晕乎乎', kind: 'debuff', icon: '💫', desc: '眩晕：无法行动。', note: '被控制过的猫猫短暂免疫再次眩晕。' },
  { id: 'yarn', name: '毛线缠', kind: 'debuff', icon: '🧶', desc: '被毛线缠住：无法释放绝技，只能普攻。', note: '「封印」的猫式叫法。' },
  { id: 'fright', name: '受惊', kind: 'debuff', icon: '😿', desc: '攻击力降低（常见 -20%~25%）。' },
  { id: 'nip', name: '猫薄荷醉', kind: 'debuff', icon: '🌿', desc: '醉倒：会攻击自己的队友，并更容易受伤。' },
  { id: 'charm', name: '符咒', kind: 'debuff', icon: '📜', desc: '被贴符：受到的伤害提高，可叠 3 层。', note: '仙势力「天机」核心。' },
  { id: 'mark', name: '铃铛标记', kind: 'debuff', icon: '🔔', desc: '被标记：受到的伤害提高 10%，并更容易被暴击。' },
];

export const STATUS_BY_NAME: Record<string, StatusDef> = Object.fromEntries(STATUSES.map((s) => [s.name, s]));
