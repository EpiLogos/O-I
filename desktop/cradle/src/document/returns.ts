/**
 * Returns beside the open document (DOCUMENT-SURFACE.md).
 *
 * The native receiving field is the one queue; the Inbox is its one review
 * surface. What the open document adds is visibility: how much returned
 * material is waiting against THIS source right now. Counting is native —
 * the register's own receiving page, filtered by the exact source ref.
 * A register that refuses is a quiet absence here, never a fabricated zero.
 */

import {receiving, type ReceivingPage} from "../receiving/client";
import type {KernelTransportStatus} from "../kernel/types";

const WAITING = new Set(["pending", "needs-review", "accepted", "including", "uncertain"]);

export async function waitingReturnsForSource(transport: KernelTransportStatus, project: string | null, sourceRef: string): Promise<number | undefined> {
  try {
    const page = await receiving<ReceivingPage>(transport, project, {kind: "list", limit: 50});
    return page.returns.filter(row => row.source_ref === sourceRef && WAITING.has(row.status)).length;
  } catch {
    return undefined;
  }
}
