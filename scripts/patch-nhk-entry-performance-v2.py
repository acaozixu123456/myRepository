from pathlib import Path
import re


def replace_one(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def sub_one(path: Path, pattern: str, replacement: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    path.write_text(updated, encoding='utf-8')


# Restrict cache writes to a server-only service-role key while keeping reads fail-soft.
cache = Path('src/nhkArticleCache.ts')
replace_one(
    cache,
    "const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmVic2pzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';",
    "const SUPABASE_READ_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmVic2pzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';\nconst SUPABASE_WRITE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';",
    'cache credentials',
)
replace_one(
    cache,
    "const rpc = async (name: string, body: unknown): Promise<unknown> => {\n  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {\n    method: 'POST',\n    headers: {\n      apikey: SUPABASE_ANON_KEY,\n      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,",
    "const rpc = async (name: string, body: unknown, apiKey: string): Promise<unknown> => {\n  if (!apiKey) throw new Error(`cache_rpc_${name}_not_configured`);\n  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {\n    method: 'POST',\n    headers: {\n      apikey: apiKey,\n      Authorization: `Bearer ${apiKey}`,",
    'cache RPC key',
)
replace_one(
    cache,
    "    const value = await rpc('get_nihongo_article_cache', {\n      p_article_id: articleId,\n      p_parser_version: MOJI_PARSER_VERSION,\n    });",
    "    const value = await rpc('get_nihongo_article_cache', {\n      p_article_id: articleId,\n      p_parser_version: MOJI_PARSER_VERSION,\n    }, SUPABASE_READ_KEY);",
    'cache read key',
)
replace_one(
    cache,
    "  try {\n    const value = await rpc('put_nihongo_article_cache', {\n      p_article_id: articleId,\n      p_source_url: canonicalMojiArticleUrl(articleId),\n      p_parser_version: MOJI_PARSER_VERSION,\n      p_payload: payload,\n      p_ttl_hours: 720,\n    });",
    "  if (!SUPABASE_WRITE_KEY) return false;\n  try {\n    const value = await rpc('put_nihongo_article_cache', {\n      p_article_id: articleId,\n      p_source_url: canonicalMojiArticleUrl(articleId),\n      p_parser_version: MOJI_PARSER_VERSION,\n      p_payload: payload,\n      p_ttl_hours: 720,\n    }, SUPABASE_WRITE_KEY);",
    'cache write key',
)

migration = Path('supabase/migrations/20260901043000_add_nihongo_article_cache.sql')
replace_one(
    migration,
    "grant execute on function public.put_nihongo_article_cache(text, text, text, jsonb, integer) to anon, authenticated, service_role;",
    "revoke execute on function public.put_nihongo_article_cache(text, text, text, jsonb, integer) from anon, authenticated;\ngrant execute on function public.put_nihongo_article_cache(text, text, text, jsonb, integer) to service_role;",
    'cache write grant',
)

# Persist flow timing in each local morning session.
morning = Path('src/nhkMorning.ts')
replace_one(
    morning,
    "import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';",
    "import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';\nimport {normalizeNhkFlowPerformance, type NhkFlowPerformance} from './nhkPerformance';",
    'performance import',
)
replace_one(
    morning,
    "  worldRecordingSeconds: number;\n  speechFallback: boolean;",
    "  worldRecordingSeconds: number;\n  performance: NhkFlowPerformance;\n  speechFallback: boolean;",
    'session performance field',
)
replace_one(
    morning,
    "  worldRecordingSeconds: 0,\n  speechFallback: false,",
    "  worldRecordingSeconds: 0,\n  performance: {},\n  speechFallback: false,",
    'session performance default',
)
replace_one(
    morning,
    "    worldRecordingSeconds: Number(session.worldRecordingSeconds) || 0,\n    speechFallback: Boolean(session.speechFallback),",
    "    worldRecordingSeconds: Number(session.worldRecordingSeconds) || 0,\n    performance: normalizeNhkFlowPerformance(session.performance),\n    speechFallback: Boolean(session.speechFallback),",
    'session performance migration',
)

page = Path('src/NhkMorningPage.tsx')
replace_one(
    page,
    "import {api} from './api';",
    "import {api} from './api';\nimport {\n  recordNhkCoachPerformance,\n  recordNhkFirstTraining,\n  recordNhkParsePerformance,\n  recordNhkSessionCompletion,\n  startNhkFlowPerformance,\n} from './nhkPerformance';",
    'page performance imports',
)
replace_one(
    page,
    "type MojiArticleResponse = {\n  ok?: boolean;\n  sourceUrl?: string;\n  title?: string;\n  sentences?: string[];\n  reason?: string;\n};",
    "type MojiArticleResponse = {\n  ok?: boolean;\n  sourceUrl?: string;\n  title?: string;\n  sentences?: string[];\n  cached?: boolean;\n  timingMs?: {totalMs?: number};\n  reason?: string;\n};",
    'parser timing response',
)
replace_one(
    page,
    "  worldRecordingSeconds: 0,\n  speechFallback: false,",
    "  worldRecordingSeconds: 0,\n  performance: {},\n  speechFallback: false,",
    'reset performance',
)
replace_one(
    page,
    "    const request = ++coachRequestRef.current;\n    const fallback = buildFallbackCoach(title, sentences);",
    "    const request = ++coachRequestRef.current;\n    const coachStartedAt = Date.now();\n    const fallback = buildFallbackCoach(title, sentences);",
    'coach start timing',
)
replace_one(
    page,
    "    } catch {\n      if (request !== coachRequestRef.current) return;\n      setCoach(fallback);\n      setCoachStatus('fallback');\n    }\n  };",
    "    } catch {\n      if (request !== coachRequestRef.current) return;\n      setCoach(fallback);\n      setCoachStatus('fallback');\n    } finally {\n      if (request === coachRequestRef.current) {\n        const completedAt = Date.now();\n        persist({\n          ...draftRef.current,\n          performance: recordNhkCoachPerformance(\n            draftRef.current.performance,\n            completedAt - coachStartedAt,\n            completedAt,\n          ),\n        });\n      }\n    }\n  };",
    'coach completion timing',
)
replace_one(
    page,
    "    const request = ++parseRequestRef.current;\n    coachRequestRef.current += 1;",
    "    const flowStartedAt = Date.now();\n    const request = ++parseRequestRef.current;\n    coachRequestRef.current += 1;",
    'parse start timing',
)
replace_one(
    page,
    "    const cleanSession = resetSessionForSource(baseSession, sourceUrl);",
    "    const cleanSession = {\n      ...resetSessionForSource(baseSession, sourceUrl),\n      performance: startNhkFlowPerformance(flowStartedAt),\n    };",
    'start flow performance',
)
replace_one(
    page,
    "      const next = {\n        ...cleanSession,\n        sourceUrl: data.sourceUrl || sourceUrl,\n        title: data.title,\n      };",
    "      const parseCompletedAt = Date.now();\n      const next = {\n        ...cleanSession,\n        sourceUrl: data.sourceUrl || sourceUrl,\n        title: data.title,\n        performance: recordNhkParsePerformance(cleanSession.performance, {\n          parseMs: parseCompletedAt - flowStartedAt,\n          parserServerMs: data.timingMs?.totalMs,\n          parserCacheHit: Boolean(data.cached),\n          completedAt: parseCompletedAt,\n        }),\n      };",
    'record parser timing',
)
replace_one(
    page,
    "  const nextFromInput = () => {\n    const next = applyCoachFields(draftRef.current, coach, selectedRef.current, articleSentences);\n    persist(next);\n    setStep(1);\n  };",
    "  const nextFromInput = () => {\n    const next = applyCoachFields(draftRef.current, coach, selectedRef.current, articleSentences);\n    persist({...next, performance: recordNhkFirstTraining(next.performance)});\n    setStep(1);\n  };",
    'first training timing',
)
replace_one(
    page,
    "  const completeToday = () => {\n    const next = syncNhkDailyInputUserFields({...draftRef.current, completedAt: Date.now()});\n    persist(next);\n    setView('home');\n  };",
    "  const completeToday = () => {\n    const completedAt = Date.now();\n    const next = syncNhkDailyInputUserFields({\n      ...draftRef.current,\n      completedAt,\n      performance: recordNhkSessionCompletion(draftRef.current.performance, completedAt),\n    });\n    persist(next);\n    setView('home');\n  };",
    'session completion timing',
)

# Aggregate entry efficiency from real local sessions.
evidence = Path('src/nhkEvidence.ts')
replace_one(
    evidence,
    "export type NhkWeeklyEvidence = {",
    "export type NhkEntryEvidence = {\n  linkToFirstTrainingMs: NhkEvidenceValue;\n  sessionDurationMs: NhkEvidenceValue;\n  parserServerMs: NhkEvidenceValue;\n  cacheHitRate: NhkEvidenceValue;\n  cacheHits: number;\n  cacheSamples: number;\n};\n\nexport type NhkWeeklyEvidence = {",
    'entry evidence type',
)
replace_one(
    evidence,
    "  speakingSeconds: number;\n  headlineZh: string;\n  current:",
    "  speakingSeconds: number;\n  headlineZh: string;\n  entry: NhkEntryEvidence;\n  current:",
    'weekly entry evidence field',
)
replace_one(
    evidence,
    "const currentMetrics = (points: ReviewPoint[]): NhkWeeklyEvidence['current'] => {",
    "const buildEntryEvidence = (sessions: NhkMorningSession[]): NhkEntryEvidence => {\n  const cacheSamples = sessions.filter(session => typeof session.performance.parserCacheHit === 'boolean');\n  const cacheHits = cacheSamples.filter(session => session.performance.parserCacheHit === true).length;\n  return {\n    linkToFirstTrainingMs: average(sessions.map(session => numeric(session.performance.linkToFirstTrainingMs))),\n    sessionDurationMs: average(sessions.map(session => numeric(session.performance.sessionDurationMs))),\n    parserServerMs: average(sessions.map(session => numeric(session.performance.parserServerMs))),\n    cacheHitRate: cacheSamples.length\n      ? {value: Math.round(cacheHits / cacheSamples.length * 100), count: cacheSamples.length}\n      : {value: null, count: 0},\n    cacheHits,\n    cacheSamples: cacheSamples.length,\n  };\n};\n\nconst currentMetrics = (points: ReviewPoint[]): NhkWeeklyEvidence['current'] => {",
    'entry evidence aggregation',
)
replace_one(
    evidence,
    "  const completedInputs = sessions.filter(session => Boolean(session.completedAt)\n    && session.dateKey >= periodStart\n    && session.dateKey <= todayKey).length;",
    "  const weeklySessions = sessions.filter(session => session.dateKey >= periodStart && session.dateKey <= todayKey);\n  const completedInputs = weeklySessions.filter(session => Boolean(session.completedAt)).length;",
    'weekly session set',
)
replace_one(
    evidence,
    "    speakingSeconds,\n    headlineZh: strongestHeadline(comparisons, weeklyPoints.length, completedInputs),\n    current:",
    "    speakingSeconds,\n    headlineZh: strongestHeadline(comparisons, weeklyPoints.length, completedInputs),\n    entry: buildEntryEvidence(weeklySessions),\n    current:",
    'return entry evidence',
)

page_evidence = Path('src/NhkEvidencePage.tsx')
replace_one(
    page_evidence,
    "const minutesCopy = (seconds: number): string => {\n  if (seconds < 60) return `${seconds}秒`;\n  return `${Math.round(seconds / 60)}分钟`;\n};",
    "const minutesCopy = (seconds: number): string => {\n  if (seconds < 60) return `${seconds}秒`;\n  return `${Math.round(seconds / 60)}分钟`;\n};\n\nconst millisecondsCopy = (metric: NhkEvidenceValue, mode: 'seconds' | 'minutes'): string => {\n  if (metric.value === null) return '—';\n  return mode === 'minutes'\n    ? `${(metric.value / 60_000).toFixed(1)}分钟`\n    : `${(metric.value / 1_000).toFixed(1)}秒`;\n};",
    'entry metric formatter',
)
replace_one(
    page_evidence,
    "      <section className=\"nhk-evidence-section\">\n        <div className=\"nhk-evidence-title\"><Mic2 size={17} /><div><strong>现在的表现</strong>",
    "      <section className=\"nhk-evidence-section\">\n        <div className=\"nhk-evidence-title\"><TrendingUp size={17} /><div><strong>入口效率</strong><small>从粘贴链接到真正开始训练</small></div></div>\n        <div className=\"nhk-evidence-metrics\">\n          <MetricCard\n            label=\"链接 → 开始训练\"\n            value={millisecondsCopy(evidence.entry.linkToFirstTrainingMs, 'seconds')}\n            note={`${evidence.entry.linkToFirstTrainingMs.count} 次记录 · 目标约 10 秒`}\n          />\n          <MetricCard\n            label=\"完整训练时长\"\n            value={millisecondsCopy(evidence.entry.sessionDurationMs, 'minutes')}\n            note={`${evidence.entry.sessionDurationMs.count} 次完成 · 目标 8～12 分钟`}\n          />\n          <MetricCard\n            label=\"解析器服务时间\"\n            value={millisecondsCopy(evidence.entry.parserServerMs, 'seconds')}\n            note=\"不含用户阅读和选择时间\"\n          />\n          <MetricCard\n            label=\"文章缓存命中率\"\n            value={displayValue(evidence.entry.cacheHitRate, '%')}\n            note={`${evidence.entry.cacheHits}/${evidence.entry.cacheSamples} 次命中`}\n          />\n        </div>\n      </section>\n\n      <section className=\"nhk-evidence-section\">\n        <div className=\"nhk-evidence-title\"><Mic2 size={17} /><div><strong>现在的表现</strong>",
    'entry evidence section',
)

# Integration tests for persistence and weekly aggregation.
evidence_test = Path('src/nhkEvidence.test.ts')
replace_one(
    evidence_test,
    "      shadowRecordingSeconds: 10,\n      recapRecordingSeconds: 20,",
    "      shadowRecordingSeconds: 10,\n      recapRecordingSeconds: 20,\n      performance: {\n        linkToFirstTrainingMs: 12_000,\n        sessionDurationMs: 600_000,\n        parserServerMs: 5_000,\n        parserCacheHit: false,\n      },",
    'first evidence performance',
)
replace_one(
    evidence_test,
    "      shadowRecordingSeconds: 12,\n      recapRecordingSeconds: 24,",
    "      shadowRecordingSeconds: 12,\n      recapRecordingSeconds: 24,\n      performance: {\n        linkToFirstTrainingMs: 6_000,\n        sessionDurationMs: 480_000,\n        parserServerMs: 900,\n        parserCacheHit: true,\n      },",
    'recent evidence performance',
)
replace_one(
    evidence_test,
    "    expect(evidence.speakingSeconds).toBe(66);\n    expect(evidence.current.shadowAccuracy.value).toBe(74);",
    "    expect(evidence.speakingSeconds).toBe(66);\n    expect(evidence.entry.linkToFirstTrainingMs.value).toBe(9_000);\n    expect(evidence.entry.sessionDurationMs.value).toBe(540_000);\n    expect(evidence.entry.parserServerMs.value).toBe(2_950);\n    expect(evidence.entry.cacheHitRate.value).toBe(50);\n    expect(evidence.entry.cacheHits).toBe(1);\n    expect(evidence.entry.cacheSamples).toBe(2);\n    expect(evidence.current.shadowAccuracy.value).toBe(74);",
    'entry evidence assertions',
)

morning_test = Path('src/nhkMorning.test.ts')
text = morning_test.read_text(encoding='utf-8')
insert = """

  it('migrates stored flow timing without inventing invalid measurements', () => {
    const payload = JSON.stringify([{
      ...createNhkSession('2026-09-01'),
      performance: {
        flowStartedAt: 100,
        parseMs: 2200,
        parserCacheHit: true,
        sessionDurationMs: -1,
      },
    }]);
    const storage = {getItem: () => payload, setItem: () => undefined};
    expect(loadNhkSessions(storage)[0].performance).toEqual({
      flowStartedAt: 100,
      parseMs: 2200,
      parserCacheHit: true,
    });
  });
"""
closing = "\n});\n"
if not text.endswith(closing):
    raise SystemExit('morning test closing not found')
morning_test.write_text(text[:-len(closing)] + insert + closing, encoding='utf-8')
