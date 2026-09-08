import {expect,it} from 'vitest';
import {parseTurnSupport,localTurnSupport} from './nhkTurnSupport';
const frame=localTurnSupport('1-0-2','短い動画が好きですか。');
const value='{"turnKey":"1-0-2","words":["短いほう","長めも好き"],"starter":"私はどちらかというと","example":"短い動画のほうが見やすいです。"}';
it('accepts the bare equals presentation observed in production with all field and identity checks intact',()=>{expect(parseTurnSupport('='+value,frame)?.origin).toBe('model');expect(parseTurnSupport('=> '+value,frame)?.origin).toBe('model');expect(parseTurnSupport('='+value.replace('1-0-2','another-turn'),frame)).toBeNull();});
it('does not accept assignments, prose, concatenated objects, or executable suffixes',()=>{for(const text of ['value='+value,'Answer: '+value,'='+value+value,'='+value+';alert(1)'])expect(parseTurnSupport(text,frame)).toBeNull();});
