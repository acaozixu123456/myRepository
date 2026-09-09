import {readFileSync,writeFileSync} from 'node:fs';
const patch=(p,a,b)=>{let s=readFileSync(p,'utf8');if(s.includes(b))return;if(!s.includes(a))throw new Error(`Missing reviewed repair: ${p}`);writeFileSync(p,s.replace(a,b));};
patch('src/nhkTopicCatalog.ts','(_,i)=>s.slice(i,i+2));','(_,i)=>s.slice(i,i+2)));');
patch('src/nhkTopicCatalog.ts','q.match(/[?？]|(?:ですか|ますか|でしたか|ましたか)[。]?/gu)','q.match(/(?:ですか|ますか|でしたか|ましたか)[。?？]?|[?？]/gu)');
writeFileSync('supabase/functions/nihongo-speaking-session/topicCatalog.ts',readFileSync('src/nhkTopicCatalog.ts','utf8'));
patch('src/nhkChatConnection.ts','this.canListen=false;this.mic(false);this.waiting=false;this.talking=false;clearTimeout(this.idle);clearTimeout(this.voiceLimit);','this.canListen=false;this.audioPlaying=false;this.mic(false);this.waiting=false;this.talking=false;clearTimeout(this.idle);clearTimeout(this.voiceLimit);');
patch('src/nhkChatConnection.ts','this.clipped=true;clearTimeout(this.voiceLimit);','this.clipped=true;this.audioPlaying=false;clearTimeout(this.voiceLimit);');
patch('src/NhkVoiceControls.tsx',":'对方在听';",":'对方等待中';");
patch('src/nhkTopicDeck.ts',"  status='';","  private lastId='';\n  status='';");
patch('src/nhkTopicDeck.ts','    const topics=this.topics();const current=','    currentId=this.lastId||currentId;const topics=this.topics();const current=');
patch('src/nhkTopicDeck.ts','    if(choice){this.data.seen.push','    if(choice){this.lastId=choice.id;this.data.seen.push');
patch('supabase/functions/nihongo-speaking-session/index.ts','if(body.plan?.generated&&(!plan||!await verifyTopic','if(body.plan?.generated&&(!plan||body.plan.topicId!==body.plan.generated.topic?.id||!await verifyTopic');
patch('src/NhkSpeakingCoach.tsx',"import {HandHelping,LoaderCircle,Mic,MicOff,Shuffle,Volume2,X}","import {HandHelping,Mic,Shuffle,Volume2,X}");
patch('src/NhkSpeakingCoach.tsx','const seen=useRef<string[]>([topicId]);','/* topic history is owned by the per-article deck */');
const testPath='src/nhkChatConnection.test.ts';let tests=readFileSync(testPath,'utf8');
if(!tests.includes('output state resets when cancelling')){tests+=`\nit('output state resets when cancelling a speaking turn',async()=>{hooks.activity=vi.fn();await c.start();(c as any).mediaPlaying=true;emit({type:'response.created',response:{id:'speaking'}});emit({type:'output_audio_buffer.started',response_id:'speaking'});expect(hooks.activity.mock.calls.at(-1)[0].output).toBe('playing');c.repeat();expect(hooks.activity.mock.calls.at(-1)[0].output).not.toBe('playing');});\n`;writeFileSync(testPath,tests);}
