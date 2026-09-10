'use client';

import { useEffect, useRef } from 'react';

type VideoFieldProps = {
  media: 'a' | 'b' | 'c' | 'd';
  poster?: 1 | 2 | 3;
  className?: string;
  zoom?: number;
};

/**
 * A remake-material video used as a moving field. Zoomed past its edges and
 * feathered with a mask in CSS so it spills over and dissolves into the page.
 */
export function VideoField({ media, poster = 1, className, zoom = 1.3 }: VideoFieldProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
  }, []);

  return (
    <div className={`vf${className ? ` ${className}` : ''}`} aria-hidden="true">
      <video
        ref={videoRef}
        className="vf__video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={`./media/motion/oi-pointcloud-poster-${poster}.jpg`}
        style={{ transform: `scale(${zoom})` }}
        tabIndex={-1}
      >
        <source src={`./media/motion/oi-pointcloud-${media}.mp4`} type="video/mp4" />
      </video>
    </div>
  );
}
