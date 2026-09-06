from pathlib import Path

world=Path('src/explore/world.ts')
s=world.read_text()
def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:220]
    s=s.replace(old,new)

rep("pause:(v:boolean)=>void;setMove:(x:number,y:number)=>void;look:(dx:number,dy:number)=>void;", "pause:(v:boolean)=>void;setMove:(x:number,y:number)=>void;look:(dx:number,dy:number)=>void;setHeroAnimation:(name:'idle'|'greet'|'talk',loop?:boolean)=>void;")
rep("pause(v){paused=v;clear();if(v){near=null;events.near(null);if(document.pointerLockElement===canvas)document.exitPointerLock();}},setMove,look,", "pause(v){paused=v;clear();if(v){near=null;events.near(null);if(document.pointerLockElement===canvas)document.exitPointerLock();}},setMove,look,setHeroAnimation(name,loop=true){heroArt?.play(name,loop);},")
rep("artAnimations:heroArt?.animationNames||[],heroProxyVisible:", "artAnimations:heroArt?.animationNames||[],artActiveAnimation:heroArt?.activeAnimation||null,heroProxyVisible:")
world.write_text(s)

main=Path('src/explore/main.ts')
m=main.read_text()
def mrep(old,new):
    global m
    if new in m:return
    assert m.count(old)==1,old[:220]
    m=m.replace(old,new)

mrep("let lastFocus:HTMLElement|null=null,toastTimer=0;", "let lastFocus:HTMLElement|null=null,toastTimer=0,conversationAnimationTimer=0;")
mrep("function closeModal(){speech.stop();$('modal-layer').hidden=true;", "function closeModal(){speech.stop();window.clearTimeout(conversationAnimationTimer);world?.setHeroAnimation('idle');$('modal-layer').hidden=true;")
mrep("if(id==='shop'){renderShop();void speech.play(currentSpeech);return;}", "if(id==='shop'){world?.setHeroAnimation('greet',false);window.clearTimeout(conversationAnimationTimer);conversationAnimationTimer=window.setTimeout(()=>world?.setHeroAnimation('talk'),900);renderShop();void speech.play(currentSpeech);return;}")
main.write_text(m)

css=Path('src/explore/cinematic-v3.css')
c=css.read_text()
def crep(old,new):
    global c
    if new in c:return
    assert c.count(old)==1,old[:220]
    c=c.replace(old,new)

crep("#explore-root #modal-layer{align-items:flex-end;justify-content:flex-start;padding:0 28px 22px;background:radial-gradient(ellipse at 22% 100%,rgba(4,11,8,.34),rgba(4,11,8,.07) 45%,transparent 72%);backdrop-filter:none}", "#explore-root #modal-layer{align-items:flex-end;justify-content:flex-start;padding:0 28px 24px;background:linear-gradient(0deg,rgba(5,12,9,.48),rgba(5,12,9,.12) 31%,transparent 55%);backdrop-filter:none}")
crep("#explore-root #modal-layer .panel,#explore-root #modal-layer .panel.wide{width:min(580px,calc(100vw - 56px));max-height:34vh;padding:12px 15px 10px;border-radius:15px;background:linear-gradient(180deg,rgba(18,29,25,.63),rgba(10,19,16,.84));color:#f5edda;border:1px solid rgba(241,228,198,.12);box-shadow:0 14px 46px #0007;backdrop-filter:blur(12px) saturate(.90);scrollbar-color:#756d5c transparent;overflow:auto}", "#explore-root #modal-layer .panel,#explore-root #modal-layer .panel.wide{width:min(540px,calc(100vw - 56px));max-height:32vh;padding:6px 4px 2px;border-radius:0;background:transparent;color:#f5edda;border:0;box-shadow:none;backdrop-filter:none;scrollbar-color:#756d5c transparent;overflow:auto;text-shadow:0 2px 12px rgba(0,0,0,.72)}")
crep("#modal-layer .panel-header{margin-bottom:9px;min-height:30px}", "#modal-layer .panel-header{margin-bottom:7px;min-height:24px;opacity:.72}")
crep("#modal-layer .icon-button{width:30px;height:30px;background:rgba(241,229,204,.10);color:#f2ead8}", "#modal-layer .icon-button{width:28px;height:28px;background:rgba(8,16,13,.42);color:#f2ead8;border-color:rgba(241,229,204,.08)}")
crep("#modal-layer .speaker-line{gap:9px}#modal-layer .avatar-dot{width:29px;height:29px;background:rgba(233,218,188,.12);color:#e9d8b8;border-color:rgba(238,223,194,.14)}", "#modal-layer .speaker-line{gap:0}#modal-layer .avatar-dot{display:none}")
crep("#modal-layer .spoken{background:rgba(242,230,204,.07);border:1px solid rgba(241,226,196,.07);border-radius:10px;padding:9px 12px}", "#modal-layer .spoken{background:transparent;border:0;border-radius:0;padding:0}")
crep("#modal-layer .spoken>p{color:#fff4de;font-size:15px;line-height:1.42}", "#modal-layer .spoken>p{color:#fff6e5;font-size:19px;line-height:1.38;font-weight:520;letter-spacing:.02em}")
crep("#modal-layer .voice-row{margin:7px 0 9px;padding-left:38px}", "#modal-layer .voice-row{margin:5px 0 8px;padding-left:0;opacity:.72}")
crep("#modal-layer .input-row input{padding:10px 13px;background:rgba(248,239,220,.09);border-color:rgba(238,225,197,.16);color:#fff7e7}", "#modal-layer .input-row input{padding:10px 13px;background:rgba(8,17,14,.66);border-color:rgba(238,225,197,.13);color:#fff7e7;box-shadow:0 7px 24px rgba(0,0,0,.18)}")
crep("#modal-layer .help-row{margin:7px 0;gap:14px}", "#modal-layer .help-row{margin:6px 0;gap:13px;opacity:.72}")
crep("#modal-layer .dialogue-footnote{font-size:8px;margin-top:8px;padding-top:7px;border-top-color:rgba(239,226,198,.08)}", "#modal-layer .dialogue-footnote{display:none}")
css.write_text(c)
