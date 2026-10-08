/** The canonical kernel React context, without transport detection, boot,
 * subscriptions or a second projection. The composition root supplies its
 * existing API; the ordinary KernelProvider uses this same singleton. */
import {createContext, useContext, type ReactNode} from 'react';
import type {KernelApi} from './KernelProvider';
export type {KernelApi} from './KernelProvider';

const KernelContext = createContext<KernelApi | null>(null);

export function useKernel(): KernelApi {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useKernel outside KernelProvider');
  return context;
}

export function KernelApiProvider({value, children}: {value: KernelApi; children: ReactNode}) {
  return <KernelContext.Provider value={value}>{children}</KernelContext.Provider>;
}
