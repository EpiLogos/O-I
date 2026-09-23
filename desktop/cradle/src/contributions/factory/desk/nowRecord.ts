/** A NOW record's own words for the Run page and its object page: the
 * record's purpose read through Central's native NOW reading (read-only).
 * Root-register refs (`central:now:control:root:…`) read with no project;
 * a project-register ref names its project in its scope. */
import {useEffect, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {nowReading, type NowReading} from "../../../receiving/now";

export function nowProjectOf(ref: string): string | null {
  const match = /^central:now:project:([^:]+):/.exec(ref);
  return match ? decodeURIComponent(match[1]) : null;
}

export function useNowRecord(ref: string | undefined): {state: "reading" | "read" | "refused"; reading?: NowReading; error?: string} {
  const kernel = useKernel();
  const [value, setValue] = useState<{state: "reading" | "read" | "refused"; reading?: NowReading; error?: string}>({state: "reading"});
  useEffect(() => {
    if (!ref) return;
    let live = true;
    setValue({state: "reading"});
    nowReading<NowReading>(kernel.transport, nowProjectOf(ref), {kind: "read", now_ref: ref})
      .then(reading => { if (live) setValue({state: "read", reading}); })
      .catch(error => { if (live) setValue({state: "refused", error: String(error instanceof Error ? error.message : error)}); });
    return () => { live = false; };
  }, [kernel.transport, ref]);
  return value;
}
