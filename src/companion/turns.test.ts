import {describe,it,expect} from 'vitest';
import {NativeTurnGate} from './turns';
describe('native audio scheduling, not ASR completion',()=>{
 it('committed audio becomes ready without a transcript',()=>{const g=new NativeTurnGate();g.commit('one');expect(g.ready).toBe(true);expect(g.consume()).toEqual(['one']);expect(g.ready).toBe(false);});
 it('does not generate twice for one committed item',()=>{const g=new NativeTurnGate();g.commit('one');g.consume();g.finish();expect(g.commit('one')).toBe(false);expect(g.ready).toBe(false);});
 it('preserves two parts while a learner is still speaking',()=>{const g=new NativeTurnGate();g.commit('a');g.speaking=true;g.commit('b');expect(g.ready).toBe(false);g.speaking=false;expect(g.consume()).toEqual(['a','b']);});
 it('waits for an active response but preserves the next turn',()=>{const g=new NativeTurnGate();g.commit('a');g.consume();g.commit('b');expect(g.ready).toBe(false);g.finish();expect(g.ready).toBe(true);expect(g.consume()).toEqual(['b']);});
 it('explicit topic boundary clears pending jobs without allowing old duplicate IDs',()=>{const g=new NativeTurnGate();g.commit('old');g.clear();expect(g.ready).toBe(false);expect(g.commit('old')).toBe(false);expect(g.commit('new')).toBe(true);});
});
