'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { VideoBackdrop } from './video-backdrop';

type MotionHeroProps = {
  title?: string;
  media?: 'a' | 'b' | 'c' | 'd';
};

/**
 * The redesigned front door. A point-cloud O:I field moves behind the title,
 * the whole block drifts and dims as the reader scrolls into the account.
 */
export function MotionHero({ title = 'Objective : Internality', media = 'b' }: MotionHeroProps) {
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
      const inner = root.querySelector<HTMLElement>('[data-hero-inner]');
      const frame = root.querySelector<HTMLElement>('[data-hero-frame]');

      if (frame) {
        gsap.fromTo(
          frame,
          { scale: 1, opacity: 1 },
          {
            scale: 1.06,
            opacity: 0.32,
            ease: 'none',
            scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
          },
        );
      }

      if (inner) {
        gsap.fromTo(
          inner,
          { yPercent: 0, opacity: 1 },
          {
            yPercent: -12,
            opacity: 0.05,
            ease: 'none',
            scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
          },
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
    <section className="hero-motion" ref={rootRef} aria-label="O:I opening statement">
      <div className="hero-motion__sticky">
        <div className="hero-motion__frame" data-hero-frame>
          <VideoBackdrop
            src={`./media/motion/oi-pointcloud-${media}.mp4`}
            poster="./media/motion/oi-pointcloud-poster-1.jpg"
            className="hero-motion__video"
          />
          <div className="hero-motion__scrim" aria-hidden="true" />
        </div>

        <div className="hero-motion__inner" data-hero-inner>
          <h1 className="hero-motion__title">{title}</h1>
          <p className="hero-motion__sub">Operating Infrastructure · Objective Internality</p>
        </div>

        <div className="hero-motion__cue" aria-hidden="true">
          <span>Scroll</span>
          <span className="hero-motion__cue-line" />
        </div>
      </div>
    </section>
  );
}
