from pathlib import Path

page_path = Path('src/NhkMorningPage.tsx')
css_path = Path('src/nhkMorning.css')
page = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


page = replace_once(
    page,
    "import EpisodeVisual from './EpisodeVisual';\n",
    "import EpisodeVisual from './EpisodeVisual';\n"
    "import NhkEntryEvidence from './NhkEntryEvidence';\n"
    "import {\n"
    "  patchNhkEntryMetric,\n"
    "  readCachedMojiArticle,\n"
    "  startNhkEntryMetric,\n"
    "  writeCachedMojiArticle,\n"
    "} from './nhkEntryCost';\n",
    'entry imports',
)

page = replace_once(
    page,
    "  const [shareCopyStatus, setShareCopyStatus] = useState('');\n",
    "  const [shareCopyStatus, setShareCopyStatus] = useState('');\n"
    "  const [parseMeta, setParseMeta] = useState<{source: 'network' | 'local-cache'; ms: number} | null>(null);\n",
    'parse meta state',
)

page = replace_once(
    page,
    "  const sharedHandledRef = useRef('');\n",
    "  const sharedHandledRef = useRef('');\n"
    "  const entryMetricRef = useRef<{id: string; startedAt: number} | null>(null);\n",
    'entry metric ref',
)

load_start = page.index('  const loadCoach = async (')
open_today = page.index('  const openToday = () => {', load_start)
load_section = page[load_start:open_today]
load_section = replace_once(
    load_section,
    "    const request = ++coachRequestRef.current;\n",
    "    const request = ++coachRequestRef.current;\n"
    "    const coachStartedAt = performance.now();\n",
    'coach timer start',
)
load_section = replace_once(
    load_section,
    "      persist(applyCoachFields(baseSession, fallback, recommended, sentences, 'local-fallback'));\n",
    "      persist(applyCoachFields(baseSession, fallback, recommended, sentences, 'local-fallback'));\n"
    "      const metric = entryMetricRef.current;\n"
    "      if (metric?.id) patchNhkEntryMetric(metric.id, {readyMs: Math.round(performance.now() - metric.startedAt)});\n",
    'fallback ready metric',
)
load_section = replace_once(
    load_section,
    "      setCoachStatus('ready');\n",
    "      setCoachStatus('ready');\n"
    "      const metric = entryMetricRef.current;\n"
    "      if (metric?.id) patchNhkEntryMetric(metric.id, {\n"
    "        coachMs: Math.round(performance.now() - coachStartedAt),\n"
    "        readyMs: Math.round(performance.now() - metric.startedAt),\n"
    "      });\n",
    'generated coach metric',
)
load_section = replace_once(
    load_section,
    "      setCoachStatus('fallback');\n",
    "      setCoachStatus('fallback');\n"
    "      const metric = entryMetricRef.current;\n"
    "      if (metric?.id) patchNhkEntryMetric(metric.id, {\n"
    "        coachMs: Math.round(performance.now() - coachStartedAt),\n"
    "        readyMs: Math.round(performance.now() - metric.startedAt),\n"
    "      });\n",
    'fallback coach metric',
)
page = page[:load_start] + load_section + page[open_today:]

parse_start = page.index('  const parseArticle = async (')
paste_start = page.index('  const pasteAndParse = (', parse_start)
parse_section = page[parse_start:paste_start]
parse_section = replace_once(
    parse_section,
    "    const request = ++parseRequestRef.current;\n",
    "    const metricStartedAt = performance.now();\n"
    "    const metricId = startNhkEntryMetric(sourceUrl, todayKey);\n"
    "    entryMetricRef.current = {id: metricId, startedAt: metricStartedAt};\n"
    "    setParseMeta(null);\n\n"
    "    const request = ++parseRequestRef.current;\n",
    'parse timer start',
)
parse_section = replace_once(
    parse_section,
    "    setParseStatus('loading');\n    setParseError('');\n\n    try {\n",
    "    setParseStatus('loading');\n"
    "    setParseError('');\n\n"
    "    const cachedArticle = readCachedMojiArticle(sourceUrl);\n"
    "    if (cachedArticle) {\n"
    "      const parseMs = Math.round(performance.now() - metricStartedAt);\n"
    "      const next = {\n"
    "        ...cleanSession,\n"
    "        sourceUrl: cachedArticle.sourceUrl,\n"
    "        title: cachedArticle.title,\n"
    "      };\n"
    "      persist(next);\n"
    "      setArticleSentences(cachedArticle.sentences);\n"
    "      setParseStatus('ready');\n"
    "      setParseMeta({source: 'local-cache', ms: parseMs});\n"
    "      patchNhkEntryMetric(metricId, {parseSource: 'local-cache', parseMs});\n"
    "      void loadCoach(cachedArticle.title, cachedArticle.sentences, next, true);\n"
    "      return;\n"
    "    }\n\n"
    "    try {\n",
    'local cache fast path',
)
parse_section = replace_once(
    parse_section,
    "      const next = {\n        ...cleanSession,\n        sourceUrl: data.sourceUrl || sourceUrl,\n        title: data.title,\n      };\n      persist(next);\n      setArticleSentences(data.sentences);\n      setParseStatus('ready');\n      void loadCoach(data.title, data.sentences, next, true);\n",
    "      const resolvedSourceUrl = data.sourceUrl || sourceUrl;\n"
    "      const parseMs = Math.round(performance.now() - metricStartedAt);\n"
    "      writeCachedMojiArticle({\n"
    "        sourceUrl: resolvedSourceUrl,\n"
    "        title: data.title,\n"
    "        sentences: data.sentences,\n"
    "      });\n"
    "      const next = {\n"
    "        ...cleanSession,\n"
    "        sourceUrl: resolvedSourceUrl,\n"
    "        title: data.title,\n"
    "      };\n"
    "      persist(next);\n"
    "      setArticleSentences(data.sentences);\n"
    "      setParseStatus('ready');\n"
    "      setParseMeta({source: 'network', ms: parseMs});\n"
    "      patchNhkEntryMetric(metricId, {parseSource: 'network', parseMs});\n"
    "      void loadCoach(data.title, data.sentences, next, true);\n",
    'network cache write',
)
page = page[:parse_start] + parse_section + page[paste_start:]

page = replace_once(
    page,
    "  const completeToday = () => {\n    const next = markNhkDailyInputUsedInWorld({...draftRef.current, completedAt: Date.now()});\n    persist(next);\n    setView('home');\n  };\n",
    "  const completeToday = () => {\n"
    "    const completedAt = Date.now();\n"
    "    const next = markNhkDailyInputUsedInWorld({...draftRef.current, completedAt});\n"
    "    const metric = entryMetricRef.current;\n"
    "    if (metric?.id) patchNhkEntryMetric(metric.id, {\n"
    "      completedMs: Math.max(0, Math.round(performance.now() - metric.startedAt)),\n"
    "      completedAt,\n"
    "    });\n"
    "    persist(next);\n"
    "    setView('home');\n"
    "  };\n",
    'completion metric',
)

page = replace_once(
    page,
    "                </div>\n\n                {coach && (\n",
    "                </div>\n"
    "                {parseMeta && (\n"
    "                  <div className=\"nhk-entry-cache-note\">\n"
    "                    {parseMeta.source === 'local-cache' ? '已从本机缓存恢复' : '已保存到本机缓存'}\n"
    "                    <span>{(parseMeta.ms / 1000).toFixed(parseMeta.ms < 10_000 ? 1 : 0)}秒</span>\n"
    "                  </div>\n"
    "                )}\n\n"
    "                {coach && (\n",
    'cache note ui',
)

page = replace_once(
    page,
    "      {recent.length > 0 && (\n",
    "      <NhkEntryEvidence />\n\n"
    "      {recent.length > 0 && (\n",
    'entry evidence ui',
)

css_addition = """
.nhk-entry-cache-note{margin:7px 2px 0;display:flex;align-items:center;justify-content:space-between;color:#718051;font-size:8px}.nhk-entry-cache-note span{font-weight:900;color:#455a35}
.nhk-entry-evidence{margin-top:12px;border:1px solid #dce5c9;border-radius:20px;background:#f7f9f0;padding:13px;color:#344139}.nhk-entry-evidence-head{display:flex;align-items:center;justify-content:space-between}.nhk-entry-evidence-head>div{display:flex;align-items:center;gap:7px}.nhk-entry-evidence-head svg{color:#607d35}.nhk-entry-evidence-head strong{font-size:11px}.nhk-entry-evidence-head small{font-size:8px;color:#899282}.nhk-entry-evidence-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.nhk-entry-evidence-grid>div{border-radius:13px;background:#fff;padding:9px 7px;display:grid;gap:4px}.nhk-entry-evidence-grid span{font-size:7px;color:#899187}.nhk-entry-evidence-grid strong{font-size:12px}.nhk-entry-evidence>p{display:flex;align-items:center;gap:5px;margin:9px 1px 0;color:#788176;font-size:7px;line-height:1.5}
"""
if '.nhk-entry-evidence{' not in css:
    css = css.rstrip() + '\n' + css_addition.lstrip()

page_path.write_text(page, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
