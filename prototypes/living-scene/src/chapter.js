import { createRoomRenderer } from './room-renderer.js';
// One continuous evening. Separate from the existing street encounters and saves.
const SAVE = 'livingScene.chapter1.v1';
const scenes = {
  shop: { title: '志乃の店', subtitle: '木の戸を開けると、揚げ物の匂い。', alt: '同じ小巷里的便当店内，木柜台与食物托盘映着暖灯，窗外仍是雨后的蓝色街道。', point: [66, 57], label: '志乃さんに声をかける' },
  sento: { title: '路地の湯', subtitle: '志乃さんの店から、路地を少し先へ。', alt: '同一条湿石小巷深处的钱汤入口，蓝色门帘与暖灯，远处还能看见便当店的光。', point: [68, 55], label: 'のれんをくぐる' },
  bath: { title: '湯気のむこう', subtitle: '脱衣所を通り、体を洗ってから、湯船へ。', alt: '街角钱汤内部，青绿色瓷砖浴池、低矮洗浴位、木质高窗与轻薄水汽。', point: [60, 56], label: 'お湯に、身をゆだねる' },
};

export function createChapter({ onChange }) {
  const $ = s => document.querySelector(s);
  const host = document.createElement('section');
  host.id = 'chapter-room'; host.hidden = true; host.setAttribute('aria-label', '同一条街的夜晚');
  host.innerHTML = `<img id="room-art" alt=""><div class="room-caption"><p>第一章 · 雨后的约定</p><h2 id="room-title" lang="ja"></h2><p id="room-arrival" lang="ja"></p></div>
    <button id="room-hotspot"><span class="hotspot-label" lang="ja"></span></button>
    <section id="room-dialogue" aria-label="此处的对话" hidden><p id="room-speaker"></p><p id="room-line" lang="ja" tabindex="-1"></p><p id="room-translation" hidden></p><div id="room-choices"></div><div class="story-actions"><button id="room-explain" aria-expanded="false">读懂这一句</button><button id="room-look">静静看一会儿</button></div></section>
    <nav id="room-nav" aria-label="沿街继续"><button id="room-back">回到小巷</button><button id="room-next"></button></nav>`;
  $('#app').append(host);
  const motion = createRoomRenderer(host);
  let room = 'street', busy = false, dialogue = null;
  let flags = { ordered: false, bathed: false, collected: false };
  let writable = true;
  try {
    const raw = sessionStorage.getItem(SAVE);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version === 1 && Object.keys(flags).every(k => typeof saved[k] === 'boolean') && (!saved.collected || saved.ordered)) {
        for (const k of Object.keys(flags)) flags[k] = saved[k];
      } else writable = false;
    }
  } catch { writable = false; }
  const remember = () => { if (writable) try { sessionStorage.setItem(SAVE, JSON.stringify({ version: 1, ...flags })); } catch {} };
  const show = (speaker, ja, zh, choices = []) => {
    dialogue = ja;
    $('#room-speaker').textContent = speaker;
    $('#room-line').textContent = ja;
    $('#room-translation').textContent = zh;
    $('#room-translation').hidden = true;
    $('#room-explain').setAttribute('aria-expanded', 'false');
    $('#room-explain').textContent = '读懂这一句';
    $('#room-choices').replaceChildren();
    for (const [label, action] of choices) {
      const button = document.createElement('button'); button.textContent = label; button.onclick = action;
      $('#room-choices').append(button);
    }
    $('#room-dialogue').hidden = false;
    $('#room-hotspot').hidden = true;
    host.classList.add('talking');
    $('#room-line').focus({ preventScroll: true });
  };
  function look() {
    $('#room-dialogue').hidden = true; $('#room-hotspot').hidden = false;
    host.classList.remove('talking'); dialogue = null;
    $('#room-hotspot').focus({ preventScroll: true });
  }
  function talk() {
    if (room === 'shop') {
      if (flags.collected) show('志乃', 'ラテは、もう少しここにいるみたい。\n気をつけて帰ってね。', '拿铁好像还想在这里待一会儿。回去路上小心。');
      else if (flags.bathed && flags.ordered) show('志乃', 'おかえり。いいお湯だった？\n約束のお弁当、包んでおいたよ。', '回来啦，泡得舒服吗？约好的便当，已经替你包好了。', [['受け取る · 接过晚饭', () => { flags.collected = true; remember(); talk(); }]]);
      else if (flags.bathed) show('志乃', 'おかえり。体、温まった？\n晩ごはん、まだだったらどうぞ。', '回来啦，身上暖和了吗？要是还没吃晚饭，可以在这儿带一份。', [['お弁当を一つ · 带一份便当', () => { flags.ordered = flags.collected = true; remember(); talk(); }]]);
      else if (flags.ordered) show('志乃', 'お弁当は、帰りにね。\n銭湯は、この路地の突き当たり。', '晚饭等你回来取。钱汤就在这条巷子的尽头。', [['路地の先へ · 去巷尾', () => go('sento')]]);
      else show('志乃', 'いらっしゃい。まだ、少し冷えるね。\nこの先の銭湯、寄っていく？', '欢迎。雨后还有些凉呢。要不要去前面的钱汤暖和一下？', [['帰りに、お弁当を一つ。', () => { flags.ordered = true; remember(); show('志乃', 'うん、一つ取っておくね。\nラテは軒下で待ってるから。', '好，替你留一份。拿铁会在屋檐下待着。', [['銭湯へ · 去钱汤', () => go('sento')]]); }], ['先に、路地を見てきます。', () => go('street')]]);
    } else if (room === 'sento') {
      show('番台から', flags.bathed ? 'ごゆっくり。\n帰り道、滑らないようにね。' : 'こんばんは。タオルなら、こちらに。\nどうぞ、ごゆっくり。', flags.bathed ? '慢慢来。回去路上，留意湿滑的石头。' : '晚上好。需要毛巾的话，这边有。请慢慢享受。', [['お風呂へ · 进入浴场', () => go('bath')]]);
    } else if (room === 'bath') {
      if (!flags.bathed) show('湯船のふちで', '肩まで、ゆっくり。\n雨の冷たさが、ほどけていく。', '慢慢浸到肩头。雨留下的寒意，一点一点散开了。', [['ひと息つく · 泡一会儿', () => { flags.bathed = true; remember(); talk(); }]]);
      else show('湯上がりに', flags.ordered && !flags.collected ? 'そろそろ、志乃さんのところへ。\n晩ごはんが、待っている。' : '体が、ぽかぽかする。\nあの灯りのところまで、戻ろう。', flags.ordered && !flags.collected ? '差不多该回志乃的店里了。晚饭还在等着我。' : '身上暖融融的。沿着刚才的灯光，慢慢走回去吧。', [['外の風にあたる · 回到钱汤门前', () => go('sento')]]);
    }
  }
  async function go(next) {
    if (busy || next === room || (next !== 'street' && !scenes[next])) return;
    busy = true;
    $('#notice').textContent = '';
    try {
      // Decode before covering the current scene: a failed load leaves a usable exit.
      if (next !== 'street') { const img = new Image(); img.src = `/chapter1/${next}.png`; await img.decode(); }
      const previous = room;
      document.body.classList.add('chapter-changing');
      await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320));
      await motion.load(next);
      room = next;
      onChange(next);
      host.hidden = next === 'street';
      document.body.classList.toggle('inside-chapter', next !== 'street');
      if (next !== 'street') {
        const scene = scenes[next];
        $('#room-art').src = `/chapter1/${next}.png`; $('#room-art').alt = scene.alt;
        $('#room-title').textContent = scene.title;
        $('#room-arrival').textContent = next === 'sento' && previous === 'bath' ? '湯上がりの風が、頬に気持ちいい。' : scene.subtitle;
        $('#room-hotspot').style.left = `${scene.point[0]}%`; $('#room-hotspot').style.top = `${scene.point[1]}%`;
        $('#room-hotspot span').textContent = scene.label;
        $('#room-hotspot').setAttribute('aria-label', scene.label);
        $('#room-next').textContent = next === 'shop' ? (flags.bathed ? '小巷里的拿铁 →' : '沿巷去钱汤 →') : next === 'sento' ? (flags.bathed ? '沿原路回便当店 →' : '掀开门帘 →') : '回到钱汤门前 →';
        $('#room-next').onclick = () => go(next === 'shop' ? (flags.bathed ? 'street' : 'sento') : next === 'sento' ? (flags.bathed ? 'shop' : 'bath') : 'sento');
        $('#room-back').textContent = next === 'bath' ? '← 回到钱汤门前' : '← 回到小巷';
        $('#room-dialogue').hidden = true; $('#room-hotspot').hidden = false; host.classList.remove('talking'); dialogue = null;
        host.classList.add('arriving');
        setTimeout(() => host.classList.remove('arriving'), 4800);
        $('#room-title').tabIndex = -1;
        $('#room-title').focus({ preventScroll: true });
      } else {
        $('#places-toggle').focus({ preventScroll: true });
        if (flags.bathed && flags.collected) $('#notice').textContent = '晚饭拿好了。拿铁还在熟悉的屋檐下。';
      }
    } catch {
      $('#notice').textContent = '这处画面暂时没能打开，可以留在这里，或稍后再试。';
    } finally { document.body.classList.remove('chapter-changing'); busy = false; }
  }
  $('#room-hotspot').onclick = talk;
  $('#room-back').onclick = () => go(room === 'bath' ? 'sento' : 'street');
  $('#room-look').onclick = look;
  $('#room-explain').onclick = () => {
    const expanded = $('#room-translation').hidden;
    $('#room-translation').hidden = !expanded;
    $('#room-explain').setAttribute('aria-expanded', String(expanded));
    $('#room-explain').textContent = expanded ? '收起解释' : '读懂这一句';
  };
  addEventListener('keydown', e => { if (e.key === 'Escape' && room !== 'street') { if (dialogue) look(); else go(room === 'bath' ? 'sento' : 'street'); } });
  return { go, update: motion.update, snapshot: () => ({ room, busy, dialogue, ...flags, motion: motion.snapshot() }) };
}
