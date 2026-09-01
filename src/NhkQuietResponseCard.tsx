import {BookOpen, ShieldCheck} from 'lucide-react';

export default function NhkQuietResponseCard({
  title,
  description,
  prompt,
  value,
  onChange,
  placeholder,
  rows = 4,
  optional = false,
}: {
  title: string;
  description: string;
  prompt?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  optional?: boolean;
}) {
  return (
    <div className="nhk-quiet-response">
      <div className="nhk-quiet-response-head">
        <BookOpen size={20} />
        <div><strong>{title}</strong><small>{description}</small></div>
      </div>
      {prompt && <blockquote>{prompt}</blockquote>}
      <label>
        <span>{optional ? '可选：写下关键词或一句回答' : '用日语写下你的回答'}</span>
        <textarea
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      </label>
      <p><ShieldCheck size={15} />不会打开麦克风，也不计入语音评分。</p>
    </div>
  );
}
