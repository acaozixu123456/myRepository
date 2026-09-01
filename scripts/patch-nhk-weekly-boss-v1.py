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
    "  TrendingUp,\n} from 'lucide-react';",
    "  TrendingUp,\n  Trophy,\n} from 'lucide-react';",
    'Boss icon import',
)
replace_one(
    page,
    "import type {Story} from './content';\nimport NhkEvidencePage from './NhkEvidencePage';",
    "import type {Story} from './content';\nimport NhkBossPage from './NhkBossPage';\nimport {\n  buildNhkBossCandidate,\n  createNhkBossSession,\n  findNhkBossSession,\n  loadNhkBossSessions,\n  saveNhkBossSessions,\n  upsertNhkBossSession,\n  type NhkBossSession,\n} from './nhkBoss';\nimport NhkEvidencePage from './NhkEvidencePage';",
    'Boss module imports',
)
replace_one(
    page,
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'evidence';",
    "type PageView = 'home' | 'today' | 'recall' | 'world' | 'evidence' | 'boss';",
    'Boss page view',
)
replace_one(
    page,
    "  const [sessions, setSessions] = useState<NhkMorningSession[]>(() => loadNhkSessions());\n  const [draft, setDraft]",
    "  const [sessions, setSessions] = useState<NhkMorningSession[]>(() => loadNhkSessions());\n  const [bossSessions, setBossSessions] = useState<NhkBossSession[]>(() => loadNhkBossSessions());\n  const [activeBossId, setActiveBossId] = useState('');\n  const [draft, setDraft]",
    'Boss session state',
)
replace_one(
    page,
    "  useEffect(() => saveNhkSessions(sessions), [sessions]);\n",
    "  useEffect(() => saveNhkSessions(sessions), [sessions]);\n  useEffect(() => saveNhkBossSessions(bossSessions), [bossSessions]);\n",
    'Boss persistence effect',
)
replace_one(
    page,
    "  const evidence = useMemo(() => buildNhkWeeklyEvidence(sessions, todayKey), [sessions, todayKey]);\n  const recent = useMemo",
    "  const evidence = useMemo(() => buildNhkWeeklyEvidence(sessions, todayKey), [sessions, todayKey]);\n  const bossCandidate = useMemo(() => buildNhkBossCandidate(sessions, todayKey), [sessions, todayKey]);\n  const weeklyBoss = useMemo(\n    () => findNhkBossSession(bossSessions, bossCandidate.weekKey),\n    [bossSessions, bossCandidate.weekKey],\n  );\n  const activeBoss = useMemo(\n    () => bossSessions.find(session => session.id === activeBossId) || null,\n    [bossSessions, activeBossId],\n  );\n  const bossProgress = weeklyBoss?.turns.filter(turn => turn.completedAt).length || 0;\n  const recent = useMemo",
    'Boss derived state',
)
replace_one(
    page,
    "  const persistWorldSession = (next: NhkMorningSession) => {",
    "  const persistBossSession = (next: NhkBossSession) => {\n    setBossSessions(current => upsertNhkBossSession(current, next));\n  };\n\n  const openBoss = () => {\n    const next = weeklyBoss || (bossCandidate.eligible ? createNhkBossSession(bossCandidate, sessions) : null);\n    if (!next) return;\n    persistBossSession(next);\n    setActiveBossId(next.id);\n    setView('boss');\n  };\n\n  const closeBoss = () => {\n    setActiveBossId('');\n    setView('home');\n  };\n\n  const persistWorldSession = (next: NhkMorningSession) => {",
    'Boss handlers',
)
replace_one(
    page,
    "  if (view === 'evidence') {\n    return <NhkEvidencePage evidence={evidence} onBack={() => setView('home')} />;\n  }",
    "  if (view === 'boss' && activeBoss) {\n    return <NhkBossPage session={activeBoss} onBack={closeBoss} onUpdate={persistBossSession} />;\n  }\n\n  if (view === 'evidence') {\n    return <NhkEvidencePage evidence={evidence} onBack={() => setView('home')} />;\n  }",
    'Boss render',
)
replace_one(
    page,
    "      <button className=\"nhk-share-card\" onClick={() => setShowShareHelp(value => !value)}>",
    "      {(bossCandidate.expressions.length > 0 || weeklyBoss) && (\n        <button\n          className={`nhk-boss-card ${weeklyBoss?.outcome ? 'complete' : weeklyBoss || bossCandidate.eligible ? 'ready' : 'locked'}`}\n          disabled={!weeklyBoss && !bossCandidate.eligible}\n          onClick={openBoss}\n        >\n          <Trophy size={19} />\n          <div>\n            <small>{weeklyBoss?.outcome\n              ? 'WEEKLY BOSS COMPLETE'\n              : weeklyBoss\n                ? `WEEKLY BOSS · ${bossProgress}/5`\n                : bossCandidate.eligible\n                  ? 'WEEKLY BOSS READY'\n                  : `还差 ${Math.max(0, bossCandidate.requiredExpressionCount - bossCandidate.expressions.length)} 个表达`}\n            </small>\n            <strong>{weeklyBoss?.outcome\n              ? '本周五轮对话已完成'\n              : weeklyBoss\n                ? '继续没有选项的五轮对话'\n                : bossCandidate.eligible\n                  ? '把本周表达混进一次真实对话'\n                  : '收集 5 个本周表达后解锁'}\n            </strong>\n            <span>{weeklyBoss?.outcome\n              ? `成功使用 ${weeklyBoss.outcome.usedExpressionCount}/5 个表达`\n              : weeklyBoss\n                ? '回答会改变田中的下一轮追问'\n                : bossCandidate.eligible\n                  ? '日常 · 礼貌 · 工作 · 约 3 分钟'\n                  : `${bossCandidate.expressions.length}/${bossCandidate.requiredExpressionCount} 个表达`}\n            </span>\n          </div>\n          <ChevronRight size={18} />\n        </button>\n      )}\n\n      <button className=\"nhk-share-card\" onClick={() => setShowShareHelp(value => !value)}>",
    'Boss home card',
)

css = Path('src/nhkMorning.css')
css_text = css.read_text(encoding='utf-8')
if '.nhk-boss-card{' not in css_text:
    css_text += """

.nhk-boss-card{width:100%;border:1px solid #dddfd6;background:#fff;border-radius:19px;min-height:78px;margin-top:9px;padding:11px 13px;display:grid;grid-template-columns:35px 1fr auto;align-items:center;gap:9px;text-align:left;color:#2f3f35}.nhk-boss-card>svg:first-child{color:#7c6b29}.nhk-boss-card>div{display:grid;gap:3px}.nhk-boss-card small{font-size:8px;color:#8b7a3d;font-weight:900;letter-spacing:.3px}.nhk-boss-card strong{font-size:12px;line-height:1.45}.nhk-boss-card span{font-size:8px;line-height:1.4;color:#828b84}.nhk-boss-card.ready{background:#fff8dd;border-color:#eadb99}.nhk-boss-card.complete{background:#edf4da;border-color:#d4e0b6}.nhk-boss-card.complete>svg:first-child{color:#5f7739}.nhk-boss-card.locked{background:#f4f5f1;color:#68736c}.nhk-boss-card.locked>svg:first-child{color:#9a9e96}.nhk-boss-card:disabled{opacity:.72}.nhk-boss-page{padding-bottom:30px}.nhk-boss-progress{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:0 5px 13px}.nhk-boss-progress i{height:6px;border-radius:99px;background:#e1e4de}.nhk-boss-progress i.current{background:#d7bd58}.nhk-boss-progress i.done{background:#718f43}.nhk-boss-stage{border:1px solid #e1e4dd;border-radius:25px;background:#fff;padding:16px;box-shadow:0 12px 28px #17221c0b}.nhk-boss-intro{border-radius:17px;background:#fff8dd;padding:12px;display:grid;gap:4px}.nhk-boss-intro>span{display:flex;align-items:center;gap:5px;font-size:8px;color:#7a6726;font-weight:900}.nhk-boss-intro strong{font-size:11px;line-height:1.5}.nhk-boss-intro small{font-size:8px;line-height:1.45;color:#847d65}.nhk-boss-sources{margin-top:10px}.nhk-boss-sources>small{font-size:8px;color:#838d86}.nhk-boss-sources>div{display:flex;gap:5px;overflow:auto;margin-top:5px;padding-bottom:2px}.nhk-boss-sources span{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:#f0f2ec;padding:5px 8px;font-size:7px;color:#667169}.nhk-boss-turn{margin-top:11px;border-radius:20px;background:#17221c;color:#fff;padding:15px}.nhk-boss-turn>span{display:inline-flex;border-radius:999px;background:#dff08a;color:#17221c;padding:4px 8px;font-size:7px;font-weight:900}.nhk-boss-turn h1{font-size:18px;line-height:1.45;margin:11px 0 7px}.nhk-boss-turn blockquote{margin:0;border-left:3px solid #dff08a;border-radius:10px;background:#ffffff0d;padding:10px;font-size:11px;line-height:1.65}.nhk-boss-turn>small{display:block;margin-top:9px;color:#aeb9b0;font-size:8px;line-height:1.45}.nhk-boss-turn.nhk-boss-polite{background:#33462d}.nhk-boss-turn.nhk-boss-work{background:#263b45}.nhk-boss-hidden-target{margin-top:10px;border-radius:16px;background:#fff8dd;padding:12px;display:grid;gap:4px}.nhk-boss-hidden-target small{font-size:8px;color:#84742f}.nhk-boss-hidden-target strong{font-size:13px;line-height:1.55}.nhk-boss-hidden-target span{font-size:8px;line-height:1.5;color:#756d53}.nhk-boss-next{width:100%;min-height:49px;border:0;border-radius:15px;background:#17221c;color:#dff08a;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;font-weight:900}.nhk-boss-next.complete{background:#dff08a;color:#17221c}.nhk-boss-counter{text-align:center;margin-top:10px;color:#8b948d;font-size:8px}.nhk-boss-counter span{color:#4f6338;font-weight:900}.nhk-boss-complete{border-radius:25px;background:#17221c;color:#fff;padding:19px;text-align:center;box-shadow:0 16px 36px #17221c1d}.nhk-boss-trophy{width:58px;height:58px;border-radius:20px;background:#dff08a;color:#17221c;display:grid;place-items:center;margin:0 auto 10px}.nhk-boss-complete>span{font-size:8px;color:#d7c66e;font-weight:900;letter-spacing:.8px}.nhk-boss-complete>h1{font-size:20px;line-height:1.45;margin:10px 0 15px}.nhk-boss-result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.nhk-boss-result-grid>div{border-radius:14px;background:#ffffff0c;padding:10px 5px;display:grid;gap:4px}.nhk-boss-result-grid small{font-size:7px;color:#aeb9b0;line-height:1.4}.nhk-boss-result-grid strong{font-size:15px;color:#dff08a}.nhk-boss-final-reaction,.nhk-boss-next-week{margin-top:10px;border-radius:16px;padding:12px;display:grid;grid-template-columns:23px 1fr;gap:8px;text-align:left}.nhk-boss-final-reaction{background:#ffffff0d}.nhk-boss-next-week{background:#dff08a;color:#17221c}.nhk-boss-final-reaction>svg{color:#dff08a}.nhk-boss-final-reaction>div,.nhk-boss-next-week>div{display:grid;gap:4px}.nhk-boss-final-reaction small,.nhk-boss-next-week small{font-size:8px;color:#aeb9b0}.nhk-boss-next-week small{color:#64743d}.nhk-boss-final-reaction strong,.nhk-boss-next-week strong{font-size:10px;line-height:1.55}.nhk-boss-final-reaction p{font-size:8px;line-height:1.5;color:#c8d1ca;margin:0}.nhk-boss-back{width:100%;min-height:48px;border:1px solid #ffffff24;border-radius:14px;background:transparent;color:#fff;margin-top:13px;font-size:9px;font-weight:900}@media(max-width:360px){.nhk-boss-result-grid{grid-template-columns:1fr}.nhk-boss-result-grid>div{grid-template-columns:1fr auto;align-items:center;text-align:left}.nhk-boss-result-grid strong{font-size:14px}}
"""
css.write_text(css_text, encoding='utf-8')
