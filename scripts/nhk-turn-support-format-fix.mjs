import {readFileSync,writeFileSync} from 'node:fs';
const path='src/nhkTurnSupport.ts';let s=readFileSync(path,'utf8');
if(!s.includes('turnSupportJson')){
 const a=s.indexOf('    // Realtime sometimes encloses JSON'),b=s.indexOf('    if(!raw||raw.turnKey');
 if(a<0||b<a)throw new Error('Parser normalization anchor changed');
 s="import {turnSupportJson} from './nhkTurnSupportFormat';\n"+s.slice(0,a)+"    const raw=turnSupportJson(text) as any;\n"+s.slice(b);
 writeFileSync(path,s);
}
