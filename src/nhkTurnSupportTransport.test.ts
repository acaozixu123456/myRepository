import {expect,it} from 'vitest';
import {parseTurnSupport,localTurnSupport} from './nhkTurnSupport';
const frame=localTurnSupport('1-0-1','どんな動画を見るのが好きですか。');
const example='({"turnKey":"1-0-1","words":["音楽","料理"],"starter":"私はよく…系の動画を","example":"音楽のライブ映像を見るのが好きです。"})';
it('parses the exact parenthesized JSON observed in real API output without evaluating code',()=>{expect(parseTurnSupport(example,frame)?.origin).toBe('model');});
it('does not accept prose, executable expressions, multiple objects, wrong turns, or nested wrappers',()=>{for(const text of ['answer: '+example,example+';alert(1)','('+example+')',example+example,example.replace('1-0-1','wrong')])expect(parseTurnSupport(text,frame)).toBeNull();});
