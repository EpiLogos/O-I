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
    const title = root.querySelector<HTMLElement>('[data-parallax-title]');
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
        { layer: '1', out: 26, back: 0 },
        { layer: '2', out: 17, back: 0 },
        { layer: '3', out: 9, back: 0 },
        { layer: '4', out: 3, back: 0 },
      ];

      layers.forEach((layer, index) => {
        timeline.to(
          triggerElement.querySelectorAll(`[data-parallax-layer="${layer.layer}"]`),
          {
            keyframes: [
              { yPercent: layer.out, ease: 'none' },
              { yPercent: layer.back, ease: 'none' },
            ],
            ease: 'none',
          },
          index === 0 ? 0 : '<',
        );
      });

      if (title) {
        timeline.to(
          title,
          {
            keyframes: [
              { yPercent: 18, opacity: 0.2, ease: 'none' },
              { yPercent: 0, opacity: 1, ease: 'none' },
            ],
            ease: 'none',
          },
          0,
        );
      }

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

          <div data-parallax-title className="parallax__title" aria-hidden="true">
            Objective Internality
          </div>
        </div>
      </section>
    </div>
  );
}
