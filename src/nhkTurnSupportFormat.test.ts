import {expect,it} from 'vitest';
import {turnSupportJson} from './nhkTurnSupportFormat';
import {parseTurnSupport,localTurnSupport} from './nhkTurnSupport';
const raw='{"turnKey":"1-0-1","words":["音楽","料理"],"starter":"よく見るのは、","example":"音楽の動画をよく見ます。"}';
it('accepts plain, blockquote, fenced and one-pair-parenthesized JSON presentations',()=>{for(const text of [raw,'>'+raw,'> '+raw,'```json\n'+raw+'\n```','('+raw+')'])expect(turnSupportJson(text)).toEqual(JSON.parse(raw));});
it('rejects surrounding prose, multiple objects and executable suffixes',()=>{for(const text of ['Answer: '+raw,raw+raw,raw+';alert(1)','(('+raw+'))'])expect(()=>turnSupportJson(text)).toThrow();});
it('preserves all turn and field validation after normalizing observed blockquotes',()=>{const f=localTurnSupport('1-0-1','何の動画を見ますか。');expect(parseTurnSupport('>'+raw,f)?.origin).toBe('model');expect(parseTurnSupport('>'+raw.replace('1-0-1','other'),f)).toBeNull();});
