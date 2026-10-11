// 手绘风 SVG 图标（统一 64×64 视窗）：渐变填充 + 同色相深色细描边。不使用 emoji、不使用位图。
// 用法：icon('fish', 28) -> 返回 <svg> 字符串。
let uid = 0;
const grad = (a: string, b: string) => {
  const id = `ig${++uid}`;
  return { id, def: `<linearGradient id="${id}" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`, ref: `url(#${id})` };
};

type Maker = () => string;
const S = (body: string, defs = '') => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;

const ICONS: Record<string, Maker> = {
  // ---- 货币 ----
  fish: () => {
    const g = grad('#ffe6a0', '#e8a23a');
    return S(`<path d="M8 32 C16 18 34 16 46 28 L58 18 L56 32 L58 46 L46 36 C34 48 16 46 8 32 Z" fill="${g.ref}" stroke="#8a5a1a" stroke-width="3" stroke-linejoin="round"/><path d="M18 24 Q24 32 18 40 M26 22 Q32 32 26 42" fill="none" stroke="#b9791f" stroke-width="2.4" stroke-linecap="round"/><circle cx="17" cy="29" r="3.2" fill="#3a2410"/><circle cx="16" cy="28" r="1.1" fill="#fff"/>`, g.def);
  },
  bell: () => {
    const g = grad('#fff0a8', '#e5a82e');
    return S(`<path d="M32 8 C22 8 16 17 16 28 C16 38 12 42 10 46 L54 46 C52 42 48 38 48 28 C48 17 42 8 32 8 Z" fill="${g.ref}" stroke="#8a6414" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="52" r="6" fill="#d9483b" stroke="#7a2a20" stroke-width="2.6"/><path d="M24 16 Q20 22 20 30" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/><rect x="29" y="4" width="6" height="6" rx="3" fill="#b9801a" stroke="#8a6414" stroke-width="2"/>`, g.def);
  },
  catnip: () => {
    const g = grad('#bff0a0', '#4fa84a');
    return S(`<path d="M32 58 C32 40 30 28 32 10" stroke="#3f8a3a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M32 40 C20 40 10 32 8 22 C20 22 30 28 32 40 Z" fill="${g.ref}" stroke="#2f6a2c" stroke-width="2.6" stroke-linejoin="round"/><path d="M32 30 C44 30 54 22 56 12 C44 12 34 18 32 30 Z" fill="${g.ref}" stroke="#2f6a2c" stroke-width="2.6" stroke-linejoin="round"/><path d="M32 18 C26 16 22 10 22 4 C28 6 32 10 32 18 Z" fill="${g.ref}" stroke="#2f6a2c" stroke-width="2.6" stroke-linejoin="round"/>`, g.def);
  },
  yarn: () => {
    const g = grad('#ffb0c8', '#e0567e');
    return S(`<circle cx="30" cy="32" r="22" fill="${g.ref}" stroke="#8a2a4a" stroke-width="3"/><path d="M12 26 Q30 36 48 22 M10 34 Q30 46 50 32 M16 46 Q30 40 42 50 M20 16 Q34 24 46 16" fill="none" stroke="#b83a64" stroke-width="2.4" stroke-linecap="round"/><path d="M48 44 Q58 50 54 58 Q46 60 40 54" fill="none" stroke="#e0567e" stroke-width="3.4" stroke-linecap="round"/>`, g.def);
  },
  ticket: () => {
    const g = grad('#ffe6a0', '#e0a23a');
    return S(`<path d="M6 18 L58 18 L58 28 A5 5 0 0 0 58 38 L58 48 L6 48 L6 38 A5 5 0 0 0 6 28 Z" fill="${g.ref}" stroke="#8a5a1a" stroke-width="3" stroke-linejoin="round"/><path d="M42 20 L42 46" stroke="#b9791f" stroke-width="2.4" stroke-dasharray="3 3"/><circle cx="24" cy="33" r="8" fill="#d9483b" stroke="#7a2a20" stroke-width="2.4"/><ellipse cx="24" cy="36" rx="4" ry="3" fill="#fff"/><circle cx="19" cy="31" r="1.8" fill="#fff"/><circle cx="24" cy="29" r="1.8" fill="#fff"/><circle cx="29" cy="31" r="1.8" fill="#fff"/>`, g.def);
  },
  paw: () => {
    const g = grad('#ffd0a8', '#e0803a');
    return S(`<ellipse cx="32" cy="42" rx="16" ry="13" fill="${g.ref}" stroke="#8a4a1a" stroke-width="3"/><ellipse cx="12" cy="28" rx="6" ry="8" fill="${g.ref}" stroke="#8a4a1a" stroke-width="3"/><ellipse cx="52" cy="28" rx="6" ry="8" fill="${g.ref}" stroke="#8a4a1a" stroke-width="3"/><ellipse cx="23" cy="14" rx="6" ry="8" fill="${g.ref}" stroke="#8a4a1a" stroke-width="3"/><ellipse cx="41" cy="14" rx="6" ry="8" fill="${g.ref}" stroke="#8a4a1a" stroke-width="3"/>`, g.def);
  },
  star: () => {
    const g = grad('#fff0a0', '#f0b030');
    return S(`<path d="M32 5 L40 24 L60 26 L45 40 L50 59 L32 49 L14 59 L19 40 L4 26 L24 24 Z" fill="${g.ref}" stroke="#a06a10" stroke-width="3" stroke-linejoin="round"/><path d="M24 24 L32 12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`, g.def);
  },
  starOff: () => S(`<path d="M32 5 L40 24 L60 26 L45 40 L50 59 L32 49 L14 59 L19 40 L4 26 L24 24 Z" fill="#d9d2c0" stroke="#a89f88" stroke-width="3" stroke-linejoin="round"/>`),
  lock: () => {
    const g = grad('#cfc6b4', '#8f8670');
    return S(`<path d="M20 28 L20 20 A12 12 0 0 1 44 20 L44 28" fill="none" stroke="#6a6250" stroke-width="5" stroke-linecap="round"/><rect x="12" y="26" width="40" height="30" rx="7" fill="${g.ref}" stroke="#5a5240" stroke-width="3"/><circle cx="32" cy="41" r="4" fill="#4a4232"/>`, g.def);
  },
  plus: () => {
    const g = grad('#a8f0a0', '#3fb04a');
    return S(`<circle cx="32" cy="32" r="26" fill="${g.ref}" stroke="#1f7a2c" stroke-width="3"/><path d="M32 18 L32 46 M18 32 L46 32" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`, g.def);
  },
  // ---- 导航 ----
  home: () => {
    const g = grad('#ffd9a0', '#e08a4a');
    return S(`<path d="M6 32 L32 8 L58 32 L52 32 L52 56 L12 56 L12 32 Z" fill="${g.ref}" stroke="#8a4a1a" stroke-width="3" stroke-linejoin="round"/><path d="M6 32 L32 8 L58 32" fill="none" stroke="#c0452e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="26" y="38" width="12" height="18" rx="3" fill="#8a4a1a"/><circle cx="35" cy="48" r="1.6" fill="#ffd24a"/>`, g.def);
  },
  team: () => {
    const g = grad('#ffd9b0', '#e8964a');
    return S(`<path d="M10 24 L14 8 L26 18 L38 18 L50 8 L54 24 C58 30 58 40 52 48 C46 56 18 56 12 48 C6 40 6 30 10 24 Z" fill="${g.ref}" stroke="#8a4a1a" stroke-width="3" stroke-linejoin="round"/><path d="M14 14 L22 20 M50 14 L42 20" stroke="#f0a0b0" stroke-width="4" stroke-linecap="round"/><ellipse cx="24" cy="34" rx="4" ry="5" fill="#2b1d22"/><ellipse cx="40" cy="34" rx="4" ry="5" fill="#2b1d22"/><circle cx="22.6" cy="32.4" r="1.4" fill="#fff"/><circle cx="38.6" cy="32.4" r="1.4" fill="#fff"/><path d="M29 42 L35 42 L32 46 Z" fill="#d9707a"/><path d="M32 46 Q28 50 25 47 M32 46 Q36 50 39 47" fill="none" stroke="#2b1d22" stroke-width="2" stroke-linecap="round"/>`, g.def);
  },
  recruit: () => {
    const g = grad('#d9b080', '#9a6a3a');
    return S(`<path d="M8 26 L32 18 L56 26 L56 54 L8 54 Z" fill="${g.ref}" stroke="#5a3a1a" stroke-width="3" stroke-linejoin="round"/><path d="M8 26 L20 10 L32 18 L44 10 L56 26 L32 18 Z" fill="#c89a62" stroke="#5a3a1a" stroke-width="3" stroke-linejoin="round"/><path d="M26 36 L38 36 L38 44 L26 44 Z" fill="#e8c88a" stroke="#5a3a1a" stroke-width="2.4"/><path d="M30 12 L32 4 L36 12" fill="none" stroke="#ffd24a" stroke-width="3" stroke-linecap="round"/><path d="M20 6 L22 0 M46 4 L44 -2" stroke="#ffd24a" stroke-width="2.4" stroke-linecap="round"/>`, g.def);
  },
  campaign: () => {
    const g = grad('#fff2d0', '#e0b46a');
    return S(`<path d="M16 6 L16 60" stroke="#6a4a2a" stroke-width="5" stroke-linecap="round"/><path d="M18 8 C30 4 36 14 48 10 L48 32 C36 36 30 26 18 30 Z" fill="${g.ref}" stroke="#8a5a1a" stroke-width="3" stroke-linejoin="round"/><path d="M26 16 L40 16 M26 24 L36 24" stroke="#d9483b" stroke-width="3" stroke-linecap="round"/>`, g.def);
  },
  bag: () => {
    const g = grad('#e8c48a', '#b88040');
    return S(`<path d="M10 28 C10 22 14 20 20 20 L44 20 C50 20 54 22 54 28 L52 52 C52 57 48 60 44 60 L20 60 C16 60 12 57 12 52 Z" fill="${g.ref}" stroke="#6a4420" stroke-width="3" stroke-linejoin="round"/><path d="M20 20 C20 8 44 8 44 20" fill="none" stroke="#6a4420" stroke-width="4" stroke-linecap="round"/><path d="M16 32 Q32 38 48 32 M15 42 Q32 48 49 42" fill="none" stroke="#a06a30" stroke-width="2.4"/><circle cx="32" cy="34" r="4" fill="#ffd24a" stroke="#8a6414" stroke-width="2"/>`, g.def);
  },
  // ---- 职业 ----
  shield: () => {
    const g = grad('#a8c4f0', '#4a72c0');
    return S(`<path d="M32 6 L54 14 L52 34 C50 46 42 54 32 58 C22 54 14 46 12 34 L10 14 Z" fill="${g.ref}" stroke="#274a8a" stroke-width="3" stroke-linejoin="round"/><path d="M32 14 L32 50 M20 26 L44 26" stroke="#e8f0ff" stroke-width="3" opacity="0.7"/>`, g.def);
  },
  sword: () => {
    const g = grad('#f0f4f8', '#9aa8b8');
    return S(`<path d="M50 6 L58 6 L58 14 L28 44 L20 36 Z" fill="${g.ref}" stroke="#5a6878" stroke-width="3" stroke-linejoin="round"/><path d="M14 38 L26 50 M10 54 L20 44 L26 50 L16 60 Z" fill="#c9a24b" stroke="#6a4a14" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`, g.def);
  },
  bow: () => S(`<path d="M18 6 C50 14 50 50 18 58" fill="none" stroke="#8a5a2a" stroke-width="5" stroke-linecap="round"/><path d="M18 6 L18 58" stroke="#d8c9a0" stroke-width="2"/><path d="M12 32 L52 32 M46 26 L54 32 L46 38" fill="none" stroke="#6a4a2a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  staff: () => {
    const g = grad('#d9c4ff', '#8a5ad0');
    return S(`<path d="M14 58 L44 14" stroke="#8a5a2a" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="14" r="11" fill="${g.ref}" stroke="#4a2a8a" stroke-width="3"/><circle cx="43" cy="11" r="3" fill="#fff" opacity="0.8"/><path d="M52 6 L58 2 M54 20 L60 22" stroke="#ffd24a" stroke-width="2.6" stroke-linecap="round"/>`, g.def);
  },
  heart: () => {
    const g = grad('#ffb0c4', '#e0486e');
    return S(`<path d="M32 56 C8 40 6 22 16 14 C24 8 30 14 32 20 C34 14 40 8 48 14 C58 22 56 40 32 56 Z" fill="${g.ref}" stroke="#8a1f3e" stroke-width="3" stroke-linejoin="round"/><path d="M18 22 Q22 16 28 20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`, g.def);
  },
  dagger: () => {
    const g = grad('#f0f4f8', '#8a98a8');
    return S(`<path d="M40 6 L52 12 L26 40 L18 32 Z" fill="${g.ref}" stroke="#5a6878" stroke-width="3" stroke-linejoin="round"/><path d="M12 36 L28 52 M10 54 L18 46" stroke="#d9483b" stroke-width="6" stroke-linecap="round"/>`, g.def);
  },
  // ---- 杂项 ----
  gift: () => {
    const g = grad('#ffb0c4', '#e0486e');
    return S(`<rect x="8" y="26" width="48" height="32" rx="4" fill="${g.ref}" stroke="#8a1f3e" stroke-width="3"/><rect x="6" y="18" width="52" height="12" rx="4" fill="#ff8aa8" stroke="#8a1f3e" stroke-width="3"/><path d="M32 18 L32 58" stroke="#ffe08a" stroke-width="8"/><path d="M32 18 C20 4 10 12 20 18 Z M32 18 C44 4 54 12 44 18 Z" fill="#ffe08a" stroke="#8a6414" stroke-width="2.6" stroke-linejoin="round"/>`, g.def);
  },
  gear: () => {
    const g = grad('#d9d9e0', '#8a8a9a');
    return S(`<path d="M28 6 L36 6 L38 13 L44 15 L50 11 L55 17 L51 23 L53 29 L60 31 L60 39 L53 41 L51 47 L55 53 L50 58 L44 54 L38 56 L36 63 L28 63 L26 56 L20 54 L14 58 L9 53 L13 47 L11 41 L4 39 L4 31 L11 29 L13 23 L9 17 L14 11 L20 15 L26 13 Z" fill="${g.ref}" stroke="#5a5a6a" stroke-width="2.6" stroke-linejoin="round"/><circle cx="32" cy="35" r="10" fill="#f4efe0" stroke="#5a5a6a" stroke-width="3"/>`, g.def);
  },
  arrowUp: () => S(`<path d="M32 6 L54 32 L40 32 L40 58 L24 58 L24 32 L10 32 Z" fill="#7fd68a" stroke="#2a7a3a" stroke-width="3" stroke-linejoin="round"/>`),
  swap: () => S(`<path d="M8 22 L44 22 L44 12 L58 26 L44 40 L44 30 L8 30 Z" fill="#8fd0ff" stroke="#2563a8" stroke-width="3" stroke-linejoin="round"/><path d="M56 42 L20 42 L20 32 L6 46 L20 60 L20 50 L56 50 Z" fill="#ffb25c" stroke="#b95f12" stroke-width="3" stroke-linejoin="round" transform="translate(0 -4)"/>`),
  close: () => S(`<path d="M14 14 L50 50 M50 14 L14 50" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`),
  check: () => S(`<path d="M12 34 L26 48 L52 16" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`),
  spark: () => S(`<path d="M32 4 L38 26 L60 32 L38 38 L32 60 L26 38 L4 32 L26 26 Z" fill="#fff6c0" stroke="#e0a82e" stroke-width="3" stroke-linejoin="round"/>`),
};

export const ICON_NAMES = Object.keys(ICONS);
export function icon(name: string, size = 24, cls = ''): string {
  const mk = ICONS[name];
  if (!mk) return '';
  return `<span class="ic ${cls}" style="width:${size}px;height:${size}px">${mk()}</span>`;
}

export const ROLE_ICON: Record<string, string> = { 守护: 'shield', 先锋: 'sword', 神射: 'bow', 谋士: 'staff', 医者: 'heart', 刺客: 'dagger' };
