from pathlib import Path


def replace_one(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


page = Path('src/NhkMorningPage.tsx')
replace_one(
    page,
    "  Sparkles,\n} from 'lucide-react';",
    "  Sparkles,\n  TrendingUp,\n} from 'lucide-react';",
    'evidence icon import',
)
replace_one(
    page,
    "import type {Story} from './content';\nimport NhkWorldEvent, {type NhkWorldEventMode} from './NhkWorldEvent';",
    "import type {Story} from './content';\nimport NhkEvidencePage from './NhkEvidencePage';\nimport {buildNhkWeeklyEvidence} from './nhkEvidence';\nimport NhkWorldEvent, {type NhkWorldEventMode} from './NhkWorldEvent';",
    'evidence imports',
)
replace_one(
    page,
    "type PageView = 'home' | 'today' | 'recall' | 'world';",
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'evidence';",
    'evidence view type',
)
replace_one(
    page,
    "  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);\n  const recent = useMemo(() => sessions.filter(session => session.completedAt).slice(0, 3), [sessions]);",
    "  const streak = useMemo(() => completedNhkStreak(sessions, todayKey), [sessions, todayKey]);\n  const evidence = useMemo(() => buildNhkWeeklyEvidence(sessions, todayKey), [sessions, todayKey]);\n  const recent = useMemo(() => sessions.filter(session => session.completedAt).slice(0, 3), [sessions]);",
    'evidence memo',
)
replace_one(
    page,
    "  if (view === 'world' && activeWorldSession?.dailyInput) {",
    "  if (view === 'evidence') {\n    return <NhkEvidencePage evidence={evidence} onBack={() => setView('home')} />;\n  }\n\n  if (view === 'world' && activeWorldSession?.dailyInput) {",
    'evidence page render',
)
replace_one(
    page,
    "      </button>\n\n      <button className=\"nhk-share-card\" onClick={() => setShowShareHelp(value => !value)}>",
    "      </button>\n\n      <button className=\"nhk-evidence-card\" onClick={() => setView('evidence')}>\n        <TrendingUp size={19} />\n        <div>\n          <small>本周证据 · {evidence.periodLabel}</small>\n          <strong>{evidence.headlineZh}</strong>\n          <span>{evidence.completedInputs} 篇真实输入 · {evidence.analyzedResponses} 次语音分析</span>\n        </div>\n        <ChevronRight size={18} />\n      </button>\n\n      <button className=\"nhk-share-card\" onClick={() => setShowShareHelp(value => !value)}>",
    'evidence home card',
)

css = Path('src/nhkMorning.css')
css_text = css.read_text(encoding='utf-8')
if '.nhk-evidence-card{' not in css_text:
    css_text += """

.nhk-evidence-card{width:100%;border:1px solid #dce5c9;background:#f4f7e9;border-radius:19px;min-height:76px;margin-top:9px;padding:11px 13px;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:9px;text-align:left;color:#2f3f35}.nhk-evidence-card>svg:first-child{color:#607d35}.nhk-evidence-card>div{display:grid;gap:3px}.nhk-evidence-card small{font-size:8px;color:#79857c}.nhk-evidence-card strong{font-size:11px;line-height:1.45}.nhk-evidence-card span{font-size:8px;color:#7c877f}.nhk-evidence-page{padding-bottom:30px}.nhk-evidence-hero{border-radius:24px;background:#17221c;color:#fff;padding:17px;box-shadow:0 14px 30px #17221c1b}.nhk-evidence-hero>div{display:flex;align-items:center;gap:7px;color:#dff08a}.nhk-evidence-hero>div small{font-size:8px;font-weight:900;letter-spacing:.4px}.nhk-evidence-hero h1{font-size:20px;line-height:1.45;letter-spacing:-.3px;margin:13px 0 6px}.nhk-evidence-hero p{font-size:9px;line-height:1.6;color:#c6d0c8;margin:0}.nhk-evidence-week-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px}.nhk-evidence-week-grid>div{min-height:88px;border:1px solid #e0e4dd;border-radius:17px;background:#fff;padding:11px 9px;display:grid;align-content:center;gap:3px;text-align:center}.nhk-evidence-week-grid small{font-size:8px;color:#7d887f}.nhk-evidence-week-grid strong{font-size:18px;line-height:1.2;color:#2f3d34}.nhk-evidence-week-grid span{font-size:7px;color:#929a94;line-height:1.4}.nhk-evidence-section{margin-top:14px;border:1px solid #e0e4dd;border-radius:21px;background:#fff;padding:14px}.nhk-evidence-title{display:flex;align-items:center;gap:8px}.nhk-evidence-title>svg{color:#607d35}.nhk-evidence-title>div{display:grid;gap:2px}.nhk-evidence-title strong{font-size:12px}.nhk-evidence-title small{font-size:8px;color:#89928c}.nhk-evidence-metrics{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.nhk-evidence-metric{min-height:94px;border-radius:16px;background:#f3f5ef;padding:11px;display:grid;align-content:center;gap:4px}.nhk-evidence-metric:last-child:nth-child(odd){grid-column:1/-1}.nhk-evidence-metric small{font-size:8px;color:#78847c}.nhk-evidence-metric strong{font-size:20px;line-height:1.2}.nhk-evidence-metric span{font-size:8px;color:#8b948e;line-height:1.4}.nhk-evidence-comparisons{display:grid;gap:7px;margin-top:11px}.nhk-evidence-comparisons>div{border-radius:14px;background:#f5f6f2;padding:10px;display:grid;grid-template-columns:minmax(90px,1fr) auto 12px auto auto;align-items:center;gap:6px}.nhk-evidence-comparisons>div>div{display:grid;gap:2px;min-width:0}.nhk-evidence-comparisons>div>div strong{font-size:9px}.nhk-evidence-comparisons>div>div small{font-size:7px;color:#8a938c}.nhk-evidence-comparisons span,.nhk-evidence-comparisons b{font-size:9px;white-space:nowrap}.nhk-evidence-comparisons i{font-style:normal;font-size:9px;color:#949b96}.nhk-evidence-comparisons em{border-radius:999px;padding:4px 6px;font-style:normal;font-size:7px;white-space:nowrap}.nhk-evidence-comparisons em.better{background:#e3efc9;color:#52702f}.nhk-evidence-comparisons em.worse{background:#f6e8e4;color:#8d5048}.nhk-evidence-comparisons em.same{background:#e9ece7;color:#6f7972}.nhk-evidence-empty{margin-top:11px;border-radius:16px;background:#f4f6f0;padding:14px;text-align:center}.nhk-evidence-empty svg{color:#718f43}.nhk-evidence-empty strong{display:block;font-size:11px;margin-top:5px}.nhk-evidence-empty p{font-size:8px;line-height:1.55;color:#7c867f;margin:5px 0 0}.nhk-recall-evidence{display:grid;gap:10px;margin-top:12px}.nhk-recall-evidence>div{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:7px}.nhk-recall-evidence>div>span{font-size:9px;font-weight:900}.nhk-recall-evidence>div>div{height:8px;border-radius:99px;background:#e7eae3;overflow:hidden}.nhk-recall-evidence>div>div i{display:block;height:100%;border-radius:inherit;background:#718f43}.nhk-recall-evidence>div>strong{font-size:9px;min-width:54px;text-align:right}.nhk-recall-evidence>div>small{grid-column:2/4;font-size:7px;color:#89928c;margin-top:-4px}.nhk-evidence-privacy{margin-top:12px;border-radius:17px;background:#eef4dc;padding:12px;display:grid;grid-template-columns:22px 1fr;gap:7px;color:#42503f}.nhk-evidence-privacy>svg{color:#607d35}.nhk-evidence-privacy p{display:grid;gap:3px;margin:0}.nhk-evidence-privacy strong{font-size:9px}.nhk-evidence-privacy span{font-size:8px;line-height:1.55;color:#697568}@media(max-width:360px){.nhk-evidence-comparisons>div{grid-template-columns:minmax(80px,1fr) auto 10px auto}.nhk-evidence-comparisons em{grid-column:2/5;justify-self:end}.nhk-evidence-week-grid strong{font-size:16px}}
"""
css.write_text(css_text, encoding='utf-8')
