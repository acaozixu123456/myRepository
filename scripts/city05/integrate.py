from pathlib import Path
import hashlib
p=Path('src/companion/CompanionApp.tsx');s=p.read_text()
if 'data-city-release="city-20260911-v5"' in s:
    print('CITY05 integration already committed; verify only.');raise SystemExit(0)
for name,digest in {'src/companion/CompanionApp.tsx':'21baa6c39b47bbdd30e84ea1c1661eaddbcfe8fdbe5bac05cd6f7babad57bba7','src/companion/main.tsx':'4877734fee840ccd3e48094fd5aa3ec3b9d86b0969a62c220f44c786d27ad856'}.items():
    assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest, 'Unreviewed baseline: '+name

def r(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:90]);s=s.replace(a,b,1)
s="import {CityStage} from '../city05/CityStage';\nimport {ScenePicker} from '../city05/ScenePicker';\nimport {CityMusicControl,changeCityMusicScene,updateCityMusicGate,hushCityMusic,disposeCityMusic} from '../city05/music';\nimport {readScene,saveScene,sceneById,type SceneId} from '../city05/scenes';\n"+s
r('export default function CompanionApp(){',"export default function CompanionApp(){\n  const [cityScene,setCityScene]=useState<SceneId>(()=>{try{return readScene(localStorage);}catch{return 'skyport';}});\n  const chooseCity=(id:SceneId)=>{setCityScene(id);try{saveScene(localStorage,id);}catch{}changeCityMusicScene(id);};\n  useEffect(()=>{changeCityMusicScene(cityScene);},[cityScene]);\n  useEffect(()=>()=>disposeCityMusic(),[]);")
r("  const readingNote=useRef(false),followBottom=useRef(true),lastLearner=useRef('');","  useEffect(()=>{updateCityMusicGate({micOn:activity.micOn||activity.input==='requesting',outputBusy:activity.output!=='idle',studying:studyOpen||!!practice});},[activity.micOn,activity.input,activity.output,studyOpen,practice]);\n  const readingNote=useRef(false),followBottom=useRef(true),lastLearner=useRef('');")
r("updateLearningSoundGate({micOn:a.micOn||a.input==='requesting',outputBusy:a.output!=='idle'});","updateCityMusicGate({micOn:a.micOn||a.input==='requesting',outputBusy:a.output!=='idle'});updateLearningSoundGate({micOn:a.micOn||a.input==='requesting',outputBusy:a.output!=='idle'});")
r('data-desktop-release="desktop-20260911-v4"','data-desktop-release="desktop-20260911-v4" data-city-release="city-20260911-v5" data-city-choice={cityScene}')
r('<AmbientStage key={ambientKey} quality={quality} motion={motionOn} paused={studyOpen||!!sheet} onStatus={setAmbientStatus}/>','<AmbientStage key={ambientKey} quality={quality} motion={cityScene===\'classic\'&&motionOn} paused={studyOpen||!!sheet} onStatus={setAmbientStatus}/>\n    {cityScene!==\'classic\'&&<CityStage key={\'city-\'+ambientKey} scene={cityScene} quality={quality} motion={motionOn} paused={studyOpen||(!!sheet&&sheet!==\'scene\')} onStatus={setAmbientStatus}/> }')
r("{desktop?'DESKTOP / 04':'IMMERSION / 03'}","{'CITY / 05'}")
r('<SceneIcon size={12}/> 风景</button></div>','<SceneIcon size={12}/> 风景</button><CityMusicControl compact/></div>')
r('>RAIN / MIDNIGHT<small>此刻，只说你想说的一句。</small>',">{cityScene==='classic'?'RAIN / MIDNIGHT':sceneById(cityScene).subtitle}<small>此刻，只说你想说的一句。</small>")
r('onClick={()=>{stopLearningCues();void conn.current?.toggleMic();}}','onClick={()=>{hushCityMusic();stopLearningCues();void conn.current?.toggleMic();}}')
r("sheet==='scene'?'雨夜 · 新东京'","sheet==='scene'?'城市与背景音乐'")
r('<b>DESKTOP / 04</b>','<b>CITY / 05</b>')
r('<section className="teacher-preferences">','<CityMusicControl/><section className="teacher-preferences">')
r('<section className="imm-scene-settings"><small>IMMERSION 03 · AMBIENT STUDIO</small><h3>雨夜 · 新东京</h3><p>城市灯海、窗边雨痕与夜行车流。风景静音，与你的语音完全分开。</p>','<section className="imm-scene-settings"><ScenePicker value={cityScene} onChange={chooseCity}/><CityMusicControl/>')
r('原创 AI 环境母图＋分层动画，横竖独立构图；静音循环，不在聊天时实时渲染整座城市。超清会增加下载与解码负担，掉帧时自动降低画质。','四套新风景：原画裁切＋独立载具、屏幕和粒子实时动态，不是完整3D场景。原来的雨夜保留4K静音循环。渲染精度不是底图的原生分辨率。')
p.write_text(s)
p=Path('src/companion/main.tsx');p.write_text(p.read_text()+"\nimport '../city05/city05.css';\n")
print('CITY05 UI integration applied; backend, native voice and study storage unchanged.')
