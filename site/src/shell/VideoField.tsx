import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMotion } from './motion';

type VideoFieldProps = {
  media: 'a' | 'b' | 'c' | 'd';
  poster?: 1 | 2 | 3;
  className?: string;
  zoom?: number;
  shift?: number;
  priority?: boolean;
};

/** A still always exists; video is an enhancement, never native autoplay. */
export function VideoField({ media, poster = 1, className, zoom = 1.03, shift = 0, priority = false }: VideoFieldProps) {
  const { still } = useMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const root = rootRef.current;
    setPlaying(false);
    if (still || !video || !root) return;
    let visible = false;
    let disposed = false;
    const sync = () => {
      if (disposed || !visible || document.hidden) {
        video.pause();
        return;
      }
      video.muted = true;
      void video.play().then(() => {
        // A play promise may settle after the tab, route or visibility changed.
        if (disposed || !visible || document.hidden) video.pause();
      }).catch(() => { if (!disposed) setPlaying(false); });
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { threshold: 0 });
    observer.observe(root);
    document.addEventListener('visibilitychange', sync);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      video.pause();
    };
  }, [media, still]);

  const style = { '--vf-zoom': zoom, '--vf-shift': `${shift}%` } as CSSProperties;
  const posterUrl = `./media/motion/oi-pointcloud-poster-${poster}.jpg`;
  return (
    <div ref={rootRef} className={`vf${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" data-media-state={still ? 'still' : playing ? 'video' : 'poster'}>
      <div className="vf__frame">
        <img className="vf__poster" src={posterUrl} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" />
        {!still && (
          <video
            key={media}
            ref={videoRef}
            className={`vf__video${playing ? ' vf__video--ready' : ''}`}
            muted loop playsInline preload="none" tabIndex={-1}
            onPlaying={() => setPlaying(true)} onError={() => setPlaying(false)}
          >
            <source src={`./media/motion/oi-pointcloud-${media}.mp4`} type="video/mp4" />
          </video>
        )}
      </div>
    </div>
  );
}
