import {useEffect, useState} from 'react';
import {buildSceneVisual, sceneImageApiPath} from './visuals';
import type {Story} from './content';

type Props = {story: Story; className?: string; compact?: boolean};

export default function EpisodeVisual({story, className = '', compact = false}: Props) {
  const visual = buildSceneVisual(story);
  const [imageUrl, setImageUrl] = useState<string | null>(visual.imageUrl || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImageUrl(visual.imageUrl || null);
    setFailed(false);
    let active = true;
    void fetch(sceneImageApiPath(story.id))
      .then(r => r.json())
      .then((data: {status?: string; url?: string}) => {
        if (!active) return;
        if (data.status === 'ready' && data.url) setImageUrl(data.url);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [story.id, visual.imageUrl]);

  const showImage = imageUrl && !failed;

  return (
    <div
      className={`episode-visual ${compact ? 'compact' : ''} ${className}`.trim()}
      style={{background: visual.gradient}}
      aria-hidden={compact}
    >
      {showImage ? (
        <img src={imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="episode-visual-emoji">{story.emoji}</span>
      )}
    </div>
  );
}
