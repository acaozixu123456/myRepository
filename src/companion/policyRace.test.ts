import {describe,it,expect,vi,afterEach} from 'vitest';
vi.mock('../nhkAudioActivity',()=>({AudioActivityMeter:class{unlock(){}attach(){}detach(){}dispose(){}}}));
vi.mock('./api',()=>({companionApi:vi.fn(),sessionTicket:vi.fn(),stopSession:vi.fn(),fetchObservations:vi.fn()}));
import {CompanionConnection} from './connection';
import {freshPolicy,LOCAL_SEEDS} from './model';
import {fetchObservations} from './api';
function setup(){const hooks={phase:vi.fn(),lines:vi.fn(),activity:vi.fn(),notice:vi.fn(),error:vi.fn(),policy:vi.fn()};const c=new CompanionConnection(LOCAL_SEEDS[0],freshPolicy(),hooks);return {c,impl:c as any,hooks};}
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
describe('manual learning support takes priority over stale observations',()=>{
 it('manual request clears queued automatic difficulty proposal',()=>{const {c,impl}=setup();impl.nextPolicy={...freshPolicy(),target:3};const abort=impl.observerAbort=new AbortController();c.changeDifficulty(1);expect(abort.signal.aborted).toBe(true);expect(impl.nextPolicy).toBe(null);expect(impl.policy.target).toBe(1);c.dispose();});
 it('an old in-flight observation cannot undo a manual override',async()=>{const {c,impl,hooks}=setup();let resolve!:(v:any)=>void;vi.mocked(fetchObservations).mockImplementation(()=>new Promise(r=>resolve=r));impl.ticket={callId:'rtc_test',expiresAt:Date.now()+60000,token:'test'};impl.userTurns=5;for(let i=0;i<5;i++)impl.ledger.upsert('u'+i,'user',{text:'今日は映画を見ました。',delivered:true});const pending=impl.observe();c.changeDifficulty(1);resolve(Array.from({length:5},(_,i)=>({id:'u'+i,meaning:'clear',independence:'independent',complexity:3,comprehension:'comfortable'})));await pending;expect(impl.policy.target).toBe(1);expect(hooks.policy).toHaveBeenCalledTimes(1);c.dispose();});
 it('seeing a note marks support conservatively, not independent mastery',()=>{const {c,impl}=setup();const before=impl.policy.independent;c.exposeNote('n');expect(impl.pendingAssistance).toBe('hint');expect(impl.policy.independent).toBe(before);const epoch=impl.policyEpoch;c.exposeNote('n');expect(impl.policyEpoch).toBe(epoch);c.dispose();});
 it('written help never invokes native response creation or mic changes',()=>{const {c,impl}=setup();impl.emit=vi.fn();impl.written={help:vi.fn(),dispose:vi.fn()};c.writtenHelp();expect(impl.written.help).toHaveBeenCalledTimes(1);expect(impl.emit).not.toHaveBeenCalled();expect(impl.wantsMic).toBe(false);c.dispose();});
});
