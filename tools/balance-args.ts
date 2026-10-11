import type { BalanceOptions } from '../src/game/balance';

/** 纯参数解析；运行与文件输出仍由 balance.ts 负责。 */
export function parseBalanceArgs(args: string[]): { options: BalanceOptions; output: string } {
  const options: BalanceOptions = {};
  let output = 'docs/BALANCE_REPORT.md';
  const numeric = new Map<string, 'games' | 'level' | 'star' | 'seed'>([
    ['--games', 'games'], ['--level', 'level'], ['--star', 'star'], ['--seed', 'seed'],
  ]);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--no-random-awakening') { options.randomAwakening = false; continue; }
    if (flag === '--no-bonds') { options.noBonds = true; continue; }
    const key = numeric.get(flag);
    if (!key && flag !== '--random-awakening' && flag !== '--out') throw new Error(`未知参数：${flag}，使用 --help 查看用法`);
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} 缺少参数值`);
    if (key) {
      if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${flag} 须为安全整数`);
      options[key] = Number(value);
    } else if (flag === '--random-awakening') {
      if (value !== 'true' && value !== 'false') throw new Error('--random-awakening 须为 true 或 false');
      options.randomAwakening = value === 'true';
    } else {
      if (!value.trim()) throw new Error('--out 不能为空');
      output = value;
    }
  }
  return { options, output };
}
