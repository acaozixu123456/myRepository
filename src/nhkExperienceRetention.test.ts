import {expect,it,vi} from 'vitest';
import {ChatExperienceStore,ChatExperienceSession,EXPERIENCE_KEY} from './nhkChatExperience';
const memory=()=>{const map=new Map<string,string>([['articles','keep']]);return{map,getItem:(k:string)=>map.get(k)||null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};};
it('prunes only expired UX observations on reopen',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));const m=memory();
 try{const store=new ChatExperienceStore(m);store.consent(true);const s=new ChatExperienceSession(store);s.mark('answer');s.finish();expect(store.count).toBe(1);vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));const reopened=new ChatExperienceStore(m);expect(reopened.count).toBe(0);expect(JSON.parse(m.map.get(EXPERIENCE_KEY)!).rows).toEqual([]);expect(m.map.get('articles')).toBe('keep');}finally{vi.useRealTimers();}
});
it('export cannot reintroduce expired UX observations',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));const m=memory();
 try{const store=new ChatExperienceStore(m);store.consent(true);const s=new ChatExperienceSession(store);s.mark('answer');s.finish();vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));expect(JSON.parse(store.export()).rows).toEqual([]);expect(JSON.parse(m.map.get(EXPERIENCE_KEY)!).rows).toEqual([]);expect(m.map.get('articles')).toBe('keep');}finally{vi.useRealTimers();}
});
