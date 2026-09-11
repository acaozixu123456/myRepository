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
print('Narrow fixture selector, native-stream silence and exact zero-volume guards applied.')
