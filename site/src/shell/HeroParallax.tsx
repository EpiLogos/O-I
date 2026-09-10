'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { ShellMark } from './ShellMark';
import { VideoField } from './VideoField';

/**
 * The original parallax hero, rebuilt for the point-cloud field: a light video
 * spills behind, the mark is drawn as thin black edges with a transparent body
 * so the dots reveal through every element, and the title sits on a dark wipe.
 */
export function HeroParallax() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ smoothWheel: true, lerp: 0.09 });
    const ticker = (time: number) => lenis.raf(time * 1000);

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
      });

      const layers = [
        { n: '1', out: 30 },
        { n: '2', out: 20 },
        { n: '3', out: 11 },
        { n: '4', out: 5 },
      ];

      layers.forEach((layer, index) => {
        timeline.to(
          root.querySelectorAll(`[data-pl-layer="${layer.n}"]`),
          {
            keyframes: [{ yPercent: 0 }, { yPercent: -layer.out }],
            ease: 'none',
          },
          index === 0 ? 0 : '<',
        );
      });

      timeline.to(
        root.querySelector('[data-pl-title]'),
        {
          keyframes: [
            { yPercent: 24, opacity: 0.15 },
            { yPercent: 0, opacity: 1 },
          ],
          ease: 'none',
        },
        0,
      );

      timeline.fromTo(
        root.querySelector('[data-pl-shade]'),
        { scaleY: 0.4, opacity: 0.6 },
        { scaleY: 1, opacity: 1, ease: 'none' },
        0,
      );
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
    <section className="pl" ref={rootRef} aria-label="O:I opening statement">
      <div className="pl__sticky">
        <VideoField media="b" poster={1} className="pl__video" zoom={1.12} />

        <div className="pl__shade" data-pl-shade aria-hidden="true" />

        <div className="pl__inner">
          <div className="pl__mark" aria-hidden="true">
            <div data-pl-layer="1" className="pl__layer">
              <ShellMark piece="braces" className="pl__piece" />
            </div>
            <div data-pl-layer="2" className="pl__layer">
              <ShellMark piece="ring" className="pl__piece" />
            </div>
            <div data-pl-layer="3" className="pl__layer">
              <ShellMark piece="colon" className="pl__piece" />
            </div>
            <div data-pl-layer="4" className="pl__layer">
              <ShellMark piece="bar" className="pl__piece" />
            </div>
          </div>

          <div className="pl__title-block" data-pl-title>
            <h1 className="pl__title">Objective : Internality</h1>
            <p className="pl__sub">Operating Infrastructure · Objective Internality</p>
          </div>
        </div>

      </div>
    </section>
  );
}
