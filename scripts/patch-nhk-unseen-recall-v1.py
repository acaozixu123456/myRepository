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


page_path = 'src/NhkMorningPage.tsx'
page = read(page_path)
if "from './nhkRecallScenario'" not in page:
    page = replace_once(
        page,
        "import EpisodeVisual from './EpisodeVisual';",
        "import EpisodeVisual from './EpisodeVisual';\nimport {buildNhkRecallScenario, NHK_UNSEEN_RECALL_VERSION} from './nhkRecallScenario';",
        'recall scenario import',
    )
if 'const recallScenario = useMemo' not in page:
    page = replace_once(
        page,
        "  const recallSession = recallTarget?.session || null;",
        "  const recallSession = recallTarget?.session || null;\n  const recallScenario = useMemo(\n    () => recallSession && recallTarget\n      ? buildNhkRecallScenario(recallSession, recallTarget.intervalDay)\n      : null,\n    [recallSession, recallTarget],\n  );",
        'recall scenario selector',
    )
page = replace_once(
    page,
    "      <section className=\"nhk-page nhk-flow\">\n        <header className=\"nhk-flow-header\">\n          <button aria-label=\"返回\" onClick={() => setView('home')}><ArrowLeft size={20} /></button>\n          <div><small>第{recallTarget?.intervalDay || 1}天回忆</small><strong>先说，再看答案</strong></div>",
    "      <section className=\"nhk-page nhk-flow\" data-recall-version={NHK_UNSEEN_RECALL_VERSION}>\n        <header className=\"nhk-flow-header\">\n          <button aria-label=\"返回\" onClick={() => setView('home')}><ArrowLeft size={20} /></button>\n          <div><small>第{recallTarget?.intervalDay || 1}天回忆</small><strong>新场景主动迁移</strong></div>",
    'recall page marker',
)
old_task = """          <small>{formatDate(recallSession.dateKey)} · 第{recallTarget?.intervalDay || 1}天 · {recallSession.title || 'NHK日语听力'}</small>
          <h1>不用看原文，先说出最值得带走的一句。</h1>
          <p>再用这句话，说一句和你工作或生活有关的话。</p>
          <NhkRecordingCoach
            label="20秒无提示回忆"
            mode="recall"
            referenceText={recallSession.keyExpression}
            summary={recallSession.dailyInput?.coach.summaryJa || recallSession.title}
            question={`第${recallTarget?.intervalDay || 1}天，把这句迁移到工作或生活。`}
            targetExpression={recallSession.keyExpression}
            review={recallReview}
            onDuration={setRecallSeconds}
            onReview={setRecallReview}
          />"""
new_task = """          <small>{formatDate(recallSession.dateKey)} · {recallScenario?.labelZh || `第${recallTarget?.intervalDay || 1}天主动回忆`}</small>
          <h1>{recallScenario?.situationZh || '不用看原文，把核心表达换进新的场景。'}</h1>
          <p>{recallScenario?.cueZh || '先独立说，再查看参考表达。'}</p>
          {recallScenario && (
            <div className="nhk-recall-scenario">
              <small>对方问</small>
              <strong>{recallScenario.promptJa}</strong>
              <span>{recallScenario.register === 'business' ? '工作表达' : recallScenario.register === 'daily' ? '日常表达' : '同结构回忆'}</span>
            </div>
          )}
          <NhkRecordingCoach
            label="20秒新场景回答"
            mode="recall"
            referenceText={recallScenario?.sampleAnswerJa || recallSession.keyExpression}
            summary={recallSession.dailyInput?.coach.summaryJa || recallSession.title}
            question={recallScenario?.promptJa || `第${recallTarget?.intervalDay || 1}天，把这句迁移到工作或生活。`}
            targetExpression={recallSession.keyExpression}
            review={recallReview}
            onDuration={setRecallSeconds}
            onReview={setRecallReview}
          />"""
page = replace_once(page, old_task, new_task, 'recall task block')
old_answer = """              <small>第{recallTarget?.intervalDay || 1}天要想起</small>
              <strong>{recallSession.keyExpression}</strong>
              {recallSession.workVersion && <p>{recallSession.workVersion}</p>}"""
new_answer = """              <small>说完后再看的参考表达</small>
              <strong>{recallScenario?.sampleAnswerJa || recallSession.workVersion || recallSession.keyExpression}</strong>
              <p>目标表达：{recallSession.keyExpression}</p>"""
page = replace_once(page, old_answer, new_answer, 'recall answer block')
write(page_path, page)

css_path = 'src/nhkMorning.css'
css = read(css_path)
marker = '/* nhk-unseen-recall-v1 */'
if marker not in css:
    css += r'''

/* nhk-unseen-recall-v1 */
.nhk-recall-scenario{margin:11px 0;border:1px solid #dbe4c8;border-radius:17px;background:#f3f7e8;padding:12px;display:grid;gap:5px}.nhk-recall-scenario>small{font-size:8px;color:#718051;font-weight:900}.nhk-recall-scenario>strong{font-size:13px;line-height:1.65}.nhk-recall-scenario>span{width:max-content;border-radius:999px;background:#17221c;color:#dff08a;padding:4px 7px;font-size:7px;font-weight:900}
'''
write(css_path, css)

assert 'NHK_UNSEEN_RECALL_VERSION' in read(page_path)
assert 'new场景' not in read(page_path)
assert '新场景主动迁移' in read(page_path)
assert marker in read(css_path)
