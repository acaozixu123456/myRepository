// 所有内容数据的入口。浏览器（Vite）和 Node（测试、模拟脚本）都从这里读。
import elements from './elements.json' with { type: 'json' };
import skills from './skills.json' with { type: 'json' };
import classes from './classes.json' with { type: 'json' };
import monsters from './monsters.json' with { type: 'json' };
import zones from './zones.json' with { type: 'json' };
import items from './items.json' with { type: 'json' };
import gear from './gear.json' with { type: 'json' };
import quests from './quests.json' with { type: 'json' };

export const ELEMENTS = elements.names, BEATS = elements.beats, EL_COLOR = elements.colors;
export const SKILLS = skills;
export const CLASSES = classes.list, ADVANCE_LV = classes.advanceLv, REROUTE_COST = classes.rerouteCost, ATTR_NAME = classes.attrs.names, ATTR_DESC = classes.attrs.desc;
export const MONSTERS = monsters;
export const ZONES = zones;
export const ITEMS = items;
export const GEAR = gear, GEAR_SLOTS = gear.slots, GEAR_SLOT_ICON = gear.slotIcon, GEAR_SETS = gear.sets, GEAR_AFFIX = gear.affix, GEAR_SPECIAL = gear.special;
export const QUESTS = quests;
import statuses from './statuses.json' with { type: 'json' };
import combos from './combos.json' with { type: 'json' };
export const STATUS = statuses;
export const COMBO = combos.list, COMBO_STYLE = combos.style;
