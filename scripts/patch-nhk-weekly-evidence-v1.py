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
if "from './NhkWeeklyEvidence'" not in page:
    page = replace_once(
        page,
        "import EpisodeVisual from './EpisodeVisual';",
        "import EpisodeVisual from './EpisodeVisual';\nimport NhkWeeklyEvidence from './NhkWeeklyEvidence';",
        'weekly evidence import',
    )
if '<NhkWeeklyEvidence sessions={sessions} todayKey={todayKey} />' not in page:
    page = replace_once(
        page,
        "      {recent.length > 0 && (",
        "      <NhkWeeklyEvidence sessions={sessions} todayKey={todayKey} />\n\n      {recent.length > 0 && (",
        'weekly evidence home card',
    )
write(page_path, page)

css_path = 'src/nhkMorning.css'
css = read(css_path)
marker = '/* nhk-weekly-evidence-v1 */'
if marker not in css:
    css += r'''

/* nhk-weekly-evidence-v1 */
.nhk-weekly-evidence{margin-top:14px;border:1px solid #dfe4d9;border-radius:22px;background:#fff;padding:14px;box-shadow:0 10px 24px #17221c08}.nhk-weekly-evidence>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.nhk-weekly-evidence>header>div{display:grid;gap:2px}.nhk-weekly-evidence>header small{font-size:8px;color:#7d887f;font-weight:900;letter-spacing:.8px}.nhk-weekly-evidence>header strong{font-size:14px}.nhk-weekly-evidence>header>span{display:flex;align-items:center;gap:5px;border-radius:999px;background:#eef2e7;color:#60783c;padding:5px 8px;font-size:8px;font-weight:900}.nhk-evidence-headline{margin-top:11px;border-radius:16px;background:#17221c;color:#fff;padding:12px;display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start}.nhk-evidence-headline>svg{color:#dff08a;margin-top:1px}.nhk-evidence-headline>div{display:grid;gap:3px}.nhk-evidence-headline strong{font-size:11px;line-height:1.45}.nhk-evidence-headline p{font-size:8px;line-height:1.6;color:#ced8d1;margin:0}.nhk-evidence-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.nhk-evidence-grid article{min-width:0;border-radius:16px;background:#f3f5f0;padding:10px;display:grid;gap:4px}.nhk-evidence-grid article.improved{background:#eef4dc}.nhk-evidence-grid article.declined{background:#f8efeb}.nhk-evidence-grid article>div{display:flex;align-items:center;gap:5px;color:#718078}.nhk-evidence-grid article>div small{font-size:8px;font-weight:900}.nhk-evidence-grid article>strong{font-size:20px;letter-spacing:-.5px;line-height:1.1}.nhk-evidence-grid article>span{display:flex;align-items:center;gap:3px;font-size:8px;line-height:1.4;color:#667168}.nhk-evidence-grid article.improved>span{color:#58712f}.nhk-evidence-grid article.declined>span{color:#98584d}.nhk-evidence-grid article>em{font-style:normal;font-size:7px;color:#939b95}.nhk-recall-evidence{margin-top:9px;border-radius:16px;border:1px solid #e1e5dd;padding:11px}.nhk-recall-evidence>div:first-child{display:flex;justify-content:space-between;align-items:center;gap:8px}.nhk-recall-evidence>div:first-child small{font-size:8px;color:#7e8981}.nhk-recall-evidence>div:first-child strong{font-size:8px;color:#60783c}.nhk-recall-evidence>div:last-child{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.nhk-recall-evidence>div:last-child>span{border-radius:12px;background:#f1f3ef;padding:8px;display:grid;gap:2px;text-align:center}.nhk-recall-evidence>div:last-child>span.ready{background:#eef4dc}.nhk-recall-evidence b{font-size:8px;color:#768078}.nhk-recall-evidence span>strong{font-size:14px}.nhk-recall-evidence span>small{font-size:7px;color:#8d958f}.nhk-weekly-evidence>footer{display:grid;gap:3px;margin-top:10px;padding-top:9px;border-top:1px solid #e6e8e2}.nhk-weekly-evidence>footer>span{font-size:8px;color:#657169}.nhk-weekly-evidence>footer>small{font-size:7px;line-height:1.55;color:#939b95}.nhk-weekly-evidence.empty .nhk-evidence-grid article>strong{color:#9ba19c}@media(max-width:360px){.nhk-evidence-grid{grid-template-columns:1fr}.nhk-recall-evidence>div:first-child{display:grid}}
'''
write(css_path, css)

assert "import NhkWeeklyEvidence from './NhkWeeklyEvidence';" in read(page_path)
assert '<NhkWeeklyEvidence sessions={sessions} todayKey={todayKey} />' in read(page_path)
assert marker in read(css_path)
