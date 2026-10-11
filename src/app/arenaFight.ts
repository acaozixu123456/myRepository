// 探索遭遇战：在一个全屏浮层里打一场（可多波）战斗，用现有的战斗引擎与回放器，打完返回胜负。
import { simulate } from '../engine/battle';
import type { BEvent } from '../engine/types';
import type { StageDef } from '../content/types';
import { CHAPTER_THEME } from '../fx/bg';
import { Player } from '../fx/player';
import { lineupSetups, waveSetups } from '../game/stage';
import type { PlayerState } from '../game/state';

/** 战斗背景上方的细雨层（只在用街景快照做背景时开）：一块覆盖 canvas 的 2D 画布，雨丝斜着落下 */
function startRain(ov: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const c = document.createElement('canvas');
  c.className = 'arena-rain';
  ov.appendChild(c);
  const g = c.getContext('2d')!;
  const drops = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: 0.9 + Math.random() * 0.8, l: 10 + Math.random() * 16 }));
  let raf = 0, last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const r = canvas.getBoundingClientRect(), o = ov.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.style.cssText = `position:absolute;left:${r.left - o.left}px;top:${r.top - o.top}px;width:${w}px;height:${h}px;pointer-events:none`;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(170,200,255,.38)'; g.lineWidth = 1.2; g.beginPath();
    for (const d of drops) {
      d.y += dt * d.v * 1.6; d.x -= dt * d.v * 0.22;
      if (d.y > 1.05) { d.y = -0.05; d.x = Math.random() * 1.2; }
      const x = d.x * w, y = d.y * h;
      g.moveTo(x, y); g.lineTo(x - d.l * 0.14, y + d.l);
    }
    g.stroke();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

export interface FightResult { win: boolean; damagePct: number }

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** banner：开场横幅（如「首领战！」）；传入后会先做一个圆形转场 */
export async function arenaFight(host: HTMLElement, s: PlayerState, stage: StageDef, chapter: number, speed = 2, banner = '', backdrop: HTMLCanvasElement | null = null): Promise<FightResult> {
  const ov = document.createElement('div');
  ov.className = 'arena-ov';
  ov.innerHTML = `<canvas></canvas><button class="skip" data-skip>快进 »</button>${banner ? `<div class="arena-banner">${banner}</div>` : ''}`;
  ov.classList.add('wipe-in');
  host.appendChild(ov);
  const canvas = ov.querySelector('canvas') as HTMLCanvasElement;
  if (banner) await wait(650);
  ov.classList.remove('wipe-in'); ov.querySelector('.arena-banner')?.remove();
  const stopRain = backdrop ? startRain(ov, canvas) : () => undefined;
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
    if (backdrop) { player.scene.bg = backdrop; player.scene.bgDrift = true; }
    const evs = sim.events.slice(1).filter((e) => !(e.t === 'end' && w < stage.waves.length - 1));
    await player.play(evs);
    if (sim.winner !== 'A') { win = false; break; }
    carry = {};
    for (const u of sim.units) if (u.side === 'A') carry[u.heroId] = { hpPct: u.alive ? u.hp / u.maxHp : 0, energy: u.energy };
  }
  await player.sleep(win ? 1.0 : 1.5);
  player.scene.stop();
  stopRain();
  ov.classList.add('wipe-out');
  await wait(380);
  ov.remove();
  return { win, damagePct };
}
