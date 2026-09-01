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


# Keep the new component compatible with strict no-unused TypeScript settings.
component_path = 'src/NhkWeeklyBoss.tsx'
component = read(component_path)
if not component.startswith("import {useEffect"):
    component = "import {useEffect, useState, type Dispatch, type SetStateAction} from 'react';\n" + component
component = component.replace(', Sparkles, Target', ', Target')
component = component.replace('): [NhkWeeklyBossProgress, React.Dispatch<React.SetStateAction<NhkWeeklyBossProgress>>] {', '): [NhkWeeklyBossProgress, Dispatch<SetStateAction<NhkWeeklyBossProgress>>] {')
component = component.replace('  const [progress, setProgress] = React.useState<NhkWeeklyBossProgress>', '  const [progress, setProgress] = useState<NhkWeeklyBossProgress>')
component = component.replace('  React.useEffect(() => {', '  useEffect(() => {')
component = component.replace('  React.useEffect(() => saveNhkWeeklyBossProgress(progress), [progress]);', '  useEffect(() => saveNhkWeeklyBossProgress(progress), [progress]);')
write(component_path, component)

# Make the test fixture use five distinct expressions inside one Monday-Sunday week.
test_path = 'src/nhkWeeklyBoss.test.ts'
test = read(test_path)
test = test.replace("  const dateKey = `2026-08-${String(31 - index).padStart(2, '0')}`;", "  const dateKey = `2026-09-${String(index + 1).padStart(2, '0')}`;")
test = test.replace('  const sourceSentence = `仕様変更${expressionSuffix}を受けて、確認方法を見直しました。`;', '  const sourceSentence = `仕様変更${expressionSuffix || index}を受けて、確認方法を見直しました。`;')
test = test.replace("'2026-08-31'", "'2026-09-06'")
write(test_path, test)

page_path = 'src/NhkMorningPage.tsx'
page = read(page_path)
if "from './nhkWeeklyBoss'" not in page:
    page = replace_once(
        page,
        "import NhkWeeklyEvidence from './NhkWeeklyEvidence';",
        "import NhkWeeklyEvidence from './NhkWeeklyEvidence';\nimport NhkWeeklyBoss from './NhkWeeklyBoss';\nimport {buildNhkWeeklyBossPlan, loadNhkWeeklyBossProgress} from './nhkWeeklyBoss';",
        'weekly boss imports',
    )
page = replace_once(
    page,
    "type PageView = 'home' | 'today' | 'recall' | 'world';",
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'boss';",
    'boss page view',
)
if 'const [bossRevision, setBossRevision]' not in page:
    page = replace_once(
        page,
        "  const [worldView, setWorldView] = useState<WorldViewState | null>(null);",
        "  const [worldView, setWorldView] = useState<WorldViewState | null>(null);\n  const [bossRevision, setBossRevision] = useState(0);",
        'boss revision state',
    )
if 'const bossPlan = useMemo' not in page:
    page = replace_once(
        page,
        "  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);",
        "  const bossPlan = useMemo(() => buildNhkWeeklyBossPlan(sessions, todayKey), [sessions, todayKey]);\n  const bossProgress = useMemo(\n    () => loadNhkWeeklyBossProgress(bossPlan.planId),\n    [bossPlan.planId, bossRevision],\n  );\n  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);",
        'boss plan selector',
    )
if "if (view === 'boss')" not in page:
    page = replace_once(
        page,
        "  if (view === 'world' && activeWorldEvent) {",
        "  if (view === 'boss') {\n    return (\n      <NhkWeeklyBoss\n        plan={bossPlan}\n        onBack={() => setView('home')}\n        onComplete={() => { setBossRevision(value => value + 1); setView('home'); }}\n      />\n    );\n  }\n\n  if (view === 'world' && activeWorldEvent) {",
        'boss page render',
    )
if 'nhk-weekly-boss-launch' not in page:
    launcher = """      <button
        className={`nhk-weekly-boss-launch ${bossPlan.ready ? 'ready' : ''} ${bossProgress?.completedAt ? 'done' : ''}`.trim()}
        disabled={!bossPlan.ready}
        onClick={() => setView('boss')}
      >
        <Sparkles size={20} />
        <div>
          <small>WEEKLY BOSS · 3 MIN</small>
          <strong>{bossProgress?.completedAt ? '本周综合对话已完成' : bossPlan.ready ? '5 个真实表达，没有选择题' : `已准备 ${bossPlan.availableExpressionCount}/5 个不同表达`}</strong>
          <span>{bossPlan.ready ? '根据上一遍表现自动追问或补救' : '继续完成真实 NHK 输入后自动解锁'}</span>
        </div>
        <ChevronRight size={18} />
      </button>

"""
    page = replace_once(
        page,
        "      <NhkWeeklyEvidence sessions={sessions} todayKey={todayKey} />",
        launcher + "      <NhkWeeklyEvidence sessions={sessions} todayKey={todayKey} />",
        'boss home launcher',
    )
write(page_path, page)

css_path = 'src/nhkMorning.css'
css = read(css_path)
marker = '/* nhk-weekly-boss-v1 */'
if marker not in css:
    css += r'''

/* nhk-weekly-boss-v1 */
.nhk-weekly-boss-launch{width:100%;border:1px solid #dfe3da;background:#f3f4f0;border-radius:20px;min-height:76px;margin-top:11px;padding:12px 13px;display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:10px;text-align:left;color:#657068}.nhk-weekly-boss-launch.ready{background:#17221c;color:#fff;border-color:#17221c}.nhk-weekly-boss-launch.done{background:#314a38}.nhk-weekly-boss-launch:disabled{opacity:.72}.nhk-weekly-boss-launch>svg:first-child{color:#829071}.nhk-weekly-boss-launch.ready>svg:first-child{color:#dff08a}.nhk-weekly-boss-launch>div{display:grid;gap:3px}.nhk-weekly-boss-launch small{font-size:8px;color:#88928b;font-weight:900}.nhk-weekly-boss-launch.ready small{color:#b9c7bd}.nhk-weekly-boss-launch strong{font-size:12px;line-height:1.45}.nhk-weekly-boss-launch span{font-size:8px;line-height:1.45;color:#909991}.nhk-weekly-boss-launch.ready span{color:#d4ddd6}.nhk-boss-progress{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:0 5px 13px}.nhk-boss-progress i{height:5px;border-radius:999px;background:#e1e5de}.nhk-boss-progress i.active{background:#718f43}.nhk-boss-card,.nhk-boss-result,.nhk-boss-empty{border:1px solid #e0e4dc;border-radius:24px;background:#fff;padding:17px;box-shadow:0 12px 28px #17221c0b}.nhk-boss-meta{display:flex;justify-content:space-between;align-items:center;gap:8px}.nhk-boss-meta>span{border-radius:999px;background:#17221c;color:#dff08a;padding:5px 8px;font-size:8px;font-weight:900}.nhk-boss-meta>small{font-size:8px;line-height:1.45;color:#849087;text-align:right}.nhk-boss-card>h1,.nhk-boss-result>h1,.nhk-boss-empty>h1{font-size:20px;line-height:1.45;margin:12px 0 6px}.nhk-boss-card>p,.nhk-boss-result>p,.nhk-boss-empty>p{font-size:9px;line-height:1.65;color:#69746c;margin:0}.nhk-boss-reveal{margin-top:10px;border-radius:15px;background:#f6eee9;padding:10px;display:grid;gap:3px}.nhk-boss-reveal.passed{background:#eef4dc}.nhk-boss-reveal small{font-size:8px;color:#7c887f}.nhk-boss-reveal strong{font-size:12px;line-height:1.55}.nhk-boss-reveal span{font-size:7px;color:#929a94}.nhk-boss-recovery-note{margin-top:9px;display:flex;align-items:center;gap:5px;color:#8a5d52;font-size:8px}.nhk-boss-result{text-align:center}.nhk-boss-result-icon{width:54px;height:54px;border-radius:18px;background:#dff08a;color:#17221c;display:grid;place-items:center;margin:0 auto}.nhk-boss-result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:13px}.nhk-boss-result-grid span{border-radius:13px;background:#f1f3ef;padding:9px;display:grid;gap:2px}.nhk-boss-result-grid small{font-size:7px;color:#828d85}.nhk-boss-result-grid strong{font-size:18px}.nhk-boss-weak{margin-top:10px;border-radius:15px;background:#f8efeb;padding:10px;display:grid;gap:5px;text-align:left}.nhk-boss-weak>small{font-size:8px;color:#8d675e}.nhk-boss-weak>strong{font-size:10px;line-height:1.5}.nhk-boss-empty{text-align:center}.nhk-boss-empty>svg{color:#718f43}
'''
write(css_path, css)

assert "type PageView = 'home' | 'today' | 'recall' | 'world' | 'boss';" in read(page_path)
assert 'nhk-weekly-boss-launch' in read(page_path)
assert 'NHK_WEEKLY_BOSS_VERSION' in read(component_path)
assert marker in read(css_path)
