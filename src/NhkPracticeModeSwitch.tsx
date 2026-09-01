import {BookOpen, Mic2} from 'lucide-react';
import type {NhkPracticeMode} from './nhkPracticeMode';

export default function NhkPracticeModeSwitch({
  value,
  onChange,
  compact = false,
}: {
  value: NhkPracticeMode;
  onChange: (mode: NhkPracticeMode) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`nhk-mode-switch ${compact ? 'compact' : ''}`.trim()}
      role="group"
      aria-label="学习方式"
    >
      <button
        type="button"
        className={value === 'voice' ? 'active' : ''}
        aria-pressed={value === 'voice'}
        onClick={() => onChange('voice')}
      >
        <Mic2 size={compact ? 16 : 18} />
        <span><strong>开口练习</strong><small>录音 · 转写 · 反馈</small></span>
      </button>
      <button
        type="button"
        className={value === 'quiet' ? 'active' : ''}
        aria-pressed={value === 'quiet'}
        onClick={() => onChange('quiet')}
      >
        <BookOpen size={compact ? 16 : 18} />
        <span><strong>静音学习</strong><small>默读 · 输入 · 复习</small></span>
      </button>
    </div>
  );
}
