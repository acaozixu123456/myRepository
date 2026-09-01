from pathlib import Path

path = Path('src/nhkBoss.ts')
text = path.read_text(encoding='utf-8')
old = """    const ordered = [...input.selectedTrainingSentences].sort((left, right) => {
      if (left.role === right.role) return left.sourceIndex - right.sourceIndex;
      return left.role === 'primary' ? -1 : 1;
    });"""
new = """    const ordered = [...input.selectedTrainingSentences].sort((left, right) => {
      if (left.isPrimary === right.isPrimary) return left.selectionOrder - right.selectionOrder;
      return left.isPrimary ? -1 : 1;
    });"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'Boss ordering: expected 1 match, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
