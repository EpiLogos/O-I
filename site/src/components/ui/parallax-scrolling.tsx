'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { OIMark } from '@/components/ui/oi-mark';

export function ParallaxComponent() {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = parallaxRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const triggerElement = root.querySelector<HTMLElement>('[data-parallax-layers]');
    const darkWipe = root.querySelector<HTMLElement>('[data-dark-wipe]');
    const lenis = new Lenis({
      smoothWheel: true,
      lerp: 0.09,
    });
    const ticker = (time: number) => lenis.raf(time * 1000);

    const context = gsap.context(() => {
      if (!triggerElement) return;

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      const layers = [
        { layer: '1', yPercent: 68, scale: 1.08 },
        { layer: '2', yPercent: 50, scale: 1.035 },
        { layer: '3', yPercent: 32, scale: 1.01 },
        { layer: '4', yPercent: 12, scale: 1 },
      ];

      layers.forEach((layer, index) => {
        timeline.to(
          triggerElement.querySelectorAll(`[data-parallax-layer="${layer.layer}"]`),
          {
            yPercent: layer.yPercent,
            scale: layer.scale,
            ease: 'none',
          },
          index === 0 ? 0 : '<',
        );
      });

      if (darkWipe) {
        timeline.fromTo(
          darkWipe,
          { scaleY: 0 },
          { scaleY: 1, ease: 'none', duration: 0.72 },
          0.12,
        );
      }
    }, root);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(ticker);
      context.revert();
      lenis.destroy();
    };
  }, []);

  return (
    <div className="parallax" ref={parallaxRef} aria-label="O:I visual identity">
      <section className="parallax__header">
        <div className="parallax__visuals">
          <div data-dark-wipe className="parallax__dark-wipe" aria-hidden="true" />

          <div data-parallax-layers className="parallax__layers">
            <div data-parallax-layer="1" className="parallax__layer parallax__layer--braces" aria-hidden="true">
              <OIMark piece="braces" />
            </div>
            <div data-parallax-layer="2" className="parallax__layer parallax__layer--ring" aria-hidden="true">
              <OIMark piece="ring" braces={false} />
            </div>
            <div data-parallax-layer="3" className="parallax__layer parallax__layer--colon" aria-hidden="true">
              <OIMark piece="colon" braces={false} />
            </div>
            <div data-parallax-layer="4" className="parallax__layer parallax__layer--bar" aria-hidden="true">
              <OIMark piece="bar" braces={false} />
            </div>
          </div>

          <div className="parallax__wordmark" aria-hidden="true">
            <span>OPERATING INFRASTRUCTURE</span>
            <span className="parallax__slash">/</span>
            <span>OBJECTIVE INTERNALITY</span>
          </div>

          <div className="parallax__scroll-cue" aria-hidden="true">
            scroll
          </div>
        </div>
      </section>
    </div>
  );
}
