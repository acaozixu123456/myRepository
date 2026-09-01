from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'anchor not found: {label}')
    return text.replace(old, new, 1)


# Pass the verified causal event into App instead of dropping it at the boundary.
path = 'src/NhkMorningPage.tsx'
page = read(path)
if "import type {NhkCausalWorldEvent} from './nhkCausalWorld';" not in page:
    page = replace_once(
        page,
        "import EpisodeVisual from './EpisodeVisual';",
        "import EpisodeVisual from './EpisodeVisual';\nimport type {NhkCausalWorldEvent} from './nhkCausalWorld';",
        'causal event type import',
    )
page = replace_once(
    page,
    "  onEnterWorld: () => void;",
    "  onEnterWorld: (event?: NhkCausalWorldEvent) => void;",
    'morning world callback type',
)
page = replace_once(
    page,
    "        onContinue={onEnterWorld}",
    "        onContinue={() => onEnterWorld(activeWorldEvent)}",
    'pass causal event to app',
)
write(path, page)

# Persist a one-shot bridge and inject it into the selected canonical episode.
path = 'src/App.tsx'
app = read(path)
if "from './nhkWorldEpisodeBridge'" not in app:
    app = replace_once(
        app,
        "import NhkMorningPage from './NhkMorningPage';",
        "import NhkMorningPage from './NhkMorningPage';\nimport {\n  activeNhkWorldEpisodeBridge,\n  createNhkWorldEpisodeBridge,\n  loadNhkWorldEpisodeBridge,\n  markNhkWorldEpisodeBridgeConsumed,\n  nhkWorldEpisodeContextLine,\n  NHK_WORLD_EPISODE_BRIDGE_VERSION,\n  saveNhkWorldEpisodeBridge,\n} from './nhkWorldEpisodeBridge';",
        'episode bridge imports',
    )
if 'const [worldEpisodeBridge, setWorldEpisodeBridge]' not in app:
    app = replace_once(
        app,
        "  const [memories, setMemories] = useState<MemoryMap>(() => {\n    try { return migrateMemory(JSON.parse(localStorage.getItem('nihongo-memories') || '{}') as MemoryMap); } catch { return {}; }\n  });",
        "  const [memories, setMemories] = useState<MemoryMap>(() => {\n    try { return migrateMemory(JSON.parse(localStorage.getItem('nihongo-memories') || '{}') as MemoryMap); } catch { return {}; }\n  });\n  const [worldEpisodeBridge, setWorldEpisodeBridge] = useState(() => loadNhkWorldEpisodeBridge());",
        'episode bridge state',
    )
if 'saveNhkWorldEpisodeBridge(worldEpisodeBridge)' not in app:
    app = replace_once(
        app,
        "  useEffect(() => localStorage.setItem('nihongo-sfx', sfxEnabled ? 'on' : 'off'), [sfxEnabled]);",
        "  useEffect(() => localStorage.setItem('nihongo-sfx', sfxEnabled ? 'on' : 'off'), [sfxEnabled]);\n  useEffect(() => saveNhkWorldEpisodeBridge(worldEpisodeBridge), [worldEpisodeBridge]);",
        'episode bridge persistence',
    )
if 'markNhkWorldEpisodeBridgeConsumed' in app and 'const active = activeNhkWorldEpisodeBridge(current, selected.id);' not in app:
    app = replace_once(
        app,
        "    const now = Date.now();\n    reportProgress(selected);",
        "    const now = Date.now();\n    setWorldEpisodeBridge(current => {\n      const active = activeNhkWorldEpisodeBridge(current, selected.id);\n      return active ? markNhkWorldEpisodeBridgeConsumed(active, now) : current;\n    });\n    reportProgress(selected);",
        'consume bridge on episode completion',
    )
app = replace_once(
    app,
    "    const memoryEcho = pickMemoryEcho(selected, memories, stories);\n    const contextLine = meta?.todayHook || undefined;",
    "    const memoryEcho = pickMemoryEcho(selected, memories, stories);\n    const activeWorldBridge = activeNhkWorldEpisodeBridge(worldEpisodeBridge, selected.id);\n    const contextLine = activeWorldBridge ? nhkWorldEpisodeContextLine(activeWorldBridge) : meta?.todayHook || undefined;",
    'episode context injection',
)
if 'data-bridge-version={NHK_WORLD_EPISODE_BRIDGE_VERSION}' not in app:
    app = replace_once(
        app,
        "          </header>\n          {openMode === 'play' ? (",
        "          </header>\n          {activeWorldBridge && (\n            <div className=\"nhk-episode-causal-bridge\" data-bridge-version={NHK_WORLD_EPISODE_BRIDGE_VERSION}>\n              <small>{activeWorldBridge.isCallback ? '三天前的选择接进了这一集' : '今天的回答改变了这一集的开场'}</small>\n              <strong>{nhkWorldEpisodeContextLine(activeWorldBridge)}</strong>\n              {activeWorldBridge.targetExpression && <span>继续带着：{activeWorldBridge.targetExpression}</span>}\n            </div>\n          )}\n          {openMode === 'play' ? (",
        'episode bridge banner',
    )
old_callback = """            onEnterWorld={() => {
              setTab('play');
              if (continueStory) openStory(continueStory.id, 'play');
            }}"""
new_callback = """            onEnterWorld={event => {
              setTab('play');
              if (continueStory) {
                if (event) setWorldEpisodeBridge(createNhkWorldEpisodeBridge(event, continueStory.id));
                openStory(continueStory.id, 'play');
              }
            }}"""
app = replace_once(app, old_callback, new_callback, 'morning causal bridge creation')
write(path, app)

css_path = 'src/nhkMorning.css'
css = read(css_path)
marker = '/* nhk-world-episode-bridge-v1 */'
if marker not in css:
    css += r'''

/* nhk-world-episode-bridge-v1 */
.nhk-episode-causal-bridge{margin:0 12px 10px;border:1px solid #d9e5ba;border-radius:17px;background:#eef4dc;padding:11px;display:grid;gap:4px}.nhk-episode-causal-bridge>small{font-size:8px;color:#60783c;font-weight:900}.nhk-episode-causal-bridge>strong{font-size:10px;line-height:1.6;color:#354431}.nhk-episode-causal-bridge>span{width:max-content;max-width:100%;border-radius:999px;background:#17221c;color:#dff08a;padding:4px 7px;font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
'''
write(css_path, css)

assert "onEnterWorld: (event?: NhkCausalWorldEvent) => void;" in read('src/NhkMorningPage.tsx')
assert 'createNhkWorldEpisodeBridge(event, continueStory.id)' in read('src/App.tsx')
assert 'data-bridge-version={NHK_WORLD_EPISODE_BRIDGE_VERSION}' in read('src/App.tsx')
assert marker in read(css_path)
