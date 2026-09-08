import {describe,it,expect} from 'vitest';
import {sameThreadRescue} from './nhkTeacherRescue';
import {fallbackTeacherTurn,type TeacherContext} from './nhkGentleTeacher';
import {buildChatPlan} from './nhkChat';
describe('usable same-thread simplification even without a model draft',()=>{
 it('turns where-heard into usable locations, not generic reassurance',()=>{const t=sameThreadRescue('どこで聞きましたか。');expect(t.say).toBe('ニュースで、学校で、どちらですか。');expect(t.example).toBe('ニュースで聞きました。');});
 it('keeps an existing learner question and its choices',()=>{const t=sameThreadRescue('どんな動画が好きですか。',{words:['猫の動画','旅行の動画'],starter:'…が好きです。',example:'猫の動画が好きです。'});expect(t.say).toBe('猫の動画、旅行の動画、どちらですか。');expect(t.say).not.toContain('ニュース');});
 it('offers a small model for an already-binary question',()=>expect(sameThreadRescue('猫と犬、どちらですか。',{words:['猫','犬'],starter:'',example:'猫が好きです。'}).say).toBe('例えば、「猫が好きです」。'));
 it('never replaces a missing scaffold with a request to promise a short answer',()=>{const t=sameThreadRescue('よく見ますか。');expect(t.say).toBe('よく見ますか。');expect(t.example).not.toContain('短く答え');});
 it('connects fallbackTeacherTurn to actual same-question rescue',()=>{const c:TeacherContext={kind:'simplify',plan:buildChatPlan({id:'test',title:'NHK',sentences:['農林水産省が発表しました。']}),history:[],heard:'',previous:{say:'どこで聞きましたか。',words:['ニュースで','学校で'],starter:'…で聞きました。',example:'ニュースで聞きました。',origin:'model'}};expect(fallbackTeacherTurn(c).say).toBe('ニュースで、学校で、どちらですか。');});
});
