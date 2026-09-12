import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const snapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** CSS owns timing; JS animations read the same tokens, including OS overrides. */
export function motionSettings() {
  const style = getComputedStyle(document.documentElement);
  const duration = (name: string, fallback: number) => {
    const value = style.getPropertyValue(name).trim();
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number * (value.endsWith('ms') ? 1 : 1000) : fallback;
  };
  return {
    fast: duration('--oi-motion-fast', 200),
    normal: duration('--oi-motion-normal', 320),
    slow: duration('--oi-motion-slow', 640),
    ease: style.getPropertyValue('--oi-motion-ease').trim() || 'cubic-bezier(0.22, 0.61, 0.2, 1)',
  };
}

type MotionState = { still: boolean; reduced: boolean; paused: boolean; toggle: () => void };
const MotionContext = createContext<MotionState>({ still: true, reduced: true, paused: false, toggle: () => {} });

export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useSyncExternalStore(subscribe, snapshot, () => true);
  const [paused, setPaused] = useState(false);
  return (
    <MotionContext.Provider value={{ still: reduced || paused, reduced, paused, toggle: () => setPaused(value => !value) }}>
      {children}
    </MotionContext.Provider>
  );
}

export const useMotion = () => useContext(MotionContext);

export function MotionControl() {
  const { reduced, paused, toggle } = useMotion();
  if (reduced) return null;
  return (
    <button className="motion-control" type="button" onClick={toggle} aria-pressed={paused} aria-label="Pause motion">
      <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
      <span>{paused ? 'Resume motion' : 'Pause motion'}</span>
    </button>
  );
}
