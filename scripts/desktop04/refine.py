from pathlib import Path
p=Path('src/companion/CompanionApp.tsx');s=p.read_text()
if s.count('noteStillApplies')==1:s=s.replace("import {noteStillApplies} from './writtenLane';\n",'')
p.write_text(s)
p=Path('src/immersion/SelectionStudyLayer.tsx');s=p.read_text()
if 'lastRangeKey' not in s:
 s=s.replace("const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);","const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const lastRangeKey=useRef('');")
 old="const changed=()=>{clearTimeout(timer.current);"
 new="const changed=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('.imm-selection-tools'))return;clearTimeout(timer.current);"
 assert s.count(old)==1;s=s.replace(old,new)
 old="setFocus(found?.focus||null);setMore(false);"
 new="const next=found?.focus||null;const key=next?JSON.stringify([next.sourceId,next.sourceText,next.start,next.end]):'';if(key!==lastRangeKey.current){lastRangeKey.current=key;setFocus(next);setMore(false);}"
 assert s.count(old)==1;s=s.replace(old,new)
 s=s.replace("const f=focus;setFocus(null);setMore(false);", "const f=focus;lastRangeKey.current='';setFocus(null);setMore(false);")
 p.write_text(s)
p=Path('src/companion/desktopNotes.test.ts')
if not p.exists():p.write_text(r'''import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Line} from './model';
import type {WrittenNote} from './writtenFeedback';
import {DESKTOP_QUERY,displayedNotes,revealTarget} from './desktopNotes';
const line=(id:string,role:Line['role'],text:string):Line=>({id,role,text,previous:'',delivered:true,interrupted:false,assistance:'none',seq:0});
const note=(id:string,anchorId:string,source:string,mode:WrittenNote['mode']='auto'):WrittenNote=>({id,anchorId,source,mode,kind:'grammar',suggestion:'昨日、ゲームをしました。',reasonZh:'过去的事情用过去式。',detailZh:'',certainty:'clear',meaningPreserved:true});
describe('one note collection for sidebar, notice and transcript',()=>{
 it('exposes the latest valid note and falls back from a retired unread id',()=>{const lines=[line('u1','user','猫好き。'),line('a1','assistant','猫ですね。'),line('u2','user','ゲーム好き。')],notes=[note('n1','u1','猫好き。'),note('n2','u2','ゲーム好き。')];const shown=displayedNotes(notes,lines,true);expect(shown.map(n=>n.id)).toEqual(['n1','n2']);expect(revealTarget(shown,'removed')?.id).toBe('n2');expect(revealTarget(shown,'n1')?.id).toBe('n1');});
 it('does not expose notes for changed ASR, interrupted lines or another topic',()=>{const n=note('n','u','猫好き。');expect(displayedNotes([n],[line('u','user','犬好き。')],true)).toEqual([]);expect(displayedNotes([n],[{...line('u','user','猫好き。'),interrupted:true}],true)).toEqual([]);expect(displayedNotes([n],[line('new','user','猫好き。')],true)).toEqual([]);});
 it('honors disabled automatic corrections without hiding explicit help',()=>{const source='この言葉は何ですか。',lines=[line('u','user',source)];const shown=displayedNotes([note('auto','u',source),note('question','u',source,'question')],lines,false);expect(shown.map(n=>n.id)).toEqual(['question']);});
 it('is safe before any note has arrived',()=>expect(revealTarget([],'' )).toBeUndefined());
 it('does not mutate caller-owned note order',()=>{const n=note('n','u','猫好き。'),all=[n];expect(displayedNotes(all,[line('u','user','猫好き。')],true)).not.toBe(all);expect(all).toEqual([n]);});
});
describe('desktop and motion contracts',()=>{
 it('uses the same breakpoint for rendering and layout',()=>{expect(DESKTOP_QUERY).toBe('(min-width: 1100px)');expect(readFileSync('src/companion/desktopFocus.css','utf8')).toContain('@media(min-width:1100px)');});
 it('mounts only one copy of automatic notes and reveals history on a phone',()=>{const s=readFileSync('src/companion/CompanionApp.tsx','utf8');expect(s).toContain('if(!desktop)setScenery(false)');expect(s).toContain('!desktop&&!practice&&visibleNotes');expect(s).toContain('aria-label="常驻文字教师"');expect(s).toContain('!desktop&&unreadNote');});
 it('weather cannot acquire a microphone, create sound or intercept a click',()=>{const s=readFileSync('src/immersion/DesktopAtmosphere.tsx','utf8'),css=readFileSync('src/companion/desktopFocus.css','utf8');expect(s).not.toMatch(/getUserMedia|AudioContext|new Audio\(/);expect(css).toContain('pointer-events:none!important');expect(s).toContain('cancelAnimationFrame');expect(s).toContain('visibilitychange');expect(s).toContain('prefers-reduced-motion');expect(s).toContain('saveData');expect(s).toContain('6000000');});
 it('toolbar interaction does not reset the range or close More',()=>{const s=readFileSync('src/immersion/SelectionStudyLayer.tsx','utf8');expect(s).toContain("event.target.closest('.imm-selection-tools')");expect(s).toContain('key!==lastRangeKey.current');});
});
''')
print('Desktop note guards and selection-toolbar refinement prepared.')
