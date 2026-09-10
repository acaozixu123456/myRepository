from pathlib import Path
old = '意味が(?:分か|わか)ら'
new = '意味が(?:分か|わか)(?:らない|りません)'
for name in ['src/companion/writtenFeedback.ts', 'supabase/functions/nihongo-companion/writtenContract.ts']:
    p = Path(name)
    text = p.read_text()
    if new not in text:
        assert text.count(old) == 1, name
        p.write_text(text.replace(old, new, 1))
assert Path('src/companion/writtenFeedback.ts').read_text() == Path('supabase/functions/nihongo-companion/writtenContract.ts').read_text()
p = Path('src/companion/writtenLane.ts')
text = p.read_text()
old = 'if(this.explicit&&this.unchanged(this.explicit)){this.deliver();return;}'
new = "if(this.explicit){if(this.unchanged(this.explicit)){this.deliver();return;}this.invalidate();this.failed=null;this.error('');}"
if new not in text:
    assert text.count(old) == 1
    p.write_text(text.replace(old, new, 1))
p = Path('src/companion/continuityRepair.test.ts')
text = p.read_text()
if 'a new audio item invalidates help even before ASR' not in text:
    text += r'''
describe('pre-transcript ownership',()=>{
 it('a new audio item invalidates help even before ASR',async()=>{
  vi.useFakeTimers();let resolve!:(v:unknown)=>void;let input!:NoteRequest;
  const request=vi.fn((r:NoteRequest,_signal:AbortSignal)=>{input=r;return new Promise(v=>{resolve=v;});});
  const publish=vi.fn(),lane=new WrittenLane(request,publish);
  const opening=line('opening','assistant','何が好きですか？');
  lane.update([opening],0);lane.help();await vi.advanceTimersByTimeAsync(250);
  lane.update([opening,line('new-audio','user','')],0);
  expect(request.mock.calls[0][1].aborted).toBe(true);
  resolve(raw(input));await vi.advanceTimersByTimeAsync(1);
  expect(publish).not.toHaveBeenCalled();lane.dispose();
 });
});
'''
    p.write_text(text)
