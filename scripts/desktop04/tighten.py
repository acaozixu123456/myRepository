from pathlib import Path

def replace(path,before,after):
 p=Path(path);s=p.read_text()
 if after in s:return
 assert s.count(before)==1,(path,before[:90]);p.write_text(s.replace(before,after,1))
# The card now has a separate source-text disclosure. Keep testing the original teaching disclosure.
replace('scripts/companion-continuity-phone.mjs',"await previous.locator('summary').click();","await previous.locator('.kc-note-detail > summary').click();")
p='src/companion/learningSound.tsx'
replace(p,"function playingMedia():boolean{return typeof document!=='undefined'&&Array.from(document.querySelectorAll('audio,video')).some(el=>el instanceof HTMLMediaElement&&!el.muted&&!el.paused&&!el.ended&&el.volume>0);}","""export function discreteMediaPlaying(el:Pick<HTMLMediaElement,'srcObject'|'muted'|'paused'|'ended'|'volume'>):boolean{
 // A continuous WebRTC stream remains playing during silence. Its actual voice activity is
 // guarded separately by updateLearningSoundGate; demo/replay media still use element state.
 return !el.srcObject&&!el.muted&&!el.paused&&!el.ended&&el.volume>0;
}
function playingMedia():boolean{return typeof document!=='undefined'&&Array.from(document.querySelectorAll('audio,video')).some(el=>el instanceof HTMLMediaElement&&discreteMediaPlaying(el));}""")
replace(p," const start=ctx.currentTime+.012,notes=CUE_NOTES[cue],strength=Math.max(0,Math.min(1,volume));"," if(!Number.isFinite(volume)||volume<=0)return 0;\n const start=ctx.currentTime+.012,notes=CUE_NOTES[cue],strength=Math.max(0,Math.min(1,volume));")
replace(p,"if(typeof document==='undefined'||!context||context.state!=='running'||!cueAllowed", "if(typeof document==='undefined'||!context||preferences.volume<=0||context.state!=='running'||!cueAllowed")
replace(p,"export function setLearningVolume(volume:number):void{if(!Number.isFinite(volume))return;preferences={...preferences,volume:Math.max(0,Math.min(1,volume))};publish();}","export function setLearningVolume(volume:number):void{if(!Number.isFinite(volume))return;if(volume<=0)stopLearningCues();preferences={...preferences,volume:Math.max(0,Math.min(1,volume))};publish();}")
p=Path('src/companion/desktopExperience.test.ts');s=p.read_text()
s=s.replace('CUE_NOTES,cueAllowed,scheduleLearningCue,','CUE_NOTES,cueAllowed,scheduleLearningCue,discreteMediaPlaying,')
if 'continuous remote stream may be silent' not in s:
 s+='''
describe('live media and zero-volume boundaries',()=>{
 it('a continuous remote stream may be silent; explicit voice activity remains authoritative',()=>{
  const state={srcObject:{} as MediaStream,muted:false,paused:false,ended:false,volume:1};
  expect(discreteMediaPlaying(state)).toBe(false);
  expect(cueAllowed(true,{micOn:false,outputBusy:true,hidden:false,mediaPlaying:false})).toBe(false);
 });
 it('a discrete audible replay still suppresses effects',()=>expect(discreteMediaPlaying({srcObject:null,muted:false,paused:false,ended:false,volume:1})).toBe(true));
 it.each([0,-1,NaN])('zero or invalid volume creates no oscillator: %s',volume=>{
  const ctx={createOscillator:()=>{throw Error('Must not create sound');}} as unknown as BaseAudioContext;
  expect(scheduleLearningCue(ctx,'progress',volume)).toBe(0);
 });
});
'''
p.write_text(s)
# App readiness is already asserted by its release marker and interactive controls. WebKit's
# document load can wait for decorative media; never make ready chat depend on that event.
replace('scripts/immersion/browser.mjs',"await page.goto(base+'/');", "await page.goto(base+'/',{waitUntil:'domcontentloaded'});")
replace('scripts/immersion/browser.mjs','await page.reload();',"await page.reload({waitUntil:'domcontentloaded'});")
replace('scripts/desktop04/acceptance.mjs',"await page.goto(base+'/');", "await page.goto(base+'/',{waitUntil:'domcontentloaded'});")
# Visual screenshot review: retain legible color during emphasis, undo old microphone min-height,
# and reserve the main column for the explicit exercise without deleting chat history.
replace('src/companion/desktopFocus.css','from{opacity:.55;transform:translateY(7px)}','from{opacity:1;transform:translateY(7px)}')
css=Path('src/companion/desktopFocus.css');s=css.read_text()
if '/* Reviewed desktop practice focus */' not in s:
 s+='''
/* Reviewed desktop practice focus */
@media(min-width:1100px){
.kc-root[data-desktop-release][data-view=chat] .kc-mic{min-height:56px;min-width:56px;aspect-ratio:1/1}
.kc-root[data-desktop-release][data-view=chat] .kc-header{height:66px;min-height:66px;margin-bottom:0;box-sizing:border-box}
.kc-root[data-desktop-release][data-practice=true] .kc-conversation>.kc-line{display:none}
.kc-root[data-desktop-release] .teacher-studio[data-step=feedback]>header{margin-bottom:5px;padding-bottom:4px}
.kc-root[data-desktop-release] .teacher-studio[data-step=feedback] .df-lesson-steps{margin-bottom:12px;padding-bottom:8px}
.kc-root[data-desktop-release] .teacher-studio[data-step=feedback] .df-feedback{margin-top:15px}
.kc-root[data-desktop-release] .teacher-studio[data-step=feedback] .df-result-heading{margin-bottom:12px}
.kc-root[data-desktop-release] .teacher-studio[data-step=feedback] .df-phrase-stage{padding:14px 18px}
.kc-root[data-desktop-release] .teacher-studio[data-step=feedback] .df-feedback-tools{margin:11px 0}
}
'''
 css.write_text(s)
replace('src/companion/CompanionApp.tsx',"const startPractice=(subject:Subject,previousScene='')=>{setScenery(false);", "const startPractice=(subject:Subject,previousScene='')=>{setNotice('');setScenery(false);")
print('Applied precise disclosure, sound priority, selection regression waits and screenshot-reviewed focus polish.')
