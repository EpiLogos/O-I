'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { ShellMark } from './ShellMark';

/**
 * The original parallax hero, reworked: the point-cloud O:I field runs behind,
 * and the mark is drawn as an outline so the dots reveal through its body.
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
        { n: '1', out: 26 },
        { n: '2', out: 17 },
        { n: '3', out: 9 },
        { n: '4', out: 3 },
      ];

      layers.forEach((layer, index) => {
        timeline.to(
          root.querySelectorAll(`[data-pl-layer="${layer.n}"]`),
          {
            keyframes: [{ yPercent: layer.out }, { yPercent: 0 }],
            ease: 'none',
          },
          index === 0 ? 0 : '<',
        );
      });

      timeline.to(
        root.querySelector('[data-pl-title]'),
        {
          keyframes: [
            { yPercent: 18, opacity: 0.2 },
            { yPercent: 0, opacity: 1 },
          ],
          ease: 'none',
        },
        0,
      );

      timeline.fromTo(
        root.querySelector('[data-pl-frame]'),
        { scale: 1 },
        { scale: 1.08, ease: 'none' },
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
        <div className="pl__frame" data-pl-frame>
          <video
            className="pl__video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="./media/motion/oi-pointcloud-poster-1.jpg"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src="./media/motion/oi-pointcloud-b.mp4" type="video/mp4" />
          </video>
        </div>

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

        <div className="pl__cue" aria-hidden="true">
          <span>Scroll</span>
          <span className="pl__cue-line" />
        </div>
      </div>
    </section>
  );
}
