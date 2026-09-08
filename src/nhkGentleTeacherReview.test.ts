import {describe,it,expect} from 'vitest';
import {buildChatPlan} from './nhkChat';
import {validTeacherTurn,fallbackTeacherTurn,type TeacherContext} from './nhkGentleTeacher';
const c:TeacherContext={kind:'answer',plan:buildChatPlan({id:'x',title:'NHK',sentences:['農林水産省は米の値段について発表しました。']}),heard:'はい、知っています。',history:[{role:'assistant',text:'農林水産省を知っていますか。'}]};
const v={say:'どこで聞きましたか。',words:['ニュースで'],starter:'…で聞きました。',example:'ニュースで聞きました。'};
describe('reviewed scaffolding bounds',()=>{
 it('does not reintroduce unrelated pricing in the optional example',()=>expect(validTeacherTurn({...v,example:'米の値段が下がりました。'},c)).toBeNull());
 it('does not hide abstract policy wording in a hint',()=>expect(validTeacherTurn({...v,words:['政策的な観点']},c)).toBeNull());
 it('does not duplicate final punctuation in help voice',()=>expect(fallbackTeacherTurn({...c,kind:'help',previous:{...v,origin:'model'}}).say).toBe('例えば、「ニュースで聞きました」。'));
});
