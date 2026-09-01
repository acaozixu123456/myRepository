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


# Persist recovery attempts with the same local-only privacy boundary as the other derived evidence.
path = 'src/nhkMorning.ts'
text = read(path)
record_type = """export type NhkRecoveryAttemptRecord = {
  recoveryId: string;
  dateKey: string;
  scenarioId: string;
  reason: string;
  rating: NhkRecallRating;
  reviewId?: string;
  targetExpressionUsed?: boolean;
  contentScore?: number;
  completedAt: number;
};

"""
if 'export type NhkRecoveryAttemptRecord' not in text:
    anchor = 'export type NhkMorningSession = {'
    if anchor not in text:
        raise RuntimeError('anchor not found: session type')
    text = text.replace(anchor, record_type + anchor, 1)

session_start = text.index('export type NhkMorningSession = {')
session_end = text.index('\n};', session_start)
session_block = text[session_start:session_end]
if 'recoveryAttempts' not in session_block:
    recall_pattern = re.compile(r'(\n  recallAttempts\??:\s*NhkRecallAttempt\[\];)')
    if recall_pattern.search(session_block):
        session_block = recall_pattern.sub(r'\1\n  recoveryAttempts?: NhkRecoveryAttemptRecord[];', session_block, count=1)
    else:
        insertion = '\n  recoveryAttempts?: NhkRecoveryAttemptRecord[];'
        completed = session_block.find('\n  completedAt?: number;')
        if completed < 0:
            raise RuntimeError('anchor not found: recoveryAttempts field')
        session_block = session_block[:completed] + insertion + session_block[completed:]
    text = text[:session_start] + session_block + text[session_end:]

create_start = text.index('export const createNhkSession')
create_end = text.index('\n});', create_start)
create_block = text[create_start:create_end]
if 'recoveryAttempts:' not in create_block:
    if '  recallAttempts: [],' in create_block:
        create_block = create_block.replace('  recallAttempts: [],', '  recallAttempts: [],\n  recoveryAttempts: [],', 1)
    elif '  speechReviews: {},' in create_block:
        create_block = create_block.replace('  speechReviews: {},', '  speechReviews: {},\n  recoveryAttempts: [],', 1)
    else:
        raise RuntimeError('anchor not found: recoveryAttempts default')
    text = text[:create_start] + create_block + text[create_end:]
write(path, text)

# Integrate queue selection, speech-first recovery page, and local attempt persistence.
path = 'src/NhkMorningPage.tsx'
page = read(path)
if "from './nhkRecoveryQueue'" not in page:
    import_anchor = "import EpisodeVisual from './EpisodeVisual';"
    page = replace_once(
        page,
        import_anchor,
        import_anchor + "\nimport NhkRecoveryQueue from './NhkRecoveryQueue';\nimport {\n  buildNhkRecoveryQueue,\n  recordNhkRecoveryAttempt,\n  type NhkRecoveryQueueItem,\n} from './nhkRecoveryQueue';",
        'recovery imports',
    )

page = page.replace(
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'boss';",
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'boss' | 'recovery';",
    1,
)
if "| 'recovery'" not in page[page.find('type PageView'):page.find(';', page.find('type PageView')) + 1]:
    raise RuntimeError('anchor not found: recovery page view')

if 'const [recoveryItemId, setRecoveryItemId]' not in page:
    state_anchors = [
        "  const [bossRevision, setBossRevision] = useState(0);",
        "  const [worldView, setWorldView] = useState<WorldViewState | null>(null);",
    ]
    for anchor in state_anchors:
        if anchor in page:
            page = page.replace(anchor, anchor + "\n  const [recoveryItemId, setRecoveryItemId] = useState<string | null>(null);", 1)
            break
    else:
        raise RuntimeError('anchor not found: recovery item state')

if 'const recoveryQueue = useMemo' not in page:
    boss_anchor = "  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);"
    recovery_selectors = """  const bossWeakExpressions = useMemo(
    () => bossProgress?.outcome?.weakExpressions || [],
    [bossProgress],
  );
  const recoveryQueue = useMemo(
    () => buildNhkRecoveryQueue(sessions, todayKey, bossWeakExpressions),
    [sessions, todayKey, bossWeakExpressions],
  );
  const activeRecoveryItem = recoveryItemId
    ? recoveryQueue.find(item => item.recoveryId === recoveryItemId) || null
    : recoveryQueue[0] || null;
"""
    page = replace_once(page, boss_anchor, recovery_selectors + boss_anchor, 'recovery queue selectors')

# New input or a changed core sentence must never inherit attempts for an old expression.
reset_start = page.index('const resetSessionForSource')
reset_end = page.index('\n});', reset_start)
reset_block = page[reset_start:reset_end]
if 'recoveryAttempts: []' not in reset_block:
    if '  recallAttempts: [],' in reset_block:
        reset_block = reset_block.replace('  recallAttempts: [],', '  recallAttempts: [],\n  recoveryAttempts: [],', 1)
    elif '  speechReviews: {},' in reset_block:
        reset_block = reset_block.replace('  speechReviews: {},', '  speechReviews: {},\n  recoveryAttempts: [],', 1)
    else:
        raise RuntimeError('anchor not found: source recovery reset')
    page = page[:reset_start] + reset_block + page[reset_end:]

selection_marker = 'const resetOutput: NhkMorningSession = {'
if selection_marker in page:
    selection_start = page.index(selection_marker)
    selection_end = page.index('\n    };', selection_start)
    selection_block = page[selection_start:selection_end]
    if 'recoveryAttempts: []' not in selection_block:
        if '      recallAttempts: [],' in selection_block:
            selection_block = selection_block.replace('      recallAttempts: [],', '      recallAttempts: [],\n      recoveryAttempts: [],', 1)
        elif '      dailyInput: undefined,' in selection_block:
            selection_block = selection_block.replace('      dailyInput: undefined,', '      dailyInput: undefined,\n      recoveryAttempts: [],', 1)
        else:
            raise RuntimeError('anchor not found: selection recovery reset')
        page = page[:selection_start] + selection_block + page[selection_end:]

if 'const openRecovery = () =>' not in page:
    action_anchor = "  const openRecall = () => {"
    actions = """  const openRecovery = () => {
    const item = recoveryQueue[0];
    if (!item) return;
    setRecoveryItemId(item.recoveryId);
    setView('recovery');
  };

  const finishRecovery = (
    item: NhkRecoveryQueueItem,
    review?: Parameters<typeof recordNhkRecoveryAttempt>[3],
    fallbackRating?: Parameters<typeof recordNhkRecoveryAttempt>[4],
  ) => {
    const source = sessions.find(session => session.id === item.sourceSessionId);
    if (!source) {
      setRecoveryItemId(null);
      setView('home');
      return;
    }
    const next = recordNhkRecoveryAttempt(source, item, todayKey, review, fallbackRating);
    setSessions(current => upsertNhkSession(current, next));
    if (draftRef.current.id === next.id) {
      draftRef.current = next;
      setDraft(next);
    }
    setRecoveryItemId(null);
    setView('home');
  };

"""
    page = replace_once(page, action_anchor, actions + action_anchor, 'recovery actions')

if "if (view === 'recovery' && activeRecoveryItem)" not in page:
    render_anchors = [
        "  if (view === 'boss') {",
        "  if (view === 'world' && activeWorldEvent) {",
        "  if (view === 'recall' && recallSession) {",
    ]
    render = """  if (view === 'recovery' && activeRecoveryItem) {
    return (
      <NhkRecoveryQueue
        item={activeRecoveryItem}
        onBack={() => { setRecoveryItemId(null); setView('home'); }}
        onRecord={(review, fallbackRating) => finishRecovery(activeRecoveryItem, review, fallbackRating)}
      />
    );
  }

"""
    for anchor in render_anchors:
        if anchor in page:
            page = page.replace(anchor, render + anchor, 1)
            break
    else:
        raise RuntimeError('anchor not found: recovery page render')

if 'nhk-recovery-launch' not in page:
    launch = """      {recoveryQueue.length > 0 && (
        <button className="nhk-recovery-launch" onClick={openRecovery}>
          <RotateCcw size={19} />
          <div>
            <small>WEAK EXPRESSION RECOVERY</small>
            <strong>今天有 {recoveryQueue.length} 个薄弱表达需要找回</strong>
            <span>{recoveryQueue[0].reasonZh} · 换一个新场景再说</span>
          </div>
          <ChevronRight size={18} />
        </button>
      )}

"""
    home_anchors = [
        "      <button\n        className={`nhk-weekly-boss-launch",
        "      <NhkWeeklyEvidence sessions={sessions} todayKey={todayKey} />",
        "      {recent.length > 0 && (",
    ]
    inserted = False
    for anchor in home_anchors:
        if anchor in page:
            page = page.replace(anchor, launch + anchor, 1)
            inserted = True
            break
    if not inserted:
        raise RuntimeError('anchor not found: recovery launch card')

write(path, page)

# Add a compact home card and focused recovery-stage styling.
path = 'src/nhkMorning.css'
css = read(path)
marker = '/* nhk-recovery-queue-v1 */'
if marker not in css:
    css += r'''

/* nhk-recovery-queue-v1 */
.nhk-recovery-launch{width:100%;border:1px solid #ead8cf;background:#fbf2ed;border-radius:20px;min-height:74px;margin-top:10px;padding:11px 13px;display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:10px;text-align:left;color:#513d37}.nhk-recovery-launch>svg:first-child{color:#a56656}.nhk-recovery-launch>div{display:grid;gap:2px}.nhk-recovery-launch small{font-size:8px;color:#9a6d61;font-weight:900;letter-spacing:.7px}.nhk-recovery-launch strong{font-size:12px;line-height:1.45}.nhk-recovery-launch span{font-size:8px;line-height:1.5;color:#8c6b62}.nhk-recovery-card{border:1px solid #e0e4dc;border-radius:24px;background:#fff;padding:17px;box-shadow:0 12px 28px #17221c0b}.nhk-recovery-meta{display:flex;justify-content:space-between;align-items:center;gap:8px}.nhk-recovery-meta>span{display:flex;align-items:center;gap:5px;border-radius:999px;background:#17221c;color:#dff08a;padding:5px 8px;font-size:8px;font-weight:900}.nhk-recovery-meta>small{font-size:8px;line-height:1.45;color:#96695e;text-align:right}.nhk-recovery-card>h1{font-size:20px;line-height:1.45;margin:12px 0 8px}.nhk-recovery-card>p{font-size:9px;line-height:1.65;color:#69746c;margin:8px 0 0}.nhk-recovery-prompt{border-radius:16px;background:#f2f5eb;padding:12px;display:grid;gap:4px}.nhk-recovery-prompt small{font-size:8px;color:#718051;font-weight:900}.nhk-recovery-prompt strong{font-size:13px;line-height:1.65}.nhk-recovery-fallback{margin-top:13px;border-radius:17px;background:#f2f3ef;padding:12px;display:grid;gap:5px}.nhk-recovery-fallback>svg{color:#718078}.nhk-recovery-fallback>strong{font-size:11px}.nhk-recovery-fallback>p{font-size:8px;line-height:1.55;color:#778079;margin:0}.nhk-recovery-fallback>div{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:5px}.nhk-recovery-fallback button{min-height:38px;border:0;border-radius:11px;background:#fff;font-size:8px;color:#4e5a52}.nhk-recovery-fallback button:last-child{background:#17221c;color:#fff}.nhk-recovery-result{margin-top:11px;border-radius:17px;padding:12px;display:grid;gap:4px;background:#f8efeb}.nhk-recovery-result.good{background:#eef4dc}.nhk-recovery-result.close{background:#f7f3df}.nhk-recovery-result small{font-size:8px;color:#7d887f}.nhk-recovery-result strong{font-size:13px;line-height:1.55}.nhk-recovery-result p{font-size:10px;line-height:1.65;margin:0;color:#4e5a52}.nhk-recovery-result span{font-size:7px;color:#8b948d}
'''
write(path, css)

# Source-contract checks for the isolated CI gate.
assert 'export type NhkRecoveryAttemptRecord' in read('src/nhkMorning.ts')
assert 'recoveryAttempts?: NhkRecoveryAttemptRecord[];' in read('src/nhkMorning.ts')
assert "type PageView = 'home' | 'today' | 'recall' | 'world' | 'boss' | 'recovery';" in read('src/NhkMorningPage.tsx')
assert 'buildNhkRecoveryQueue(sessions, todayKey, bossWeakExpressions)' in read('src/NhkMorningPage.tsx')
assert 'recoveryAttempts: []' in read('src/NhkMorningPage.tsx')
assert marker in read('src/nhkMorning.css')
