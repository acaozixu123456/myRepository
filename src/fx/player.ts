// 战斗回放器：把引擎产出的事件时间线，变成会动的战斗。
import { FACTIONS } from '../data/factions';
import { lookOf, unitInfo } from '../data/units';
import { STATUSES } from '../data/statuses';
import type { BEvent } from '../engine/types';
import { Actor, POSES } from './actor';
import type { ActorInfo } from './actor';
import { makeBackground } from './bg';
import type { BgTheme } from './bg';
import { Choreo } from './choreo';
import { playCutIn } from './cutin';
import { buildIllustRig, buildPortrait, buildRig, illustPortrait } from './rig';
import { ILLUST } from '../art/illust-index';
import type { Rig } from './rig';
import { Scene } from './scene';
import { SKILL_FX, defaultFx } from './skills';
import { lerp } from './util';

type StartEv = Extract<BEvent, { t: 'start' }>;
const ELEM_COLOR: Record<string, [string, string]> = {
  phys: ['#fff4e0', '#c0392b'], magic: ['#e6ccff', '#5a2a9a'], fire: ['#ffd08a', '#b0301a'], water: ['#bfeaff', '#1f5f9a'], thunder: ['#fff4a0', '#8a6a10'], true: ['#ffffff', '#555566'],
};

const RIG_CACHE = new Map<string, Promise<Rig>>();
/** 战斗里是否用 AI 立绘当小人（有立绘的猫才生效）；设置里可切换 */
export const spriteMode = { illust: true };
function cachedRig(id: string, scale: number): Promise<Rig> {
  const il = spriteMode.illust ? ILLUST[id] : undefined;
  const k = `${id}@${scale}${il ? '@illust' : ''}`;
  let p = RIG_CACHE.get(k);
  if (!p) {
    p = il ? buildIllustRig(lookOf(id), il.full, scale, id).catch(() => buildRig(lookOf(id), scale)) : buildRig(lookOf(id), scale);
    RIG_CACHE.set(k, p);
  }
  return p;
}

export class Player {
  scene: Scene;
  actors = new Map<number, Actor>();
  speed = 1;
  skipping = false;
  onLog: (s: string) => void = () => undefined;
  private lastPassive = new Map<number, number>();
  private bgCache = new Map<string, HTMLCanvasElement>();
  private portraits = new Map<string, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new Scene(canvas);
  }
  actor(uid: number) { return this.actors.get(uid); }
  team(side: 'A' | 'B') { return [...this.actors.values()].filter((a) => a.side === side && a.alive); }
  factionColor(a: Actor) { return FACTIONS[a.faction].color; }

  setSpeed(s: number) {
    this.speed = s;
    this.scene.timeScale = s;
  }

  static slot(side: 'A' | 'B', pos: number): [number, number, number] {
    // 斜线阵型：前排三只斜排，后排两只在后
    const A: [number, number][] = [[420, 440], [366, 496], [312, 552], [236, 462], [182, 526]];
    const [ax, y] = A[pos];
    const x = side === 'A' ? ax : 960 - ax;
    const s = lerp(0.285, 0.335, (y - 430) / 130);
    return [x, y, s];
  }

  async setup(start: StartEv, theme: BgTheme = 'meadow', progress?: (p: number) => void) {
    this.actors.clear();
    this.scene.clearAll();
    this.banner = null;
    this.lastPassive.clear();
    this.installOverlay();
    if (!this.bgCache.has(theme)) this.bgCache.set(theme, makeBackground(theme, 960, 600, this.scene.dpr));
    this.scene.bg = this.bgCache.get(theme)!;
    let done = 0;
    const rigs = await Promise.all(
      start.units.map(async (u) => {
        const rig = await cachedRig(u.heroId, 0.62 * this.scene.dpr);
        progress?.(++done / start.units.length);
        return [u, rig] as [StartEv['units'][number], Rig];
      }),
    );
    for (const [u, rig] of rigs) {
      const [x, y, s] = Player.slot(u.side, u.pos);
      const info: ActorInfo = { uid: u.uid, side: u.side, name: u.name, faction: u.faction, heroId: u.heroId, maxHp: u.maxHp, hp: u.hp };
      const a = new Actor(this.scene, rig, info, x, y, s);
      this.actors.set(u.uid, a);
      this.scene.actors.push(a);
    }
  }

  async portrait(heroId: string): Promise<HTMLCanvasElement> {
    let p = this.portraits.get(heroId);
    if (!p) {
      const il = spriteMode.illust ? ILLUST[heroId] : undefined;
      p = il ? await illustPortrait(il.card).catch(() => buildPortrait(lookOf(heroId), '20 50 360 340', 520)) : await buildPortrait(lookOf(heroId), '20 50 360 340', 520);
      this.portraits.set(heroId, p);
    }
    return p;
  }

  // ---------- 回放 ----------
  async play(events: BEvent[]) {
    let i = 0;
    while (i < events.length) {
      const e = events[i];
      if (e.t === 'act') {
        let j = i + 1;
        while (j < events.length && !['act', 'round', 'end'].includes(events[j].t)) j++;
        await this.doAct(e, events.slice(i + 1, j));
        i = j;
        continue;
      }
      this.applyEvent(e);
      if (e.t === 'round') await this.roundBanner(e.n);
      else if (e.t === 'end') await this.endBanner(e.winner);
      else if (e.t === 'dot' || e.t === 'skip') await this.sleep(0.45);
      else if (e.t === 'passive') await this.sleep(0.12);
      i++;
    }
  }
  sleep(s: number) { return this.skipping ? Promise.resolve() : this.scene.sleep(s); }

  private banner: { text: string; sub: string; a: number; y: number } | null = null;
  private async roundBanner(n: number) {
    const b = { text: `第 ${n} 回合`, sub: '', a: 0, y: 0 };
    this.banner = b;
    await this.scene.tween(b, { a: 1 }, 0.18, 'out');
    await this.sleep(0.35);
    await this.scene.tween(b, { a: 0 }, 0.2, 'in');
    this.banner = null;
  }
  private async endBanner(w: 'A' | 'B' | 'draw') {
    for (const a of this.actors.values()) if (a.alive && a.side === w) a.poseTo(POSES.victory, 0.3);
    const b = { text: w === 'A' ? '胜利' : w === 'B' ? '败北' : '平局', sub: '', a: 0, y: 0 };
    this.banner = b;
    await this.scene.tween(b, { a: 1 }, 0.4, 'out');
  }
  installOverlay() {
    this.scene.overlays.push((ctx, sc) => {
      const b = this.banner;
      if (!b || b.a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = b.a;
      const big = b.text.length <= 2;
      ctx.translate(sc.w / 2, big ? 200 : 90);
      ctx.scale(1 + (1 - b.a) * 0.3, 1 + (1 - b.a) * 0.3);
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.font = `900 ${big ? 120 : 40}px "ZCOOL KuaiLe","Noto Sans SC","WenQuanYi Zen Hei",sans-serif`;
      ctx.lineWidth = big ? 16 : 8;
      ctx.strokeStyle = 'rgba(40,20,50,.9)';
      ctx.strokeText(b.text, 0, 0);
      const g = ctx.createLinearGradient(0, big ? -100 : -34, 0, 0);
      g.addColorStop(0, '#fff7d6'); g.addColorStop(1, big ? '#ffb83a' : '#ffe08a');
      ctx.fillStyle = g;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
    });
  }

  private async doAct(e: Extract<BEvent, { t: 'act' }>, batch: BEvent[]) {
    const caster = this.actors.get(e.uid)!;
    const targets = e.targets.map((id) => this.actors.get(id)!).filter(Boolean);
    const c = new Choreo(this, caster, targets, batch, e);
    const ult = e.kind === 'ultimate';
    this.onLog(`${caster.name} ${e.skill}`);
    caster.hudAlpha = 1;
    if (ult) {
      caster.energy = 0;
      const hero = unitInfo(caster.heroId);
      const portrait = await this.portrait(caster.heroId);
      await playCutIn(this.scene, { portrait, faction: caster.faction, skill: e.skill, premium: hero.rarity === 'SP', title: hero.title, name: caster.name, side: caster.side, duration: this.skipping ? 0.01 : 1.25 });
    }
    const fx = SKILL_FX[e.fx] ?? defaultFx(e);
    try {
      await fx(c);
    } catch (err) {
      console.error('skill fx failed', e.fx, err);
    }
    c.rest();
    this.scene.resetCam(0.35);
    this.scene.tween(this.scene, { dim: 0 }, 0.3, 'out');
    this.scene.tween(this.scene.tint, { a: 0 }, 0.4, 'out');
    caster.moving = false;
    await caster.poseTo(POSES.idle, 0.2);
    await this.sleep(ult ? 0.5 : 0.22);
  }

  // ---------- 事件 → 表现 ----------
  applyEvent(e: BEvent) {
    const sc = this.scene;
    const vfx = sc.vfx;
    switch (e.t) {
      case 'damage': {
        const t = this.actors.get(e.dst);
        if (!t) return;
        const [x, y] = t.anchor('chest');
        t.hp = e.hp;
        t.shield = e.shield;
        const [col, stroke] = ELEM_COLOR[e.elem] ?? ELEM_COLOR.phys;
        if (e.amount > 0) {
          vfx.num(x, y - 24, String(e.amount - 0), { color: col, stroke, size: e.crit ? 32 : 24, crit: e.crit });
          if (e.src !== e.dst) {
            t.hurtReact(e.crit ? 1.4 : 1);
            sc.shake(e.crit ? 6 : 2.5, 0.12);
          }
        } else if (e.absorbed > 0) {
          vfx.num(x, y - 24, '盾', { color: '#bfe6ff', stroke: '#2a6a9a', size: 20 });
        }
        if (e.killed) setTimeout(() => undefined, 0), sc.sleep(0.15).then(() => this.kill(t));
        break;
      }
      case 'heal': {
        const t = this.actors.get(e.dst);
        if (!t) return;
        t.hp = e.hp;
        const [x, y] = t.anchor('chest');
        vfx.num(x, y - 24, `+${e.amount}`, { color: '#b8ffc4', stroke: '#1f7a3a', size: 22 });
        vfx.burst({ x, y: y + 20, n: 8, speed: [10, 50], angle: -Math.PI / 2, spread: 1, life: [0.6, 1.1], size: [3, 6], color: ['#9dffb0', '#fff'], shape: 'star', gravity: -40, drag: 0.98, radius: 30 });
        break;
      }
      case 'shield': {
        const t = this.actors.get(e.dst);
        if (!t) return;
        t.shield = e.total;
        const [x, y] = t.anchor('chest');
        vfx.ring(x, y, { r0: 14, r1: 62, life: 0.45, color: '#bfe6ff', width: 5 });
        break;
      }
      case 'status': {
        const t = this.actors.get(e.dst);
        if (!t) return;
        const def = STATUSES.find((s) => s.id === e.id);
        if (e.op === 'add') {
          t.statuses.set(e.id, e.stacks);
          const [x, y] = t.anchor('top');
          vfx.num(x, y - 26, def?.name ?? e.id, { color: def?.kind === 'buff' ? '#c8ffd0' : '#ffc8c8', stroke: def?.kind === 'buff' ? '#2a7a4a' : '#8a2a3a', size: 17, life: 0.9 });
        } else t.statuses.delete(e.id);
        break;
      }
      case 'dot': {
        const t = this.actors.get(e.dst);
        if (!t) return;
        t.hp = e.hp;
        t.flash = 0.6;
        const [x, y] = t.anchor('chest');
        const col = e.id === 'burn' ? '#ffb070' : '#ff9a9a';
        vfx.num(x, y - 24, String(e.amount), { color: col, stroke: '#7a2a1a', size: 20 });
        if (e.id === 'burn') vfx.burst({ x, y, n: 8, speed: [20, 90], angle: -Math.PI / 2, spread: 1.4, life: [0.4, 0.8], size: [3, 6], color: ['#ff8a3a', '#ffd06a'], shape: 'ember', gravity: -80 });
        if (e.killed) sc.sleep(0.15).then(() => this.kill(t));
        break;
      }
      case 'energy': {
        const t = this.actors.get(e.uid);
        if (t) t.energy = e.energy;
        break;
      }
      case 'death': {
        const t = this.actors.get(e.uid);
        if (t && t.alive) this.kill(t);
        break;
      }
      case 'revive': {
        const t = this.actors.get(e.uid);
        if (!t) return;
        t.hp = e.hp;
        t.revive();
        const [x, y] = t.anchor('foot');
        vfx.pillar(x, y, { h: 260, w: 60, color: '#b8ffc4', life: 0.8 });
        break;
      }
      case 'skip': {
        const t = this.actors.get(e.uid);
        if (!t) return;
        const [x, y] = t.anchor('top');
        vfx.num(x, y - 26, '晕乎乎…', { color: '#fff3a0', stroke: '#7a5a10', size: 20 });
        break;
      }
      case 'text': {
        const t = this.actors.get(e.uid);
        if (!t) return;
        const [x, y] = t.anchor('top');
        vfx.num(x, y - 40, e.text, { color: '#fff6c8', stroke: '#6a3aa0', size: 22, life: 1.1 });
        break;
      }
      case 'passive': {
        const t = this.actors.get(e.uid);
        if (!t) return;
        const last = this.lastPassive.get(e.uid) ?? -9;
        if (sc.time - last < 0.9) return;
        this.lastPassive.set(e.uid, sc.time);
        const [x, y] = t.anchor('top');
        vfx.num(x, y - 4, e.name, { color: '#ffe9a0', stroke: '#5a3a10', size: 15, life: 0.9 });
        break;
      }
      case 'summon': {
        // 由具体特效决定；通用兜底：猛兽爪痕
        for (const id of e.targets) {
          const t = this.actors.get(id);
          if (!t) continue;
          const [x, y] = t.anchor('chest');
          for (let k = 0; k < 3; k++) vfx.slash(x + (k - 1) * 12, y, { r: 36, a0: -1.2, a1: 0.5, width: 8, life: 0.3, color: '#ffb060', flip: false });
        }
        break;
      }
      default:
        break;
    }
  }

  async kill(t: Actor) {
    if (!t.alive) return;
    const [x, y] = t.anchor('chest');
    this.scene.vfx.burst({ x, y, n: 16, speed: [40, 200], life: [0.4, 0.9], size: [3, 7], color: ['#fff', '#ffe9a0'], shape: 'star', gravity: 80 });
    t.statuses.clear();
    t.shield = 0;
    await t.die();
    const [zx, zy] = t.anchor('top');
    this.scene.vfx.num(zx, zy + 30, 'Zzz', { color: '#d8e8ff', stroke: '#3a4a8a', size: 20, life: 1.4 });
  }
}
