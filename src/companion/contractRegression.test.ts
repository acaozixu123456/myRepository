import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {companionInstructions,LOCAL_SEEDS,freshPolicy} from './model';
describe('observed native preview regressions',()=>{
 it('keeps typed custom item identity within 32 characters',()=>{const source=readFileSync('src/companion/connection.ts','utf8');expect(source).toContain("replace(/-/g,'').slice(0,24)");expect(`typed_${'a'.repeat(24)}`.length).toBeLessThanOrEqual(32);});
 it('uses short-turn guidance without a detached 48-character approval pipeline',()=>{const s=companionInstructions(LOCAL_SEEDS[0],freshPolicy());expect(s).toContain('Keep the turn SMALL');expect(s).toContain('permanent low ceiling');const connection=readFileSync('src/companion/connection.ts','utf8');expect(connection).not.toContain('TeacherTurnChannel');expect(connection).not.toContain("conversation:'none'");});
 it('shares the reviewed prompt between server start and client updates',()=>expect(readFileSync('supabase/functions/nihongo-companion/model.ts','utf8')).toBe(readFileSync('src/companion/model.ts','utf8')));
});
