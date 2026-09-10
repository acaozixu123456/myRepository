from pathlib import Path
p=Path('src/companion/CompanionApp.tsx');s=p.read_text()
def replace(a,b):
 global s
 assert s.count(a)==1,(a[:80],s.count(a));s=s.replace(a,b)
replace("import type {WrittenNote} from './writtenFeedback';","import type {WrittenNote} from './writtenFeedback';\nimport {noteStillApplies} from './writtenLane';")
replace("notes.filter(n=>n.anchorId===line.id&&n.source===line.text.slice(0,700))","notes.filter(n=>n.anchorId===line.id&&noteStillApplies(n,lines,writtenEnabled))")
replace("onSeen={()=>conn.current?.exposeNote(n.id)}/>","onReading={value=>{readingNote.current=value;if(value)followBottom.current=false;conn.current?.setReadingNote(value);}} onSeen={()=>conn.current?.exposeNote(n.id)}/>")
replace("暂时没找到可靠的新消息，先聊别的也好。","这次消息来源或内容校验没接好，原话题仍可聊。")
p.write_text(s)
print('Applied bounded reader-lock, stale-fragment visibility and truthful news-status wording.')
