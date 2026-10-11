import ts from 'typescript';

export type ContentLintRule = 'sentence-length' | 'english' | 'violence' | 'terminology';
export interface ContentLintFinding {
  rule: ContentLintRule;
  message: string;
  text: string;
  /** One-based source coordinates, including when the literal contains escapes. */
  line: number;
  column: number;
}
export interface ContentLintOptions { maxSentenceLength?: number }
export interface ContentLintResult {
  findings: ContentLintFinding[];
  /** Every string literal or template text node, including technical and empty nodes. */
  scanned: number;
  /** Whole nodes exempted by a technical AST context and its accepted value format. */
  allowlisted: number;
}
export interface ContentLintCliOptions {
  maxSentenceLength: number;
  strict: boolean;
  help: boolean;
}

export const DEFAULT_MAX_SENTENCE_LENGTH = 50;

const PROSE_FIELDS = new Set([
  'name', 'title', 'theme', 'intro', 'bossNote', 'rule', 'text', 'desc', 'note',
  'lore', 'quote', 'likes', 'lookHint', 'breed', 'breeds', 'age', 'origin', 'motto',
  'full', 'land', 'mechanic', 'mechanicDesc', 'vibe', 'flavor', 'flavour',
  'flavors', 'flavours', 'pieceFlavors', 'pieces', 'names', 'label', 'message',
]);
const FACTIONS = ['wei', 'shu', 'wu', 'qun', 'man', 'xian'];
const ROLES = ['守护', '先锋', '神射', '谋士', '医者', '刺客'];
const PICKS = [
  'front', 'back', 'random', 'all', 'lowestHp', 'lowestHpPct', 'highestAtk',
  'lowestEnergy', 'highestEnergy', 'self', 'frontRow', 'backRow', 'column',
  'attacker', 'source', 'highestSpd', 'lowestSpd',
];
const SKILLS = ['basic', 'ultimate', 'passive', 'awaken'];
const QUALITIES = ['common', 'fine', 'rare', 'epic', 'legend'];
const SLOTS = ['weapon', 'armor', 'head', 'charm'];
const STATS = ['hp', 'atk', 'def', 'spd', 'maxHp', 'crit', 'critDmg', 'hit', 'dodge', 'healBonus', 'dmgReduce'];
const GOALS = [
  'login', 'claim_idle', 'clear_stage', 'level_up_hero', 'upgrade_skill',
  'recruit', 'arena_battle', 'guild_help', 'spend_fish', 'tower_clear',
  'equip_upgrade', 'visit_friend', 'hero_level', 'reach_stage', 'arena_win', 'collect_hero',
];
const KINDS = [
  ...SKILLS, 'daily', 'weekly', 'achievement', 'newbie', 'normal', 'elite', 'boss',
  'faction', 'up', 'currency', 'material', 'chest', 'shard', 'ticket', 'consumable', 'buff', 'debuff',
];
const ENUM_FIELDS: Readonly<Record<string, readonly string[]>> = {
  faction: FACTIONS, primary: FACTIONS, secondary: FACTIONS, focusFactions: FACTIONS,
  counters: FACTIONS, rarity: ['SR', 'SSR', 'UR', 'SP'], quality: QUALITIES, slot: SLOTS,
  kind: KINDS, skill: SKILLS, role: ROLES,
  mood: ['normal', 'happy', 'angry', 'sad', 'surprised', 'sly'],
  elem: ['phys', 'magic', 'fire', 'water', 'thunder', 'true'],
  side: ['enemy', 'ally', 'self', 'A', 'B', 'both'], pick: PICKS,
  who: ['self', 'target', 'actor', 'lowestAlly', 'foes', 'allies', 'randomFoeFront', 'narrator', 'player'],
  per: ['battle', 'round', 'actor', 'side'], type: GOALS,
  shop: ['general', 'arena', 'guild', 'tower', 'faction'], beast: ['tiger'],
  profile: ['front', 'back', 'camp', 'peach', 'ferry'],
  suffix: ['guard', 'vanguard', 'archer', 'strategist', 'healer', 'assassin'],
  c: [
    'hpBelow', 'hpAbove', 'status', 'allyFaction', 'heroAlive', 'chance', 'crit',
    'targetFaction', 'targetRole', 'round', 'counter', 'killed', 'allyCount',
    'teamCounter', 'not', 'and', 'or',
  ],
  on: [
    'battleStart', 'roundStart', 'roundEnd', 'beforeAct', 'afterAct', 'onBasic',
    'onUlt', 'onHit', 'onCrit', 'onHurt', 'onKill', 'onDeath', 'onAllyDeath',
    'onEnemyUlt', 'onHealed', 'onAllyAct', 'lowHp',
  ],
  ev: ['basic', 'basicHit', 'heal', 'cleanse', 'shieldExpire', 'shieldBreak', 'crit', 'hurt', 'statusApply'],
  k: ['energy', 'status', 'cleanse', 'removeStack', 'shield', 'heal', 'extend', 'totem'],
  t: [
    'damage', 'heal', 'shield', 'status', 'energy', 'cleanse', 'revive', 'extraTurn',
    'counter', 'selfDamage', 'summon', 'detonate', 'when', 'repeat', 'text',
    'startStatus', 'roundStatus', 'startShield', 'startEnergy', 'dmgMul', 'takenMul',
    'healMul', 'firstHealMul', 'firstHealTakenMul', 'firstBasicEnergy',
    'roundEnergyLowest', 'on', 'telegraph', 'critAdd', 'hitAdd', 'dodgeAdd',
  ],
};
const LOOK_ENUMS: Readonly<Record<string, readonly string[]>> = {
  pattern: ['solid', 'tabby', 'calico', 'tuxedo', 'point', 'shaded', 'spots', 'cow', 'tortie', 'butterfly'],
  style: ['sharp', 'fierce', 'round', 'cool', 'calm', 'keen', 'wink', 'wide', 'sleepy', 'happy'],
  ear: ['pointy', 'round', 'big', 'tuft', 'fold'],
  tail: ['bushy', 'long', 'ring', 'curl', 'stub'],
  head: [
    'none', 'emperorCrown', 'helmetWei', 'tigerHood', 'scholarCap', 'helmetGeneral',
    'taoistCrown', 'flowerPin', 'pheasant', 'boneCrown', 'featherHeaddress',
    'rattanHelm', 'lotusCrown', 'yellowBand', 'fortuneHat', 'sailorBandana',
    'hood', 'leafHat', 'ratCap',
  ],
  body: ['none', 'robeSilk', 'armorHeavy', 'armorLight', 'robeScholar', 'robeTaoist', 'dress', 'tribal', 'rattan', 'armorWei', 'vest'],
  back: ['none', 'capeLong', 'cape', 'banner', 'gourd', 'ribbons', 'furCloak', 'scrollBack', 'wings'],
  weapon: [
    'none', 'sword', 'spear', 'mace', 'scroll', 'dualSwords', 'glaive', 'fan', 'qin',
    'bow', 'whip', 'halberd', 'herbs', 'knives', 'drum', 'staff', 'talisman',
    'brush', 'coins', 'boxShield', 'crossbow', 'dagger', 'shield', 'slingshot', 'coinsPlain',
    'axe', 'hooks', 'whisk', 'dualBlades',
  ],
  extra: ['beardGoat', 'eyepatch', 'tassel', 'redFace', 'beardLong', 'warPaint', 'earring', 'scar', 'bell', 'monocle', 'glowEyes', 'scarf'],
};
const ID_FIELDS = new Set([
  'id', 'heroId', 'equipId', 'setId', 'unit', 'storyId', 'storyPostId', 'boss',
  'support', 'hero', 'heroes', 'upHeroes', 'item', 'bone', 'catnip',
  'hasStatus', 'noStatus', 'needStatus', 'status',
]);
const COLOR_FIELDS = new Set(['color', 'main', 'sub', 'trim', 'cloth', 'base', 'light', 'accent', 'stripe', 'pink']);
const TECHNICAL_VARIABLES: Readonly<Record<string, readonly string[] | 'id'>> = {
  FACTION_ORDER: FACTIONS, COUNTER_RING: FACTIONS, EQUIP_SLOTS: SLOTS,
  EQUIP_QUALITIES: QUALITIES, PENDING_CAMPAIGN_ITEMS: 'id', COIN_HEADS: 'id',
  tier: ['small', 'medium', 'large'], id: 'id', currency: 'id',
  role: ENUM_FIELDS.suffix, kind: KINDS, unitFaction: FACTIONS, profile: ENUM_FIELDS.profile,
};
const ENGLISH_WORDS = new Set(['sr', 'ssr', 'ur', 'sp', 'hp', 'atk', 'def', 'pvp', 'pve', 'dot', 'up', 'boss', 'lv']);
const BATTLE_WORDS = /击杀|斩杀|死亡|免死|濒死|血量|血条|血线|回血|满血|残血|低血|吸血|热血|心血/gu;
const PLACEHOLDERS = /\{(?:me|stage|hero|hero2|faction|who)\}/gu;
const TERMS: Readonly<Record<string, string>> = { 金币: '小鱼干', 钻石: '金铃铛', 怒气: '元气' };

type TextNode = ts.StringLiteralLike | ts.TemplateLiteralToken;

function isTextNode(node: ts.Node): node is TextNode {
  return ts.isStringLiteralLike(node) || node.kind === ts.SyntaxKind.TemplateHead
    || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail;
}
function propertyName(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return undefined;
}
function valueProperty(node: ts.Node): ts.PropertyAssignment | undefined {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isPropertyAssignment(parent) && parent.initializer === child) return parent;
    if (ts.isStatement(parent)) break;
  }
  return undefined;
}
function variableName(node: ts.Node): string | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isBindingElement(parent)) return ts.isIdentifier(parent.name) ? parent.name.text : undefined;
    if (ts.isVariableDeclaration(parent)) return ts.isIdentifier(parent.name) ? parent.name.text : undefined;
    if (ts.isStatement(parent)) break;
  }
  return undefined;
}
function hasPropertyAncestor(node: ts.Node, names: readonly string[]): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isPropertyAssignment(parent) && names.includes(propertyName(parent.name) ?? '')) return true;
    if (ts.isStatement(parent)) break;
  }
  return false;
}
function isFragment(node: TextNode): boolean {
  return node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail;
}
function isId(node: TextNode): boolean {
  return isFragment(node) ? /^[a-z0-9_-]*$/u.test(node.text) : /^(?:[a-z][a-z0-9_]*|\d+-\d+)$/u.test(node.text);
}
function isCounterKey(node: TextNode): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/u.test(node.text);
}
function enumValue(field: string, text: string): boolean {
  return Object.hasOwn(ENUM_FIELDS, field) && ENUM_FIELDS[field].includes(text);
}
function assignmentField(node: ts.Node): string | undefined {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === child) {
      return ts.isPropertyAccessExpression(parent.left) ? parent.left.name.text
        : ts.isIdentifier(parent.left) ? parent.left.text : undefined;
    }
    if (ts.isStatement(parent)) break;
  }
  return undefined;
}
function enumType(type: ts.TypeNode | undefined): readonly string[] | undefined {
  if (!type) return undefined;
  if (ts.isArrayTypeNode(type)) return enumType(type.elementType);
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const types: Readonly<Record<string, readonly string[]>> = {
      FactionId: FACTIONS, Role: ROLES, Rarity: ['SR', 'SSR', 'UR', 'SP'],
      Quality: QUALITIES, EquipSlot: SLOTS, SelPick: PICKS, SkillKind: SKILLS,
    };
    return Object.hasOwn(types, type.typeName.text) ? types[type.typeName.text] : undefined;
  }
  return undefined;
}
function typedEnumValue(node: TextNode): boolean {
  for (let child: ts.Node = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if ((ts.isAsExpression(parent) || ts.isSatisfiesExpression(parent) || ts.isVariableDeclaration(parent))
      && enumType(parent.type)?.includes(node.text)) return true;
    if (ts.isReturnStatement(parent) && parent.expression === child) {
      for (let owner = parent.parent; owner; owner = owner.parent) {
        if (ts.isFunctionDeclaration(owner) || ts.isArrowFunction(owner) || ts.isFunctionExpression(owner)) {
          return enumType(owner.type)?.includes(node.text) ?? false;
        }
      }
    }
    if (ts.isStatement(parent)) break;
  }
  return false;
}
function comparisonField(node: ts.Node): string | undefined {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isBinaryExpression(parent) && [
      ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].includes(parent.operatorToken.kind)) {
      const other = parent.left === child ? parent.right : parent.right === child ? parent.left : undefined;
      if (other && ts.isPropertyAccessExpression(other)) return other.name.text;
      if (other && ts.isIdentifier(other)) return other.text;
      return undefined;
    }
    if (!ts.isParenthesizedExpression(parent) && !ts.isAsExpression(parent) && !ts.isSatisfiesExpression(parent)) break;
  }
  return undefined;
}
function callContext(node: ts.Node): { call: ts.CallExpression; index: number } | undefined {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isCallExpression(parent)) {
      const index = parent.arguments.indexOf(child as ts.Expression);
      if (index >= 0) return { call: parent, index };
    }
    if (ts.isStatement(parent)) break;
  }
  return undefined;
}
function technicalContext(node: TextNode): boolean {
  const parent = node.parent;
  if (ts.isLiteralTypeNode(parent) || ts.isTemplateLiteralTypeNode(parent)
    || (ts.isTemplateLiteralTypeSpan(parent))) return true;
  if ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node) return true;
  if (ts.isExternalModuleReference(parent)) return true;
  // Quoted record keys and element access keys are code, not their displayed values.
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(node.text) || ROLES.includes(node.text);
  }
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(node.text) || ROLES.includes(node.text);
  }
  const compared = comparisonField(node);
  if (compared && (enumValue(compared, node.text) || (compared === 'role' && ENUM_FIELDS.suffix.includes(node.text)))) return true;
  if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.InKeyword && parent.left === node) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(node.text);
  }
  const context = callContext(node);
  if (context && context.index === 0 && context.call.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  const property = valueProperty(node);
  const field = (property ? propertyName(property.name) : undefined) ?? assignmentField(node);
  if ((field && PROSE_FIELDS.has(field)) || hasPropertyAncestor(node, ['pieceFlavors', 'flavors', 'flavours'])) return false;
  if (context && ts.isIdentifier(context.call.expression) && context.index === 0) {
    const callee = context.call.expression.text;
    if (callee === 'require') return /^(?:\.{1,2}\/|[A-Za-z@])[A-Za-z0-9_./@-]*$/u.test(node.text);
    if (callee === 'enemy' || callee === 'ally') return PICKS.includes(node.text);
    if (callee === 'status') return isId(node);
    if (callee === 'counter') return isCounterKey(node);
    if (callee === 'factionAllies' || callee === 'pal') return FACTIONS.includes(node.text);
    if (callee === 'S') return SKILLS.includes(node.text);
    if (callee === 'quest') return ['daily', 'weekly', 'achievement', 'newbie'].includes(node.text);
  }
  if (field && ID_FIELDS.has(field) && isId(node)) return true;
  if (field === 'who' && isId(node)) return true;
  if (field === 'fx' && (isFragment(node)
    ? /^[A-Za-z0-9_.]*$/u.test(node.text)
    : /^[a-z]+(?:\.[A-Za-z][A-Za-z0-9]*)+$/u.test(node.text))) return true;
  if ((field === 'key' || field === 'perCounter') && isCounterKey(node)) return true;
  if (field && enumValue(field, node.text)) return true;
  if (field === 'to' && (/^(?:all|front|back)$/u.test(node.text)
    || /^faction:(?:wei|shu|wu|qun|man|xian)$/u.test(node.text)
    || /^role:(?:守护|先锋|神射|谋士|医者|刺客)$/u.test(node.text))) return true;
  if (field && COLOR_FIELDS.has(field) && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.test(node.text)) return true;
  const variable = variableName(node);
  const inLook = hasPropertyAncestor(node, ['look', 'outfit', 'coat', 'eye']) || variable === 'MOB_LOOKS' || variable === 'UNIFORM';
  if (field && inLook && Object.hasOwn(LOOK_ENUMS, field) && LOOK_ENUMS[field].includes(node.text)) return true;
  if (variable && Object.hasOwn(TECHNICAL_VARIABLES, variable)) {
    const allowed = TECHNICAL_VARIABLES[variable];
    if (allowed === 'id' ? isId(node) : allowed.includes(node.text)) return true;
  }
  // Only the first element of the declared shop Offer tuple is an item id.
  const expression = isFragment(node) && ts.isTemplateExpression(parent) ? parent
    : isFragment(node) && ts.isTemplateSpan(parent) ? parent.parent : node;
  if (variable === 'SHOP_OFFERS' && ts.isArrayLiteralExpression(expression.parent)
    && expression.parent.elements[0] === expression && isId(node)) return true;
  if (variable === 'SHOP_CURRENCY' && isId(node)) return true;
  if (typedEnumValue(node)) return true;
  // Stat/rarity lists used in set-membership or filtering stay finite, not arbitrary ASCII.
  if (ts.isArrayLiteralExpression(parent) && parent.elements.every((element) =>
    ts.isStringLiteralLike(element) && (STATS.includes(element.text) || ['SR', 'SSR', 'UR', 'SP'].includes(element.text)))) return true;
  if (context && context.index === 0 && ts.isPropertyAccessExpression(context.call.expression)
    && context.call.expression.name.text === 'startsWith'
    && ts.isIdentifier(context.call.expression.expression)
    && context.call.expression.expression.text === 'id' && isId(node)) return true;
  return false;
}

/** Decode literal text while retaining the source offset of every UTF-16 code unit. */
function literalText(node: TextNode, source: ts.SourceFile): { text: string; positions: number[] } {
  const start = node.getStart(source) + 1;
  const ending = node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle ? 2 : 1;
  const raw = source.text.slice(start, node.end - ending);
  const positions: number[] = [];
  let cooked = '';
  const append = (text: string, position: number): void => {
    cooked += text;
    for (let i = 0; i < text.length; i++) positions.push(position);
  };
  const escapes: Readonly<Record<string, string>> = {
    n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0',
  };
  for (let i = 0; i < raw.length; i++) {
    const position = start + i;
    const char = raw[i];
    if (char === '\r') {
      if (raw[i + 1] === '\n') i++;
      append('\n', position);
    } else if (char !== '\\') {
      append(char, position);
    } else {
      const next = raw[++i];
      if (next === '\r' || next === '\n') {
        if (next === '\r' && raw[i + 1] === '\n') i++;
      } else if (next === 'x' && /^[\da-f]{2}$/iu.test(raw.slice(i + 1, i + 3))) {
        append(String.fromCharCode(parseInt(raw.slice(i + 1, i + 3), 16)), position);
        i += 2;
      } else if (next === 'u') {
        const unicode = raw.slice(i + 1).match(/^(?:\{([\da-f]{1,6})\}|([\da-f]{4}))/iu);
        const codePoint = unicode ? parseInt(unicode[1] ?? unicode[2], 16) : -1;
        if (unicode && codePoint <= 0x10ffff) {
          append(String.fromCodePoint(codePoint), position);
          i += unicode[0].length;
        } else append('u', position);
      } else append(escapes[next] ?? next ?? '', position);
    }
  }
  return { text: cooked, positions };
}
function masks(text: string, expression: RegExp): boolean[] {
  const masked = Array<boolean>(text.length).fill(false);
  for (const match of text.matchAll(expression)) {
    for (let i = match.index; i < match.index + match[0].length; i++) masked[i] = true;
  }
  return masked;
}
function sentenceRanges(text: string): { text: string; start: number }[] {
  const ranges: { text: string; start: number }[] = [];
  let begin = 0;
  const add = (end: number): void => {
    const raw = text.slice(begin, end);
    const trimmed = raw.trim();
    if (trimmed) ranges.push({ text: trimmed, start: begin + raw.indexOf(trimmed) });
  };
  for (let i = 0; i < text.length; i++) {
    const decimal = text[i] === '.' && /\d/u.test(text[i - 1] ?? '') && /\d/u.test(text[i + 1] ?? '');
    if (!decimal && /[。！？!?.\r\n]/u.test(text[i])) { add(i); begin = i + 1; }
  }
  add(text.length);
  return ranges;
}
function maxLength(value: number | undefined): number {
  const resolved = value === undefined ? DEFAULT_MAX_SENTENCE_LENGTH : value;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) throw new RangeError('单句阈值须为正安全整数。');
  return resolved;
}

/** Pure AST scan. It does not read files, evaluate content modules, or rewrite text. */
export function lintSource(sourceText: string, filePath: string, options: ContentLintOptions = {}): ContentLintResult {
  const threshold = maxLength(options.maxSentenceLength);
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const result: ContentLintResult = { findings: [], scanned: 0, allowlisted: 0 };
  const visit = (node: ts.Node): void => {
    if (isTextNode(node)) {
      result.scanned++;
      if (technicalContext(node)) result.allowlisted++;
      else {
        const literal = literalText(node, source);
        const report = (rule: ContentLintRule, text: string, index: number, message: string): void => {
          const position = literal.positions[index] ?? node.getStart(source) + 1;
          const location = source.getLineAndCharacterOfPosition(position);
          result.findings.push({ rule, text, message, line: location.line + 1, column: location.character + 1 });
        };
        for (const sentence of sentenceRanges(literal.text)) {
          const length = [...sentence.text].length;
          if (length > threshold) report('sentence-length', sentence.text, sentence.start,
            '单句' + length + '字，超过' + threshold + '字；建议拆为短句。');
        }
        const placeholders = masks(literal.text, PLACEHOLDERS);
        for (const match of literal.text.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*\d*/gu)) {
          if (placeholders[match.index]) continue;
          const word = match[0].toLowerCase();
          if (ENGLISH_WORDS.has(word) || /^lv\d+$/u.test(word)) continue;
          report('english', match[0], match.index, '英文词“' + match[0] + '”不在显示白名单；建议换成中文或核实技术上下文。');
        }
        const battle = masks(literal.text, BATTLE_WORDS);
        for (const match of literal.text.matchAll(/[血杀死]/gu)) {
          if (battle[match.index]) continue;
          const suggestion = match[0] === '死' ? '睡着了、倒下' : match[0] === '杀' ? '击败、让对手睡着' : '生命、抓痕';
          report('violence', match[0], match.index, '“' + match[0] + '”可能含真实暴力描写；建议按场景改为' + suggestion + '，交人工复核。');
        }
        for (const match of literal.text.matchAll(/金币|钻石|怒气/gu)) {
          report('terminology', match[0], match.index, '术语“' + match[0] + '”建议统一为“' + TERMS[match[0]] + '”。');
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  result.findings.sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule));
  return result;
}

export function resolveOptions(args: readonly string[]): ContentLintCliOptions {
  const result: ContentLintCliOptions = { maxSentenceLength: DEFAULT_MAX_SENTENCE_LENGTH, strict: false, help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--strict') { result.strict = true; continue; }
    if (arg === '--help' || arg === '-h') { result.help = true; continue; }
    const match = arg.match(/^(--max-sentence-length|--max)(?:=(.*))?$/u);
    if (!match) throw new Error('未知参数：' + arg + '；使用 --help 查看用法。');
    const value = match[2] ?? args[++i];
    if (value === undefined || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
      throw new Error(match[1] + ' 须提供正安全整数。');
    }
    result.maxSentenceLength = Number(value);
  }
  return result;
}
export function lintExitCode(findings: readonly ContentLintFinding[], strict: boolean): 0 | 1 {
  return strict && findings.length > 0 ? 1 : 0;
}
