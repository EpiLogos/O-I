import {createContext,useContext,type ReactNode} from "react";
import type {SituationFrame} from "./situation";

const SituationContext = createContext<SituationFrame | null>(null);

/** One read-only projection of what is present around the current act.
 * It owns no semantic state: workspace presentation, kernel/native readings
 * and session identity remain with their existing owners. */
export function SituationProvider({value,children}:{value:SituationFrame;children:ReactNode}) {
  return <SituationContext.Provider value={value}>{children}</SituationContext.Provider>;
}

/** Detached/minimal hosts may legitimately have no composed SituationFrame. */
export function useSituation(): SituationFrame | null {
  return useContext(SituationContext);
}
