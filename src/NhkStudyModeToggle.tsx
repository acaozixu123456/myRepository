import {BookOpen, Mic2} from 'lucide-react';
import type {NhkStudyMode} from './nhkStudyMode';

export default function NhkStudyModeToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: NhkStudyMode;
  onChange: (mode: NhkStudyMode) => void;
  compact?: boolean;
}) {
  return (
    <div className={`nhk-study-mode ${compact ? 'compact' : ''}`} role="group" aria-label="学习方式">
      <button
        type="button"
        className={mode === 'voice' ? 'active' : ''}
        aria-pressed={mode === 'voice'}
        onClick={() => onChange('voice')}
      >
        <Mic2 size={17} />
        <span><strong>开口练习</strong>{!compact && <small>录音、转写和反馈</small>}</span>
      </button>
      <button
        type="button"
        className={mode === 'quiet' ? 'active' : ''}
        aria-pressed={mode === 'quiet'}
        onClick={() => onChange('quiet')}
      >
        <BookOpen size={17} />
        <span><strong>安静学习</strong>{!compact && <small>默读、书写和复习</small>}</span>
      </button>
    </div>
  );
}
