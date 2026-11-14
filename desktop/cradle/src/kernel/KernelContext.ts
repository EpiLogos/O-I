/** The canonical kernel React context, without transport detection, boot,
 * subscriptions or a second projection. The composition root supplies its
 * existing API; the ordinary KernelProvider uses this same singleton. Written
 * without JSX so a module that only reads the context (encounter/session.ts,
 * the one send) loads where no JSX is compiled: Node's strip-only TypeScript
 * in the engine suite. */
import {createContext, createElement, useContext, type ReactNode} from 'react';
import type {KernelApi} from './KernelProvider';
export type {KernelApi} from './KernelProvider';

const KernelContext = createContext<KernelApi | null>(null);

export function useKernel(): KernelApi {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useKernel outside KernelProvider');
  return context;
}

export function KernelApiProvider({value, children}: {value: KernelApi; children: ReactNode}) {
  return createElement(KernelContext.Provider, {value}, children);
}
