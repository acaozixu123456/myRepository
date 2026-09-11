import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {SCENES,validScene,readScene,saveScene,CITY_SCENE_KEY,flightPose,trainPose,transitPose,screenState,ease} from './scenes';
import {musicLevel,clampVolume} from './music';
const read=(p:string)=>readFileSync(p,'utf8');
describe('approved illustrated scene definitions',()=>{
 it('provides four distinct scenes and original soundtracks',()=>{expect(SCENES).toHaveLength(4);expect(new Set(SCENES.map(s=>s.id)).size).toBe(4);expect(new Set(SCENES.map(s=>s.music)).size).toBe(4);});
 it.each(['skyport','canyon','harbor','rail','classic'])('accepts only listed scene %s',id=>expect(validScene(id)).toBe(true));
 it.each([null,'__proto__','https://evil.invalid/a','../../secret','',17])('rejects non-scene values %s',id=>expect(validScene(id)).toBe(false));
 it('preserves explicit native crop dimensions instead of claiming 4K',()=>{const p=JSON.parse(read('public/city05/provenance.json'));for(const s of SCENES){expect(p.scenes[s.id].nativeSize).toEqual(s.native);expect(p.scenes[s.id].upscaled).toBe(false);expect(s.native[0]).toBeLessThan(1000);}expect(read('src/city05/ScenePicker.tsx')).toContain('不是原生 4K');});
 it('uses one independent visual preference key',()=>{const writes:string[]=[];expect(saveScene({setItem:k=>{writes.push(k);}},'rail')).toBe(true);expect(writes).toEqual([CITY_SCENE_KEY]);});
 it('does not let unavailable storage break opening',()=>{expect(readScene({getItem:()=>{throw Error('denied');}})).toBe('skyport');expect(saveScene({setItem:()=>{throw Error('denied');}},'rail')).toBe(false);});
});
describe('independent time-based scene choreography',()=>{
 const pad={x:.5,y:.7};
 it.each([[2,'arrival'],[10,'landing'],[15,'docked'],[22,'takeoff'],[30,'departure'],[38,'away']])('has a real phase at %s seconds',(t,phase)=>expect(flightPose(Number(t),pad).phase).toBe(phase));
 it('lands then lifts rather than looping a static image timestamp',()=>{expect(flightPose(9,pad).y).toBeLessThan(flightPose(12,pad).y);expect(flightPose(20,pad).y).toBeGreaterThan(flightPose(24,pad).y);});
 it('has continuous visible phase boundaries',()=>{for(const t of [8,13,19,25,36]){const a=flightPose(t-.0001,pad),b=flightPose(t+.0001,pad);expect(Math.abs(a.x-b.x)).toBeLessThan(.001);expect(Math.abs(a.y-b.y)).toBeLessThan(.001);}});
 it('separates traffic lanes, train position and billboard content',()=>{expect(transitPose(1,0)).not.toEqual(transitPose(1,1));expect(trainPose(1,SCENES[3]).x).not.toBe(trainPose(9,SCENES[3]).x);expect(screenState(1,0).page).not.toBe(screenState(8,0).page);});
 it('limits easing outside its interval',()=>{expect(ease(-3)).toBe(0);expect(ease(3)).toBe(1);});
});
describe('background music yields to learning and capture',()=>{
 const silent={hidden:false,micOn:false,outputBusy:false,otherSpeech:false,studying:false,cue:false};
 it('starts disabled',()=>{expect(musicLevel(false,.18,silent)).toBe(0);expect(read('src/city05/music.tsx')).toContain('enabled:false,volume:.18');});
 it.each(['hidden','micOn','otherSpeech'])('is completely silent when %s',key=>expect(musicLevel(true,.18,{...silent,[key]:true})).toBe(0));
 it('ducks for Japanese playback, exercises and short earcons',()=>{expect(musicLevel(true,.18,{...silent,outputBusy:true})).toBeCloseTo(.0144);expect(musicLevel(true,.18,{...silent,studying:true})).toBeLessThan(.18);expect(musicLevel(true,.18,{...silent,cue:true})).toBeLessThan(.18);});
 it.each([NaN,Infinity,-1])('rejects invalid gain %s',n=>expect(clampVolume(n)).toBe(0));
 it('bounds volume independently of the system and speech levels',()=>expect(clampVolume(3)).toBe(.65));
 it('does not access microphones or provider credentials',()=>{const code=read('src/city05/music.tsx');expect(code).not.toContain('getUserMedia');expect(code).not.toContain('OPENAI');expect(code).not.toContain('localStorage');expect(code).not.toContain('fetch(');});
 it('scene selection cannot begin or reset a voice session',()=>{const source=read('src/companion/CompanionApp.tsx');const change=source.slice(source.indexOf('const chooseCity='),source.indexOf('useEffect(()=>{changeCityMusicScene'));expect(change).not.toContain('conn.');expect(change).not.toContain('begin(');expect(change).not.toContain('setLines(');});
});
