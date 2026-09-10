import {describe,it,expect,vi,afterEach} from 'vitest';
import {WrittenLane,noteStillApplies} from './writtenLane';
import type {Line} from './model';
import type {WrittenNote} from './writtenFeedback';
const line=(id:string,role:Line['role'],text:string):Line=>({id,role,text,delivered:true,interrupted:false,assistance:'none',previous:'',seq:0});
const note:WrittenNote={id:'n',anchorId:'u',source:'昨日',kind:'extension',suggestion:'昨日は休みでした。',reasonZh:'一个例子',detailZh:'',mode:'auto'};
afterEach(()=>vi.useRealTimers());
describe('no old-fragment correction or invisible automatic activity',()=>{
 it('withholds a note if a new fragment follows before any answer was heard',()=>expect(noteStillApplies(note,[line('u','user','昨日'),line('u2','user','映画を見ました')])).toBe(false));
 it('keeps a historical note next to the original turn, not next to the next answer',()=>expect(noteStillApplies(note,[line('u','user','昨日'),line('a','assistant','映画ですね。'),line('u2','user','はい')])).toBe(true));
 it('automatic off hides auto but leaves explicit help',()=>{expect(noteStillApplies(note,[line('u','user','昨日')],false)).toBe(false);expect(noteStillApplies({...note,mode:'help'},[line('u','user','昨日')],false)).toBe(true);});
 it('does not reanalyse an earlier sentence when a later audio item has no final transcript',async()=>{vi.useFakeTimers();const request=vi.fn();const lane=new WrittenLane(request,vi.fn());lane.update([line('u','user','昨日'),line('u2','user','')],0);await vi.advanceTimersByTimeAsync(2000);expect(request).not.toHaveBeenCalled();lane.dispose();});
 it('does not retry a failed automatic request at each silence event',async()=>{vi.useFakeTimers();const request=vi.fn().mockRejectedValue(new Error('503'));const lane=new WrittenLane(request,vi.fn());lane.update([line('u','user','昨日')],0);await vi.advanceTimersByTimeAsync(1500);for(let i=0;i<4;i++){lane.setSpeaking(true);lane.setSpeaking(false);await vi.advanceTimersByTimeAsync(1200);}expect(request).toHaveBeenCalledTimes(1);lane.dispose();});
});
