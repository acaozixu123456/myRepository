from pathlib import Path
import numpy as np,subprocess,json,hashlib,wave
out=Path('public/city05');meta=json.loads((out/'provenance.json').read_text());sr=24000
for k,(scene,bpm,rootnote) in enumerate([('skyport',76,45),('canyon',84,48),('harbor',68,40),('rail',88,47)]):
    dest=out/(scene+'.mp3')
    if dest.exists() and 'music' in meta['scenes'][scene]:continue
    beat=60/bpm;seconds=beat*64;n=round(seconds*sr);buf=np.zeros((n,2),dtype=np.float32);rng=np.random.default_rng(500+k)
    def note(midi,start,duration,gain,pan=0,kind='pad'):
        dur=round(duration*sr);t=np.arange(dur)/sr;freq=440*2**((midi-69)/12)
        if kind=='pad':sig=sum(np.sin(2*np.pi*freq*h*t)/h**2.5 for h in [1,2,3,4])*np.minimum(1,t/.35)*np.minimum(1,(duration-t)/.8)*.65
        elif kind=='pluck':sig=(np.sin(2*np.pi*freq*t)+.22*np.sin(2*np.pi*2*freq*t))*np.exp(-t*6)*np.minimum(1,t/.009)
        elif kind=='bass':sig=np.sin(2*np.pi*freq*t)*np.minimum(1,t/.035)*np.exp(-t*1.5)*np.minimum(1,(duration-t)/.05)
        elif kind=='tick':sig=rng.normal(0,1,dur)*np.exp(-t*90)*np.minimum(1,t/.004)
        else:sig=np.sin(2*np.pi*(42*t+8*(1-np.exp(-t*18))))*np.exp(-t*15)*np.minimum(1,t/.005)
        inds=(np.arange(dur)+round(start*sr))%n
        for c,g in enumerate([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)]):np.add.at(buf[:,c],inds,(sig*gain*g).astype(np.float32))
    progression=[0,5,8,3,0,10,8,5]
    for bar in range(16):
        r=rootnote+progression[bar%8]
        if bar%2==0:
            for i,interval in enumerate([0,7,10,14]):note(r+12+interval,bar*4*beat,beat*8.3,.12,(-.4+i*.27),'pad')
        for b in [0,2]:note(r,(bar*4+b)*beat,beat*1.7,.12,0,'bass')
        arp=[12,19,22,26,22,19,17,19]
        for a in range(8):
            if (a+bar)%3!=0:note(r+arp[(a+bar)%8],(bar*4+a*.5)*beat,beat*1.9,.065,np.sin(a)*.45,'pluck')
        if k!=2:
            for b in [0,2]:note(30,(bar*4+b)*beat,.23,.075,0,'kick')
            for b in [1.5,3.5]:note(80,(bar*4+b)*beat,.075,.021,.3,'tick')
    orig=buf.copy()
    for delay,g in [(beat*.75,.20),(beat*1.5,.10)]:buf+=np.roll(orig,round(delay*sr),axis=0)*g
    buf=np.tanh(buf*.72);peak=float(np.abs(buf).max());buf*=.56/max(peak,.56)
    temp=out/(scene+'.wav')
    with wave.open(str(temp),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((buf*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(temp),'-codec:a','libmp3lame','-b:a','128k',str(dest)],check=True);temp.unlink()
    meta['scenes'][scene]['music']={'bpm':bpm,'seconds':seconds,'originalComposition':True,'maxAmplitude':min(peak,.56),'path':'/city05/'+dest.name,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
(out/'provenance.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print('Four original instrumental tracks saved; no API calls, no game soundtrack sampling.')
