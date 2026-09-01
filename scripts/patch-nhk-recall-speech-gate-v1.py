from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'src/NhkMorningPage.tsx'
text = PATH.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'anchor not found: {label}')
    text = text.replace(old, new, 1)


if 'const [recallSpeechFallback, setRecallSpeechFallback]' not in text:
    replace_once(
        "  const [recallSeconds, setRecallSeconds] = useState(0);",
        "  const [recallSeconds, setRecallSeconds] = useState(0);\n  const [recallSpeechFallback, setRecallSpeechFallback] = useState(false);",
        'recall fallback state',
    )

if 'setRecallSpeechFallback(false);' not in text:
    replace_once(
        "  const openRecall = () => {\n    setRecallRevealed(false);\n    setRecallSeconds(0);",
        "  const openRecall = () => {\n    setRecallRevealed(false);\n    setRecallSeconds(0);\n    setRecallSpeechFallback(false);",
        'recall reset',
    )

# Attach the browser-fallback callback only to the recall recorder.
recall_recorder_anchor = """            onDuration={setRecallSeconds}
            onReview={setRecallReview}
          />"""
if 'onUnavailable={() => setRecallSpeechFallback(true)}' not in text:
    replace_once(
        recall_recorder_anchor,
        """            onDuration={setRecallSeconds}
            onReview={setRecallReview}
            onUnavailable={() => setRecallSpeechFallback(true)}
          />""",
        'recall recorder fallback',
    )

old_button = """            <button className=\"nhk-secondary-action\" onClick={() => setRecallRevealed(true)}>说完了，查看答案</button>"""
new_button = """            <button
              className=\"nhk-secondary-action\"
              data-recall-speech-gate=\"nhk-recall-speech-gate-v1\"
              disabled={!recallSpeechFallback && recallSeconds <= 0 && !recallReview}
              onClick={() => setRecallRevealed(true)}
            >
              {recallSpeechFallback ? '使用备用路径查看答案' : recallSeconds > 0 || recallReview ? '说完了，查看答案' : '先录一次，再看答案'}
            </button>"""
if old_button in text:
    text = text.replace(old_button, new_button, 1)
elif 'data-recall-speech-gate="nhk-recall-speech-gate-v1"' not in text:
    raise RuntimeError('anchor not found: reveal button')

# Keep persisted fallback attempts non-negative.
text = text.replace(
    'recordNhkRecallAttempt(recallSession, recallTarget, todayKey, rating, recallSeconds)',
    'recordNhkRecallAttempt(recallSession, recallTarget, todayKey, rating, Math.max(0, recallSeconds))',
)

PATH.write_text(text, encoding='utf-8')

assert 'data-recall-speech-gate="nhk-recall-speech-gate-v1"' in text
assert 'disabled={!recallSpeechFallback && recallSeconds <= 0 && !recallReview}' in text
assert 'onUnavailable={() => setRecallSpeechFallback(true)}' in text
