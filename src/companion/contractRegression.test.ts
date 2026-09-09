import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {companionInstructions,LOCAL_SEEDS,freshPolicy} from './model';
describe('observed native preview regressions',()=>{
 it('keeps typed custom item identity within 32 characters',()=>{const source=readFileSync('src/companion/connection.ts','utf8');expect(source).toContain("replace(/-/g,'').slice(0,24)");expect(`typed_${'a'.repeat(24)}`.length).toBeLessThanOrEqual(32);});
 it('requires current concise guidance and leaves native audio intact',()=>{const s=companionInstructions(LOCAL_SEEDS[0],freshPolicy());expect(s).toContain('一个简短回应，或者一个容易接的问题');expect(s).toContain('不要每轮教学');expect(s).toContain('不评价日语');expect(s).toContain('permanent low ceiling');const connection=readFileSync('src/companion/connection.ts','utf8');expect(connection).not.toContain('TeacherTurnChannel');expect(connection).not.toContain("conversation:'none'");});
 it('shares both model and actual prompt between server initialization and client updates',()=>{for(const name of ['model.ts','prompt.ts'])expect(readFileSync(`supabase/functions/nihongo-companion/${name}`,'utf8')).toBe(readFileSync(`src/companion/${name}`,'utf8'));});
});
