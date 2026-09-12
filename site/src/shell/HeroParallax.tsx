import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from '@studio-freight/lenis';
import { ShellMark } from './ShellMark';
import { VideoField } from './VideoField';
import { motionSettings, useMotion } from './motion';

gsap.registerPlugin(ScrollTrigger, CustomEase);

/** Composed at rest; one outward separation, then a quiet handoff to reading. */
export function HeroParallax() {
  const rootRef = useRef<HTMLElement>(null);
  const { still } = useMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || still) return;
    const lenis = new Lenis({ smoothWheel: true, lerp: 0.09 });
    const ticker = (time: number) => lenis.raf(time * 1000);
    const ease = CustomEase.create('oi-shell', motionSettings().ease.replace(/^cubic-bezier\(|\)$/g, ''));
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease },
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.35, invalidateOnRefresh: true },
      });
      [22, 15, 9, 4].forEach((distance, index) => {
        timeline.to(`[data-pl-layer="${index + 1}"]`, {
          yPercent: -distance,
          opacity: 0,
          duration: 0.9,
        }, 0.06 + index * 0.025);
      });
      timeline.to('[data-pl-field]', { yPercent: -4, opacity: 0.15, duration: 1 }, 0);
    }, root);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(ticker);
      context.revert();
      lenis.destroy();
    };
  }, [still]);

  return (
    <section className="pl" ref={rootRef} aria-label="O:I opening statement">
      <div className="pl__sticky">
        <div className="pl__field" data-pl-field>
          <VideoField media="b" poster={1} className="pl__video" zoom={1.03} shift={1} priority />
        </div>
        <div className="pl__inner">
          <div className="pl__mark" aria-hidden="true">
            {(['braces', 'ring', 'colon', 'bar'] as const).map((piece, index) => (
              <div key={piece} data-pl-layer={index + 1} className="pl__layer">
                <ShellMark piece={piece} className="pl__piece" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
