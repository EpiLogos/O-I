import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from '@studio-freight/lenis';
import { ShellMark } from './ShellMark';
import { VideoField } from './VideoField';
import { motionSettings, useMotion } from './motion';

gsap.registerPlugin(ScrollTrigger, CustomEase);

/** The field recedes first; the separated mark stays legible through the handoff. */
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
      // Spatial separation and visibility have different jobs. Do not tie a
      // layer's opacity to its travel: the outline must remain readable.
      [96, 54, 24, 7].forEach((distance, index) => {
        timeline.to(`[data-pl-layer="${index + 1}"]`, {
          yPercent: -distance,
          xPercent: [-4, -1, 2, 5][index],
          duration: 1,
        }, 0);
      });
      timeline.to('[data-pl-field]', { yPercent: -4, opacity: 0.12, duration: 1, ease: 'sine.inOut' }, 0);
      timeline.to('.pl__mark', { opacity: 0.78, duration: 0.55, ease: 'sine.inOut' }, 0.45);
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
          <VideoField media="b" poster={1} className="pl__video" zoom={1.12} shift={1} priority />
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
