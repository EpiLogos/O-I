import {useEffect, useRef} from "react";
import type {KernelTransportStatus} from "../kernel/types";
import {currentFieldContext, subscribeField} from "../field/fieldHost";
import {fieldContextKept, fieldContextProvider, prepareFieldContext, subscribeFieldContextKept} from "./fieldContext";
import {announceContext, registerContextProvider} from "./nativeContext";

/** While the person has asked for the field's encounter to be kept current, the companion's prepared context follows it:
 * after the field settles (debounced) and — decisively — just before a turn reads the context. Off by default. */
export function useFieldContextKeeper(transport: KernelTransportStatus, companion: {ref: string; project: string} | undefined) {
  const latest = useRef({transport, companion}); latest.current = {transport, companion};
  useEffect(() => registerContextProvider(fieldContextProvider), []);
  useEffect(() => {
    let timer: number | undefined, disposed = false;
    const run = () => {
      const {transport: t, companion: c} = latest.current;
      if (!c || !fieldContextKept() || !currentFieldContext()) return;
      void prepareFieldContext(t, c.project, c.ref).then(v => { if (!disposed) announceContext(c.project, v); }).catch(() => { /* surfaced when the person sends or reviews */ });
    };
    const schedule = () => { if (timer !== undefined) window.clearTimeout(timer); timer = window.setTimeout(run, 400); };
    const a = subscribeField(schedule), b = subscribeFieldContextKept(schedule);
    return () => { disposed = true; if (timer !== undefined) window.clearTimeout(timer); a(); b(); };
  }, []);
}
