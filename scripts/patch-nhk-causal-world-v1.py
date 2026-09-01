from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'anchor not found: {label}')
    return text.replace(old, new, 1)


# Persist whether a delayed world callback has already been opened.
path = 'src/nhkMorning.ts'
text = read(path)
if 'worldCallbackRevealedAt?: number;' not in text:
    text = replace_once(
        text,
        "  speechReviews: Partial<Record<NhkSpeechMode, NhkSpeechReview>>;\n  completedAt?: number;",
        "  speechReviews: Partial<Record<NhkSpeechMode, NhkSpeechReview>>;\n  worldCallbackRevealedAt?: number;\n  completedAt?: number;",
        'session callback field',
    )
if 'worldCallbackRevealedAt: undefined,' not in text:
    text = replace_once(
        text,
        "  speechFallback: false,\n  speechReviews: {},\n  recallAttempts: [],",
        "  speechFallback: false,\n  speechReviews: {},\n  worldCallbackRevealedAt: undefined,\n  recallAttempts: [],",
        'session callback default',
    )
write(path, text)

# Wire the independent causal event page and the delayed callback into the morning flow.
path = 'src/NhkMorningPage.tsx'
text = read(path)
if "from './nhkCausalWorld'" not in text:
    text = replace_once(
        text,
        "import EpisodeVisual from './EpisodeVisual';\nimport {\n  NhkRecordingCoach,",
        "import EpisodeVisual from './EpisodeVisual';\nimport NhkCausalWorld from './NhkCausalWorld';\nimport {\n  buildNhkCausalWorldEvent,\n  markNhkWorldCallbackRevealed,\n  pickNhkWorldCallback,\n} from './nhkCausalWorld';\nimport {\n  NhkRecordingCoach,",
        'causal imports',
    )
text = text.replace(
    "type PageView = 'home' | 'today' | 'recall';",
    "type PageView = 'home' | 'today' | 'recall' | 'world';\ntype WorldViewState = {sessionId: string; callback: boolean};",
    1,
)
if "const [worldView, setWorldView]" not in text:
    text = replace_once(
        text,
        "  const [recallReview, setRecallReview] = useState<NhkSpeechReview | undefined>();",
        "  const [recallReview, setRecallReview] = useState<NhkSpeechReview | undefined>();\n  const [worldView, setWorldView] = useState<WorldViewState | null>(null);",
        'world view state',
    )
if 'const worldCallbackTarget = useMemo' not in text:
    text = replace_once(
        text,
        "  const recallSession = recallTarget?.session || null;\n  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);",
        "  const recallSession = recallTarget?.session || null;\n  const worldCallbackTarget = useMemo(() => pickNhkWorldCallback(sessions, todayKey), [sessions, todayKey]);\n  const activeWorldSession = worldView\n    ? sessions.find(session => session.id === worldView.sessionId)\n      || (draft.id === worldView.sessionId ? draft : null)\n    : null;\n  const activeWorldEvent = useMemo(\n    () => activeWorldSession ? buildNhkCausalWorldEvent(activeWorldSession, Boolean(worldView?.callback)) : null,\n    [activeWorldSession, worldView],\n  );\n  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);",
        'callback selectors',
    )
# New source or a changed selection must never inherit the old event/reaction.
if 'worldCallbackRevealedAt: undefined,' not in text.split('function', 1)[0]:
    text = replace_once(
        text,
        "  speechFallback: false,\n  speechReviews: {},\n  recallAttempts: [],",
        "  speechFallback: false,\n  speechReviews: {},\n  worldCallbackRevealedAt: undefined,\n  recallAttempts: [],",
        'source reset callback',
    )
# The selection reset may be later in the file; always clear the old daily input before rebuilding it.
selection_anchor = "    const resetOutput: NhkMorningSession = {\n      ...draftRef.current,\n      recapText: '',"
if selection_anchor in text and "      dailyInput: undefined,\n      worldCallbackRevealedAt: undefined," not in text[text.index(selection_anchor):text.index(selection_anchor) + 260]:
    text = text.replace(
        selection_anchor,
        "    const resetOutput: NhkMorningSession = {\n      ...draftRef.current,\n      dailyInput: undefined,\n      worldCallbackRevealedAt: undefined,\n      recapText: '',",
        1,
    )
if 'const openTodayWorld = () =>' not in text:
    text = replace_once(
        text,
        "  const openRecall = () => {\n    setRecallRevealed(false);",
        "  const openTodayWorld = () => {\n    const session = todaySession || (draftRef.current.completedAt ? draftRef.current : null);\n    if (!session || !buildNhkCausalWorldEvent(session)) return;\n    setWorldView({sessionId: session.id, callback: false});\n    setView('world');\n  };\n\n  const openWorldCallback = () => {\n    if (!worldCallbackTarget) return;\n    const next = markNhkWorldCallbackRevealed(worldCallbackTarget.session);\n    setSessions(current => upsertNhkSession(current, next));\n    if (draftRef.current.id === next.id) {\n      draftRef.current = next;\n      setDraft(next);\n    }\n    setWorldView({sessionId: next.id, callback: true});\n    setView('world');\n  };\n\n  const openRecall = () => {\n    setRecallRevealed(false);",
        'world open actions',
    )
if "if (view === 'world' && activeWorldEvent)" not in text:
    text = replace_once(
        text,
        "  if (view === 'recall' && recallSession) {",
        "  if (view === 'world' && activeWorldEvent) {\n    return (\n      <NhkCausalWorld\n        event={activeWorldEvent}\n        story={worldStory}\n        onBack={() => { setWorldView(null); setView('home'); }}\n        onContinue={onEnterWorld}\n      />\n    );\n  }\n\n  if (view === 'recall' && recallSession) {",
        'world page render',
    )
old_home = """      {todaySession?.completedAt && (
        <button className=\"nhk-enter-world\" onClick={onEnterWorld}>
          <Sparkles size={19} />
          <div><small>今天带进去</small><strong>{todaySession.workVersion || todaySession.keyExpression}</strong></div>
          <ChevronRight size={18} />
        </button>
      )}"""
new_home = """      {worldCallbackTarget && (
        <button className=\"nhk-world-callback-card\" onClick={openWorldCallback}>
          <MessageCircle size={19} />
          <div><small>三天前的选择产生了后续</small><strong>田中又来找你了</strong></div>
          <ChevronRight size={18} />
        </button>
      )}

      {todaySession?.completedAt && buildNhkCausalWorldEvent(todaySession) && (
        <button className=\"nhk-enter-world\" onClick={openTodayWorld}>
          <Sparkles size={19} />
          <div><small>今天造成的变化</small><strong>{todaySession.dailyInput?.world.characterReactionJa || todaySession.workVersion || todaySession.keyExpression}</strong></div>
          <ChevronRight size={18} />
        </button>
      )}"""
if old_home in text:
    text = text.replace(old_home, new_home, 1)
elif 'nhk-world-callback-card' not in text:
    raise RuntimeError('anchor not found: home causal cards')
if 'MessageCircle' not in text.split("} from 'lucide-react';", 1)[0]:
    text = replace_once(text, '  Link2,\n  LoaderCircle,', '  Link2,\n  LoaderCircle,\n  MessageCircle,', 'message icon')
write(path, text)

# Add the event thread styling without changing the existing visual language.
path = 'src/nhkMorning.css'
text = read(path)
marker = '/* nhk-causal-world-v1 */'
if marker not in text:
    text += r'''

/* nhk-causal-world-v1 */
.nhk-world-callback-card{width:100%;border:1px solid #d8e2bd;background:#f3f7e7;border-radius:18px;min-height:66px;margin-top:9px;padding:10px 13px;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:9px;text-align:left;color:#2f3f35}.nhk-world-callback-card>svg:first-child{color:#607d35}.nhk-world-callback-card div{display:grid;gap:2px}.nhk-world-callback-card small{font-size:8px;color:#7d8a70}.nhk-world-callback-card strong{font-size:12px;line-height:1.4}.nhk-causal-world{padding-bottom:30px}.nhk-causal-hero{border:1px solid #dfe4d9;border-radius:24px;background:#fff;padding:14px;box-shadow:0 12px 28px #17221c0b}.nhk-causal-hero .episode-visual{margin-bottom:12px}.nhk-causal-badge{display:flex;align-items:center;gap:6px;width:max-content;border-radius:999px;background:#eaf1d8;color:#5f753d;padding:5px 8px;font-size:8px;font-weight:900}.nhk-causal-hero h1{font-size:20px;line-height:1.45;margin:9px 0 5px}.nhk-causal-hero>p{font-size:10px;line-height:1.7;color:#68736b;margin:0}.nhk-causal-thread{display:grid;gap:9px;margin-top:12px}.nhk-causal-message{border-radius:19px;padding:13px;display:grid;gap:5px}.nhk-causal-message>span{font-size:8px;font-weight:900}.nhk-causal-message>strong{font-size:12px;line-height:1.65}.nhk-causal-message.character{background:#eef1eb;margin-right:22px}.nhk-causal-message.character>span{color:#718078}.nhk-causal-message.learner{background:#17221c;color:#fff;margin-left:22px}.nhk-causal-message.learner>span{color:#c8d3cb}.nhk-causal-message.learner>small{font-size:8px;color:#dff08a}.nhk-causal-message.reaction{background:#eef4dc;border:1px solid #d9e5ba}.nhk-causal-message.reaction>span{display:flex;align-items:center;gap:5px;color:#60783c}.nhk-causal-message.reaction>p{font-size:9px;line-height:1.6;color:#5d695d;margin:0}.nhk-causal-consequence{margin-top:12px;border-radius:17px;background:#eaf1d8;padding:12px;display:grid;grid-template-columns:24px 1fr;align-items:center;gap:8px;color:#465c2d}.nhk-causal-consequence.pending{background:#f0f2ed;color:#58635b}.nhk-causal-consequence div{display:grid;gap:2px}.nhk-causal-consequence small{font-size:8px;color:#77816f}.nhk-causal-consequence strong{font-size:10px;line-height:1.55}
'''
write(path, text)

# Guard the integration markers so CI cannot silently pass without the feature.
page = read('src/NhkMorningPage.tsx')
model = read('src/nhkCausalWorld.ts')
assert "type PageView = 'home' | 'today' | 'recall' | 'world'" in page
assert 'nhk-world-callback-card' in page
assert 'dailyInput: undefined' in page
assert 'NHK_CAUSAL_WORLD_VERSION' in model
