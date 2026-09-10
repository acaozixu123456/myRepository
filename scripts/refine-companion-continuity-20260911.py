from pathlib import Path
old = '意味が(?:分か|わか)ら'
new = '意味が(?:分か|わか)(?:らない|りません)'
for name in ['src/companion/writtenFeedback.ts', 'supabase/functions/nihongo-companion/writtenContract.ts']:
    p = Path(name)
    text = p.read_text()
    if new not in text:
        assert text.count(old) == 1, name
        p.write_text(text.replace(old, new, 1))
assert Path('src/companion/writtenFeedback.ts').read_text() == Path('supabase/functions/nihongo-companion/writtenContract.ts').read_text()
