import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {readFileSync} from 'node:fs';
import {NeonSignal,NeonHero,voiceVisual} from './NeonStage';
import type {VoiceActivity} from '../nhkAudioActivity';
const quiet:VoiceActivity={micOn:false,input:'off',output:'idle',inputLevel:0,outputLevel:0,meterReady:false};
describe('truthful neon voice states',()=>{
 it('defaults to closed mic rather than a fake live connection',()=>expect(voiceVisual('ready',quiet).key).toBe('muted'));
 it('distinguishes open mic from received voice',()=>{expect(voiceVisual('ready',{...quiet,micOn:true,input:'ready'}).key).toBe('open');expect(voiceVisual('ready',{...quiet,micOn:true,input:'receiving'}).key).toBe('listening');});
 it('does not show listening from stale input activity while mic is off',()=>expect(voiceVisual('ready',{...quiet,input:'receiving'}).key).toBe('muted'));
 it('shows AI voice only when output is actually playing',()=>{expect(voiceVisual('thinking',{...quiet,output:'preparing'}).key).toBe('thinking');expect(voiceVisual('speaking',{...quiet,output:'playing'}).key).toBe('speaking');});
 it('prioritizes failure and playback permission over speaking art',()=>{expect(voiceVisual('error',{...quiet,output:'playing'}).key).toBe('offline');expect(voiceVisual('speaking',{...quiet,output:'blocked'}).key).toBe('blocked');});
 it('distinguishes pending connection and ended session',()=>{expect(voiceVisual('connecting',quiet).key).toBe('linking');expect(voiceVisual('closed',quiet).key).toBe('offline');});
 it('does not fabricate audio amplitude when inactive',()=>{const html=renderToStaticMarkup(createElement(NeonSignal,{level:1,active:false}));expect(html.match(/height:3px/g)?.length).toBe(25);});
 it('bounds invalid meter values',()=>{for(const level of [NaN,Infinity,-4,9]){const html=renderToStaticMarkup(createElement(NeonSignal,{level,active:true}));expect(html).not.toMatch(/NaN|Infinity|height:-/);}});
 it('keeps illustrated hero decorative and all copy actual HTML',()=>{const html=renderToStaticMarkup(createElement(NeonHero));expect(html).toContain('下一句');expect(html).toContain('/art/hitokoto-partner.webp');expect(html).not.toContain('https://');});
});
describe('neon presentation boundary',()=>{
 it('does not implement media, storage or remote calls in the art module',()=>{const s=readFileSync('src/companion/NeonStage.tsx','utf8');expect(s).not.toMatch(/getUserMedia\(|fetch\(|localStorage\.|new RTCPeerConnection/);});
 it('preserves the release marker of the verified conversation while identifying UI separately',()=>{const s=readFileSync('src/companion/CompanionApp.tsx','utf8');expect(s).toContain('data-release="repair-20260911"');expect(s).toContain('data-ui-release="neon-20260911"');expect(s).toContain('noteStillApplies(n,lines,writtenEnabled)');expect(s).toContain('retryWrittenHelp()');expect(s).toContain('toggleMic()');});
 it('provides system and explicit reduced-motion controls without faking scores',()=>{const s=readFileSync('src/companion/neon.css','utf8');expect(s).toContain('prefers-reduced-motion:reduce');expect(s).toContain('[data-motion=reduced]');const app=readFileSync('src/companion/CompanionApp.tsx','utf8');expect(app).toContain('霓虹动态效果');expect(app).not.toMatch(/Lv\.12|85\s*\/\s*100|86%|プラン|锁屏小组件/);});
});
