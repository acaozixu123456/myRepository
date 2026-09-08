import {describe,it,expect} from 'vitest';
import {singleChoiceQuestion} from './nhkTeacherChoice';
import {validTeacherTurn,type TeacherContext} from './nhkGentleTeacher';
import {buildChatPlan} from './nhkChat';
const c:TeacherContext={kind:'simplify',plan:buildChatPlan({id:'x',title:'x',sentences:['農林水産省が発表しました。']}),heard:'',history:[{role:'assistant',text:'どこで聞きましたか。'}]};
describe('one-question alternative wording from observed real outputs',()=>{
 it('makes the exact two learner choices into one question',()=>expect(singleChoiceQuestion('ニュースで？学校で？',['ニュースで','学校で'])).toBe('ニュースで、学校で、どちらですか。'));
 it('handles short adjective alternatives',()=>expect(singleChoiceQuestion('読みやすい？むずかしい？',['読みやすい','むずかしい'])).toBe('読みやすい、むずかしい、どちらですか。'));
 it.each([
  ['好きですか？よく見ますか？',['好きですか','よく見ますか']],
  ['いつ？どこ？',['いつ','どこ']],
  ['ニュースで？学校で？',['家で','学校で']],
  ['聞きました。ニュースで？学校で？',['ニュースで','学校で']],
  ['ニュースで？学校で？家で？',['ニュースで','学校で']],
 ])('leaves unrelated/multiple questions for rejection: %s',(say,words)=>expect(singleChoiceQuestion(say as string,words as string[])).toBe(say));
 it('still applies all pre-speech validator checks after normalization',()=>{
  const draft={say:'ニュースで？学校で？',words:['ニュースで','学校で'],starter:'…で聞きました。',example:'ニュースで聞きました。'};
  expect(validTeacherTurn(draft,c)?.say).toBe('ニュースで、学校で、どちらですか。');
  expect(validTeacherTurn({...draft,example:'米の値段が下がりました。'},c)).toBeNull();
  expect(validTeacherTurn({...draft,say:'好きですか？よく見ますか？',words:['好きですか','よく見ますか']},c)).toBeNull();
 });
});
