from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    assert text.count(old) == 1, f'unexpected source revision for {path}: {old[:120]!r}'
    p.write_text(text.replace(old, new), encoding='utf-8')

replace_once(
    'index.html',
    '''<button id="pause" aria-label="暂停动态" title="暂停动态">Ⅱ</button\n          ><button id="fullscreen" aria-label="全屏欣赏" title="全屏欣赏">''',
    '''<button id="pause" aria-label="暂停动态" title="暂停动态">Ⅱ</button\n          ><button id="sound" aria-label="开启声音" aria-pressed="false" title="开启声音">♪</button\n          ><button id="fullscreen" aria-label="全屏欣赏" title="全屏欣赏">''',
)

replace_once(
    'src/main.js',
    '''import fragmentShader from "./scene.frag.glsl?raw";''',
    '''import fragmentShader from "./scene.frag.glsl?raw";\nimport { createLivingSceneAudio } from "./audio.js";''',
)

replace_once(
    'src/main.js',
    '''  aspect = width / height;\nfunction pauseLabel() {''',
    '''  aspect = width / height;\nconst sound = createLivingSceneAudio((state) => updateSoundButton(state));\nfunction updateSoundButton(state = sound.snapshot()) {\n  const button = $("#sound");\n  if (!button) return;\n  button.disabled = !state.supported;\n  button.dataset.on = String(state.enabled);\n  button.setAttribute("aria-pressed", String(state.enabled));\n  const label = !state.supported\n    ? "当前浏览器不支持声音"\n    : state.enabled\n      ? "关闭声音"\n      : state.preferred\n        ? "恢复声音"\n        : "开启声音";\n  button.setAttribute("aria-label", label);\n  button.title = label;\n  button.textContent = state.enabled ? "♫" : "♪";\n}\nfunction pauseLabel() {''',
)

replace_once(
    'src/main.js',
    '''function focus(next) {\n  focused = next;''',
    '''function focus(next) {\n  focused = next;\n  sound.setFocus(next);''',
)

replace_once(
    'src/main.js',
    '''hotspot.onpointerenter = () => (hovered = true);\nhotspot.onpointerleave = () => (hovered = false);\nhotspot.onfocus = () => (hovered = true);\nhotspot.onblur = () => (hovered = false);''',
    '''hotspot.onpointerenter = () => { hovered = true; sound.setHover(true); };\nhotspot.onpointerleave = () => { hovered = false; sound.setHover(false); };\nhotspot.onfocus = () => { hovered = true; sound.setHover(true); };\nhotspot.onblur = () => { hovered = false; sound.setHover(false); };''',
)

replace_once(
    'src/main.js',
    '''addEventListener("pointermove", (e) =>\n  mouse.set((e.clientX / width) * 2 - 1, 1 - (e.clientY / height) * 2),\n);''',
    '''addEventListener("pointermove", (e) => {\n  const px = (e.clientX / width) * 2 - 1;\n  mouse.set(px, 1 - (e.clientY / height) * 2);\n  sound.setPointer(px);\n});''',
)

replace_once(
    'src/main.js',
    '''pauseLabel();\n$("#fullscreen").onclick = async () => {''',
    '''pauseLabel();\nupdateSoundButton();\n$("#sound").onclick = async () => {\n  const before = sound.snapshot();\n  await sound.toggle();\n  const after = sound.snapshot();\n  updateSoundButton(after);\n  if (!before.supported || (!after.enabled && !after.started))\n    $("#notice").textContent = "当前浏览器暂时无法开启声音。";\n  else if (after.enabled)\n    $("#notice").textContent = "雨后的街道有声音了。";\n  else\n    $("#notice").textContent = "声音已关闭。";\n};\n$("#fullscreen").onclick = async () => {''',
)

replace_once(
    'src/main.js',
    '''document.addEventListener("visibilitychange", () => (last = 0));''',
    '''document.addEventListener("visibilitychange", () => {\n  last = 0;\n  sound.setHidden(document.hidden);\n});''',
)

replace_once(
    'src/main.js',
    '''      errors: [...errors],\n    }),''',
    '''      errors: [...errors],\n      audio: sound.snapshot(),\n    }),''',
)

p = Path('src/style.css')
text = p.read_text(encoding='utf-8')
extra = '''\n/* Audio stays inside the disappearing chrome: sound should enrich the artwork, not become UI. */\n.controls #sound {\n  font-family: Arial, sans-serif;\n  font-size: 15px;\n  transition: background .3s, border-color .3s, color .3s, box-shadow .3s;\n}\n.controls #sound[data-on="true"] {\n  color: #f3d6a5;\n  border-color: #ecc38f66;\n  background: #c98d4930;\n  box-shadow: 0 0 18px #be814526;\n}\n.controls #sound:disabled {\n  opacity: .35;\n  cursor: default;\n}\n'''
if extra not in text:
    p.write_text(text + extra, encoding='utf-8')
