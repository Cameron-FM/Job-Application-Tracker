import { useState, useEffect, useRef } from 'react';
import { STAGE_CELEBRATION_EVENT } from '../stageEffects';

const COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

const LEVELS = {
  interview: { message: '🎯 Into interview stage!', pieceCount: 60, durationMs: 2200 },
  accepted: { message: '🎉 Offer accepted — congratulations!', pieceCount: 140, durationMs: 3200 },
};

function makePieces(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.8 + Math.random() * 1.2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotate: Math.round(Math.random() * 360),
    drift: Math.round((Math.random() - 0.5) * 160),
  }));
}

export default function StageCelebration() {
  const [active, setActive] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    function onCelebrate(e) {
      const config = LEVELS[e.detail?.level];
      if (!config) return;
      clearTimeout(timeoutRef.current);
      setActive({ ...config, pieces: makePieces(config.pieceCount), level: e.detail.level });
      timeoutRef.current = setTimeout(() => setActive(null), config.durationMs);
    }
    window.addEventListener(STAGE_CELEBRATION_EVENT, onCelebrate);
    return () => {
      window.removeEventListener(STAGE_CELEBRATION_EVENT, onCelebrate);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div className={`stage-celebration stage-celebration-${active.level}`}>
      {active.pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background: p.color,
            '--drift': `${p.drift}px`,
            '--rotate': `${p.rotate}deg`,
          }}
        />
      ))}
      <div className="stage-celebration-toast">{active.message}</div>
    </div>
  );
}
