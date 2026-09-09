import {describe,it,expect} from 'vitest';
import {requestedTurnInstructions} from './requestedTurn';
import {freshPolicy,LOCAL_SEEDS,type Line} from './model';
const seed=LOCAL_SEEDS[0];const line=(id:string,role:Line['role'],text:string,extra:Partial<Line>={}):Line=>({id,role,text,previous:'',delivered:true,interrupted:false,assistance:'none',seq:0,...extra});
describe('explicit help is not an ordinary confirmation',()=>{
 it('leaves ordinary native conversation unchanged',()=>expect(requestedTurnInstructions('answer',[],seed,freshPolicy())).toBeUndefined());
 it('prioritizes the requested scaffold, preserving Chinese negation',()=>{const p=requestedTurnInstructions('help',[line('u','user','我不养猫，只喜欢猫的视频。'),line('a','assistant','明白了。')],seed,freshPolicy())!;expect(p).toContain('必须先说日语');expect(p).toContain('我不养猫');expect(p).not.toContain('# 第一优先级：接话');expect(p).not.toContain('SEED_DATA');});
 it('uses only audible completed assistant context',()=>{const p=requestedTurnInstructions('repeat',[line('a','assistant','猫の動画ですか。'),line('b','assistant','unplayed',{delivered:false}),line('c','assistant','interrupted',{interrupted:true})],seed,freshPolicy())!;expect(p).toContain('猫の動画ですか');expect(p).not.toContain('unplayed');expect(p).not.toContain('interrupted');});
 it('bounds optional quoted context without adding messages',()=>{const lines=Array.from({length:20},(_,i)=>line(String(i),'user','語'.repeat(900)));const p=requestedTurnInstructions('help',lines,seed,freshPolicy())!;expect(p.length).toBeLessThan(7000);expect(p).not.toContain('conversation.item.create');});
 it('keeps opening and topic instructions but does not pull help back to news',()=>{expect(requestedTurnInstructions('opening',[],seed,freshPolicy())).toContain('SEED_DATA');expect(requestedTurnInstructions('help',[],seed,freshPolicy())).not.toContain('SEED_DATA');});
});
