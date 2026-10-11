// 探索遭遇战：在一个全屏浮层里打一场（可多波）战斗，用现有的战斗引擎与回放器，打完返回胜负。
import { simulate } from '../engine/battle';
import type { BEvent } from '../engine/types';
import type { StageDef } from '../content/types';
import { CHAPTER_THEME } from '../fx/bg';
import { Player } from '../fx/player';
import { lineupSetups, waveSetups } from '../game/stage';
import type { PlayerState } from '../game/state';

export interface FightResult { win: boolean; damagePct: number }

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** banner：开场横幅（如「首领战！」）；传入后会先做一个圆形转场 */
export async function arenaFight(host: HTMLElement, s: PlayerState, stage: StageDef, chapter: number, speed = 2, banner = ''): Promise<FightResult> {
  const ov = document.createElement('div');
  ov.className = 'arena-ov';
  ov.innerHTML = `<canvas></canvas><button class="skip" data-skip>快进 »</button>${banner ? `<div class="arena-banner">${banner}</div>` : ''}`;
  ov.classList.add('wipe-in');
  host.appendChild(ov);
  const canvas = ov.querySelector('canvas') as HTMLCanvasElement;
  if (banner) await wait(650);
  ov.classList.remove('wipe-in'); ov.querySelector('.arena-banner')?.remove();
  const player = new Player(canvas);
  player.scene.baseCam = { x: 480, y: 366, zoom: 1.28 };
  player.scene.resetCam(0.01);
  player.setSpeed(speed);
  player.scene.start();
  (ov.querySelector('[data-skip]') as HTMLElement).onclick = () => { player.skipping = true; player.setSpeed(8); };
  let carry: Record<string, { hpPct: number; energy: number }> | undefined;
  let win = true, damagePct = 0;
  for (let w = 0; w < stage.waves.length; w++) {
    const sim = simulate({ seed: (Math.random() * 1e9) | 0, A: lineupSetups(s, carry), B: waveSetups(stage, w), rules: stage.ruleFx });
    const foes = sim.units.filter((u) => u.side === 'B');
    damagePct = foes.reduce((a, u) => a + (u.maxHp - Math.max(0, u.hp)), 0) / Math.max(1, foes.reduce((a, u) => a + u.maxHp, 0));
    const start = sim.events[0] as Extract<BEvent, { t: 'start' }>;
    await player.setup(start, CHAPTER_THEME[chapter] ?? 'street');
    const evs = sim.events.slice(1).filter((e) => !(e.t === 'end' && w < stage.waves.length - 1));
    await player.play(evs);
    if (sim.winner !== 'A') { win = false; break; }
    carry = {};
    for (const u of sim.units) if (u.side === 'A') carry[u.heroId] = { hpPct: u.alive ? u.hp / u.maxHp : 0, energy: u.energy };
  }
  await player.sleep(win ? 1.0 : 1.5);
  player.scene.stop();
  ov.classList.add('wipe-out');
  await wait(380);
  ov.remove();
  return { win, damagePct };
}
