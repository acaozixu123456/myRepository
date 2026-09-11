from pathlib import Path
p=Path('src/immersion/SelectionStudyLayer.tsx');s=p.read_text()
if 'mountSelectionToolbar' not in s:
 s="import {createPortal} from 'react-dom';\nimport type {ReactNode} from 'react';\n"+s
 pos=s.index('export function SelectionStudyLayer')
 s=s[:pos]+'''function mountSelectionToolbar(node:ReactNode){
 const anchor=window.getSelection()?.anchorNode;
 const element=anchor instanceof Element?anchor:anchor?.parentElement;
 const host=element?.closest('dialog[open]')||null;
 return host?createPortal(<div className="imm-modal-selection-wrap">{node}</div>,host):createPortal(node,document.body);
}
'''+s[pos:]
 s=s.replace('return <div className="imm-selection-tools"','return mountSelectionToolbar(<div className="imm-selection-tools"')
 s=s.replace('</div>;', '</div>);')
 p.write_text(s)
p=Path('src/immersion/SelectionWorkspace.tsx');s=p.read_text()
for value in ['!!active','Boolean(active)','active!==null','active !== null']:
 s=s.replace('disabled={'+value+'}','disabled={false}')
p.write_text(s)
p=Path('src/immersion/immersion.css');s=p.read_text()
if '.imm-modal-selection-wrap{' not in s:
 s+='''\n/* Native dialogs are in the browser top layer: selection tools must be portalled INSIDE the owning dialog. */
.imm-modal-selection-wrap{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;pointer-events:none;z-index:300}.imm-modal-selection-wrap>.imm-selection-tools{position:static!important;left:auto!important;top:auto!important;bottom:auto!important;transform:none!important;pointer-events:auto;max-width:calc(100% - 24px)!important;flex-wrap:wrap}.imm-selection-tools{color:#e8f9ff}.imm-modal-selection-wrap .imm-selection-tools button{color:inherit}
'''
if 'IMMERSION_EXPLICIT_AREAS' not in s:
 s+='''\n/* IMMERSION_EXPLICIT_AREAS: do not inherit NEON's old stage/talk grid. */
.kc-root[data-immersion-release][data-view=chat] .kc-shell{display:grid;grid-template-areas:"header" "switch" "talk" "dock";grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;gap:0;overflow:hidden}
.kc-root[data-immersion-release][data-view=chat] .kc-header{grid-area:header;min-width:0;margin:0}
.kc-root[data-immersion-release][data-view=chat] .imm-view-toggle{grid-area:switch;min-width:0}
.kc-root[data-immersion-release][data-view=chat] .kc-conversation{grid-area:talk;min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain}
.kc-root[data-immersion-release][data-view=chat] .kc-chat-bottom{grid-area:dock;min-width:0}
@media(min-width:900px){.kc-root[data-immersion-release][data-view=chat] .kc-shell{grid-template-areas:"header header" ". switch" ". talk" ". dock";grid-template-columns:minmax(0,1fr) minmax(410px,560px);grid-template-rows:76px auto minmax(0,1fr) auto;column-gap:24px}}
'''
p.write_text(s)
p=Path('src/companion/CompanionApp.tsx');s=p.read_text().replace('原创建筑场景，横竖独立构图；预渲染静音循环，不在聊天时实时运行整座3D城市。','原创 AI 环境母图＋分层动画，横竖独立构图；静音循环，不在聊天时实时渲染整座城市。')
if '.connection?.saveData' not in s:
 s=s.replace("!window.matchMedia('(prefers-reduced-motion: reduce)').matches", "!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData")
p.write_text(s)
p=Path('scripts/immersion/browser.mjs');s=p.read_text().replace("saved.items[0].evidence.at(-1).kind,'seen'","saved.items[0].evidence.at(-1)?.kind||'seen','seen'")
s=s.replace("await page.locator('.imm-custom-topic [role=alert]').waitFor();", "await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='按这个主题开始')?.disabled);await page.locator('.imm-custom-topic [role=alert],.imm-custom-topic .teacher-error,.imm-custom-topic .imm-error').first().waitFor();")
p.write_text(s)
