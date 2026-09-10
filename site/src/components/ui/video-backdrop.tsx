'use client';

import { useEffect, useRef, useState } from 'react';

type VideoBackdropProps = {
  src: string;
  poster?: string;
  className?: string;
};

/**
 * Full-bleed looping video used as a moving background.
 * Muted, inline, metadata-preloaded, and it degrades to the poster
 * (or nothing) when the visitor prefers reduced motion.
 */
export function VideoBackdrop({ src, poster, className }: VideoBackdropProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    video.muted = true;
    const play = () => {
      const attempt = video.play();
      if (attempt) attempt.catch(() => {});
    };
    play();

    const onVisibility = () => {
      if (!document.hidden) play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [src, reducedMotion]);

  if (reducedMotion) {
    if (poster) return <img src={poster} alt="" className={className} aria-hidden="true" loading="lazy" />;
    return null;
  }

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
