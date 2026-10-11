// 主界面里的“挂机战斗”循环：反复打当前关卡，结算奖励；可主动挑战下一关。
import type { StageDef } from '../content/types';
import { simulate } from '../engine/battle';
import type { BEvent } from '../engine/types';
import type { BgTheme } from '../fx/bg';
import { Player } from '../fx/player';
import { applyGain, firstClearReward, getStage, lineupSetups, nextStage, waveSetups, winReward } from '../game/stage';
import type { Gain } from '../game/stage';
import type { PlayerState } from '../game/state';

const THEME: Record<number, BgTheme> = { 1: 'meadow', 2: 'meadow', 3: 'redcliff', 4: 'forest', 5: 'mist', 6: 'redcliff' };

export interface LoopHooks {
  state: () => PlayerState;
  onReward: (g: Gain, kind: 'win' | 'first') => void;
  onResult: (win: boolean, stage: StageDef, pushed: boolean) => void;
  onChange: () => void; // 状态变化（需要保存 / 刷新界面）
  /** 播放剧情（挑战首次到达的关卡前 / Boss 通关后），返回时继续 */
  story?: (id: string | undefined) => Promise<void>;
}

export class BattleLoop {
  player: Player;
  private token = 0;
  private paused = true;
  private pushNext = false;
  running = false;
  lastOutcome: 'win' | 'lose' | null = null;

  constructor(canvas: HTMLCanvasElement, private hooks: LoopHooks) {
    this.player = new Player(canvas);
    this.player.scene.baseCam = { x: 480, y: 366, zoom: 1.28 };
    this.player.scene.resetCam(0.01);
  }

  setSpeed(n: number) {
    this.player.setSpeed(this.paused ? 0 : n);
    this.speed = n;
  }
  private speed = 2;

  start() {
    this.paused = false;
    this.player.setSpeed(this.speed);
    this.player.scene.start();
    if (!this.running) void this.cycle(++this.token);
  }
  pause() {
    this.paused = true;
    this.player.setSpeed(0);
    this.player.scene.stop();
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.player.setSpeed(this.speed);
    this.player.scene.start();
  }
  /** 立即挑战下一关（打断当前这场） */
  challenge() {
    this.pushNext = true;
    this.running = false;
    void this.cycle(++this.token);
  }
  /** 阵容变化后，重新开一场 */
  restart() {
    this.running = false;
    void this.cycle(++this.token);
  }

  private async cycle(token: number) {
    this.running = true;
    while (token === this.token) {
      const s = this.hooks.state();
      const push = this.pushNext;
      this.pushNext = false;
      const best = (s.best ??= { chapter: s.stage.chapter, index: s.stage.index });
      let target = { chapter: s.stage.chapter, index: s.stage.index };
      if (push) {
        const n = nextStage(best.chapter, best.index);
        if (n) target = n;
      }
      const stage = getStage(target.chapter, target.index);
      if (!stage) break;
      if (push) {
        await this.hooks.story?.(stage.storyId);
        if (token !== this.token) return;
      }
      const win = await this.fight(stage, token, target.chapter);
      if (token !== this.token) return;
      this.lastOutcome = win ? 'win' : 'lose';
      if (win) {
        const g = winReward(stage);
        applyGain(s, g);
        this.hooks.onReward(g, 'win');
        if (push) {
          s.stage.chapter = target.chapter;
          s.stage.index = target.index;
          s.stage.wins = 0;
          s.best = { chapter: target.chapter, index: target.index };
          const fg = firstClearReward(stage);
          applyGain(s, fg);
          this.hooks.onReward(fg, 'first');
          await this.hooks.story?.(stage.storyPostId);
          if (token !== this.token) return;
        } else s.stage.wins++;
      }
      this.hooks.onResult(win, stage, push);
      this.hooks.onChange();
      await this.player.sleep(win ? 1.4 : 2.2);
      if (!win && push) await this.player.sleep(0.4);
    }
  }

  private async fight(stage: StageDef, token: number, chapter: number): Promise<boolean> {
    const s = this.hooks.state();
    let carry: Record<string, { hpPct: number; energy: number }> | undefined;
    for (let w = 0; w < stage.waves.length; w++) {
      const sim = simulate({ seed: (Math.random() * 1e9) | 0, A: lineupSetups(s, carry), B: waveSetups(stage, w) });
      const start = sim.events[0] as Extract<BEvent, { t: 'start' }>;
      await this.player.setup(start, THEME[chapter] ?? 'meadow');
      if (token !== this.token) return false;
      this.player.setSpeed(this.paused ? 0 : this.speed);
      // 最后一波之外不显示“胜利”横幅
      const evs = sim.events.slice(1).filter((e) => !(e.t === 'end' && w < stage.waves.length - 1));
      await this.player.play(evs);
      if (token !== this.token) return false;
      if (sim.winner !== 'A') return false;
      carry = {};
      for (const u of sim.units) if (u.side === 'A') carry[u.heroId] = { hpPct: u.alive ? u.hp / u.maxHp : 0, energy: u.energy };
    }
    return true;
  }
}
