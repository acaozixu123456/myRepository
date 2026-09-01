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
    '标题、正文和迁移表达都会自动准备。第 1 句完整训练，其余最多两句进入轻量跟读和后续回忆。',
    '标题、正文和迁移表达都会自动准备。第 1 句完整训练，其余最多两句会保存为补充句。',
    'choose copy',
)
replace_one(page, '轻量跟读，之后再遇', '已保存为补充句', 'supplement badge')
replace_one(page, '<small>昨天的一句</small>', '<small>第{recallTarget?.intervalDay || 1}天要想起</small>', 'recall answer label')

memory = Path('src/nhkMorning.ts')
replace_one(
    memory,
    "    if (!session.completedAt || session.dateKey >= todayKey) continue;\n    const completed = new Set(session.recallAttempts.map(attempt => attempt.intervalDay));",
    "    if (!session.completedAt || session.dateKey >= todayKey) continue;\n    if (session.recallAttempts.some(attempt => attempt.dateKey === todayKey)) continue;\n    const completed = new Set(session.recallAttempts.map(attempt => attempt.intervalDay));",
    'one recall per source per day',
)

tests = Path('src/nhkMorning.test.ts')
replace_one(
    tests,
    "    session = recordNhkRecallAttempt(session, day1!, '2026-09-02', 'good', 12, 2);\n\n    const day3 = pickRecallTarget([session], '2026-09-04');",
    "    session = recordNhkRecallAttempt(session, day1!, '2026-09-02', 'good', 12, 2);\n    expect(pickRecallTarget([session], '2026-09-02')).toBeNull();\n\n    const day3 = pickRecallTarget([session], '2026-09-04');",
    'same-day recall test',
)
