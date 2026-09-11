import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {phraseChanges,resultHeading} from './FeedbackMoment';
import {CUE_NOTES,cueAllowed,scheduleLearningCue,type LearningCue} from './learningSound';
const read=(name:string)=>readFileSync(name,'utf8');
describe('visual feedback preserves the actual learner and reference texts',()=>{
 it.each([
 ['初めて前に、1点だけお伺いしてもよろしいでしょうか。','会議の前に、1点だけお伺いしてもよろしいでしょうか。'],
 ['ファイルは、今、ちょっと質問があります。','ファイルについて、ちょっと質問があります。'],
 ['猫が好きです。','猫が好きです。'],['','確認します。'],['猫です。',''],['😀猫𠮷です。','😀犬𠮷です。'],['本来の文\nそのまま','本来の文\nそのままです']
 ])('round-trips exact before/after %s',(before,after)=>{const d=phraseChanges(before,after);expect(d.before.map(c=>c.text).join('')).toBe(before);expect(d.after.map(c=>c.text).join('')).toBe(after);});
 it('highlights only differing text, leaving the shared polite clause intact',()=>{const d=phraseChanges('初めて前に、1点だけお伺いしてもよろしいでしょうか。','会議の前に、1点だけお伺いしてもよろしいでしょうか。');expect(d.after.filter(c=>!c.changed).map(c=>c.text).join('')).toContain('前に、1点だけお伺いしてもよろしいでしょうか。');});
 it('does not manufacture a change when there is no suggested revision',()=>expect(phraseChanges('正しい文です。','正しい文です。').after.every(c=>!c.changed)).toBe(true));
 it('does not convert optional refinement into failure or uncertainty into mastery',()=>{const r={verdict:'communicated' as const,focusUsed:true,suggestionJa:'別の言い方です。',feedbackZh:'元の文でも伝わります。'};expect(resultHeading(r)).toContain('意思到了');expect(resultHeading({...r,verdict:'uncertain'})).toContain('确认');expect(resultHeading({...r,suggestionJa:''})).toContain('表达清楚');});
});
describe('short optional cues yield to every speech and capture state',()=>{
 const silent={micOn:false,outputBusy:false,hidden:false,mediaPlaying:false};
 it('default opt-out is silent',()=>expect(cueAllowed(false,silent)).toBe(false));
 it('opt-in permits a short cue only in silence',()=>expect(cueAllowed(true,silent)).toBe(true));
 it.each(['micOn','outputBusy','hidden','mediaPlaying'] as const)('suppresses when %s',key=>expect(cueAllowed(true,{...silent,[key]:true})).toBe(false));
 it.each(Object.keys(CUE_NOTES) as LearningCue[])('bounds the %s envelope and disconnects nodes',cue=>{let stopped=0,started=0;const context={currentTime:0,destination:{},createOscillator:()=>({type:'',frequency:{value:0},connect:()=>{},disconnect:()=>{},start:()=>started++,stop:()=>stopped++}),createGain:()=>({gain:{setValueAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},connect:()=>{},disconnect:()=>{}})};const duration=scheduleLearningCue(context as unknown as BaseAudioContext,cue,.35);expect(duration).toBeLessThan(.4);expect(started).toBe(CUE_NOTES[cue].length);expect(stopped).toBe(started);});
 it('contains no background music, request, recording, or persistence operations',()=>expect(read('src/companion/learningSound.tsx')).not.toMatch(/getUserMedia|fetch\(|localStorage|indexedDB|MediaRecorder/));
 it('closes the opt-in race and stops effects synchronously when opening the mic',()=>{expect(read('src/companion/learningSound.tsx')).toContain('epoch!==enableEpoch');expect(read('src/companion/CompanionApp.tsx')).toContain('stopLearningCues();void conn.current?.toggleMic()');});
});
describe('single source of truth for visible teaching and unchanged speech ownership',()=>{
 it('mobile notice switches to mounted history before finding the card',()=>{const s=read('src/companion/CompanionApp.tsx'),p=s.slice(s.indexOf('const revealNote='),s.indexOf('const closePractice='));expect(p).toContain('if(!desktop)setScenery(false)');expect(p).toContain('desktop?teacherScroll.current:scroller.current');});
 it('desktop note rail is independent of caption settings',()=>{const s=read('src/companion/CompanionApp.tsx');expect(s).toContain('aria-label="常驻文字教师"');expect(s).toContain('!desktop&&!line.interrupted');expect(s).toContain('!desktop&&unreadNote');});
 it('the full original teacher feedback remains available, not rewritten by a UI heuristic',()=>{const s=read('src/companion/FeedbackMoment.tsx');expect(s).toContain('{result.feedbackZh}');expect(s).toContain('data-study-source="practice"');expect(s).toContain('文字差异，不代表每处都是错误');});
 it('does not reset the selected toolbar for an unchanged native selection',()=>{const s=read('src/immersion/SelectionStudyLayer.tsx');expect(s).toContain('key!==identity.current');expect(s).toContain("event.target.closest('.imm-selection-tools')");});
 it('clears identity when the toolbar is dismissed and always restores a new selection',()=>{const s=read('src/immersion/SelectionStudyLayer.tsx');expect(s).toContain("identity.current='';setFocus(null)");expect(s).toContain('setFocus(f||null)');expect(s).toContain('dismiss();onOpen(selected,action)');});
 it('weather remains silent, bounded and reversible',()=>{const s=read('src/immersion/DesktopAtmosphere.tsx');expect(s).toContain('5000000');expect(s).toContain('reduced.matches');expect(s).toContain('connection?.saveData');expect(s).toContain('cancelAnimationFrame');expect(s).not.toMatch(/AudioContext|getUserMedia|fetch\(/);});
});
