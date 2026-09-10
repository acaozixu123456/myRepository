import {describe,it,expect} from 'vitest';
import {HELP_PROPERTIES,prepareWrittenHelp} from '../../supabase/functions/nihongo-companion/writtenHelp';
import {validateWrittenNote,type NoteRequest} from './writtenFeedback';
const request:NoteRequest={requestId:'written-help-test-001',mode:'help',anchorId:'question',source:'昨日は何で忙しかったんですか。',target:0,context:[{id:'question',role:'assistant',text:'昨日は何で忙しかったんですか。',delivered:true,interrupted:false,assistance:'none'}]};
const validate=(raw:unknown)=>validateWrittenNote({...prepareWrittenHelp(raw),source:request.source},request);
describe('requested help separates unknown examples from known user meaning',()=>{
 it('requires a contextual basis rather than pretending the answer is known',()=>expect(HELP_PROPERTIES.basis.enum).toEqual(['learner_intent','illustrative','open_starter']));
 it('labels an unknown example in Japanese and Chinese',()=>{const n=validate({suggestion:'用事が多かったです。',basis:'illustrative',contextRespected:true});expect(n?.suggestion).toBe('例えば、用事が多かったです。');expect(n?.reasonZh).toContain('不代表你的实际情况');});
 it('does not duplicate an existing example prefix',()=>expect(prepareWrittenHelp({suggestion:'例えば、用事が多かったです。',basis:'illustrative',contextRespected:true}).suggestion).toBe('例えば、用事が多かったです。'));
 it('does not certify an example that contradicts known context',()=>expect(validate({suggestion:'猫を飼っています。',basis:'illustrative',contextRespected:false})).toBeNull());
 it('preserves an explicitly stated answer without an illustrative prefix',()=>{const n=prepareWrittenHelp({suggestion:'明日の午前に回答します。',basis:'learner_intent',contextRespected:true});expect(n.suggestion).toBe('明日の午前に回答します。');expect(n.supportBasis).toBe('learner_intent');});
 it('permits a neutral starter without inventing an answer',()=>{const n=validate({suggestion:'私の場合は…',basis:'open_starter',contextRespected:true});expect(n?.reasonZh).toContain('自己的意思');});
 it('rejects missing basis or an old ambiguous boolean response',()=>expect(validate({suggestion:'用事が多かったです。',meaningPreserved:true})).toBeNull());
 it('rejects truthy strings rather than treating them as validation',()=>expect(validate({suggestion:'用事が多かったです。',basis:'illustrative',contextRespected:'true'})).toBeNull());
});
