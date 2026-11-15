// 入口：读档、建画面、挂界面、接上点按和遇敌。
import './ui/style.css';
import * as C from './core/index.js';
import { ZONES, ITEMS, CROPS } from './data/index.js';
import { createView } from './world/view.js';
import { store, boot, save, setState } from './ui/store.js';
import { mountUI, ui, setMode, openSheet, closeSheet, toast, showReport, hooks } from './ui/app.js';
import { initBattle, startEncounter, followPlates, flash, look, getBattle } from './ui/battle.js';

const $ = id => document.getElementById(id);
const s0 = await boot();
const view = await createView($('c'), $('sky'), $('stars'));
initBattle(view);

mountUI($('ui'), {
  async goZone(i) {
    const s = store.s, z = ZONES[i]; ui.busy = true;
    await flash(async () => { s.world.zone = z.id; if (z.home) C.fullHeal(s); save(); await view.loadZone(z, look()); });
    ui.busy = false; toast(z.home ? '回到小岛，体力都恢复了。' : z.name, z.home ? '' : `${z.desc} 发光的地方是首领。`);
  },
  setPet: () => view.setPet(look().pet),
  async previewClass(k) {
    if (k === ui.pickCls || ui.busy) return; ui.pickCls = k; openSheet('pick', { lock: true }); ui.busy = true;
    await view.loadZone(ZONES[0], { cls: k, pet: null }); ui.busy = false;
  },
  startGame(k) {
    setState(C.newGame(k)); closeSheet(); view.setZoom(14); setMode('world'); ui.busy = false;
    toast('点地面就能走。', '先去石灯旁边，和灯灵说说话。', 4200);
  },
});

// 地图上的点按
{ let down = null; const c = $('c');
  c.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  c.addEventListener('pointerup', e => { if (down && !ui.busy && !ui.sheet && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) view.tap(e.clientX, e.clientY); down = null; }); }
view.on('encounter', startEncounter);
// 岛上的采集点、宝箱、NPC
view.on('extras', zone => { const s = store.s; if (!s || !zone.lv && !zone.home) return {}; return { npcs: C.npcsIn(zone.id), gather: zone.lv ? C.gatherLeft(s, zone.id) : 0, chest: C.chestReady(s, zone.id), farm: !!zone.home }; });
view.on('farm', () => { const s = store.s, now = Date.now(); return s ? C.home(s).plots.map(p => p && { color: CROPS[p.crop].color, ripe: now >= p.ready, k: Math.round(Math.min(1, (now - p.at) / (p.ready - p.at)) * 4) / 4 }) : []; });
view.on('interact', it => {
  const s = store.s; if (!s || ui.busy || ui.sheet) { it.told = false; return; }
  if (it.kind === 'npc') { ui.talk = { id: it.id, i: 0 }; openSheet('talk'); }
  else if (it.kind === 'gather') { const got = C.gather(s, s.world.zone); view.removeInter(it); if (!got) return toast('今天这里采得差不多了'); save(); toast(`采到 ${got.map(([id, n]) => `${ITEMS[id].name} ×${n}`).join('、')}`, `今天还能采 ${C.gatherLeft(s, s.world.zone)} 次`); }
  else if (it.kind === 'farm') { ui.homeTab = 'farm'; openSheet('home'); }
  else if (it.kind === 'chest') { const out = C.openChest(s, s.world.zone); view.removeInter(it); if (!out) return; save(); showReport('打开了宝箱', out, null); }
});
view.on('npcMark', id => (store.s ? C.npcMark(store.s, id) : null));
view.on('lantern', () => { if (!ui.busy && !ui.sheet) openSheet('quests'); });

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; view.frame(dt, now / 1000); followPlates();
  requestAnimationFrame(loop);
}

if (s0) {
  await view.loadZone(C.zoneOf(s0), look()); setMode('world'); ui.busy = false;
  // 离开一小时以上：「你不在的时候」
  const notes = C.awayNotes(s0, store.prevSeen); if (notes) showReport('你不在的时候', notes.map((text, i) => ({ text, big: i === 0 ? 1 : 0 })), null);
}
else { view.setZoom(9, 0.27); await view.loadZone(ZONES[0], { cls: ui.pickCls, pet: null }); setMode('pick'); openSheet('pick', { lock: true }); ui.busy = false; }
requestAnimationFrame(loop);
$('loading').classList.add('done'); window.__ready = true;
window.__game = { get s() { return store.s; }, get battle() { return getBattle(); }, view, save, ui, encounter: startEncounter, openSheet, C, get hooks() { return hooks; } };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
