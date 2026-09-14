import { receiving, type ReceivingPage } from "../../receiving/client";
import { nowReading } from "../../receiving/now";
import type { KernelTransportStatus } from "../../kernel/types";

export interface ProjectNowInspection {
  exists: boolean;
  active_items: Array<{ id: string; kind: string; subject: string; status: string; schema?: "central.project-now.handoff/v1"; now_ref?: string; result?: string; actor?: string; carried_from_days?: string[] }>;
  inactive_items: Array<{ id: string; kind: string; subject: string; status: string; schema?: "central.project-now.handoff/v1"; now_ref?: string; actor?: string }>;
  day_records: string[];
  human_scratch: unknown[];
  open_questions: unknown[];
  project_root?: string;
  policy?: { schema?: string; carry_statuses?: string[]; remove_statuses?: string[] };
  boundaries?: string[];
  [key: string]: unknown;
}

export async function inspectProjectNow(transport: KernelTransportStatus, project: string): Promise<ProjectNowInspection> {
  const reading = await nowReading<ProjectNowInspection>(transport, project, { kind: "project-inspect" });
  if (!Array.isArray(reading.active_items) || !Array.isArray(reading.inactive_items) || !Array.isArray(reading.day_records) || !Array.isArray(reading.human_scratch) || !Array.isArray(reading.open_questions)) {
    throw new Error("Central returned an invalid Project NOW inspection");
  }
  return reading;
}

export async function inspectProjectInbox(transport: KernelTransportStatus, project: string): Promise<ReceivingPage> {
  return receiving<ReceivingPage>(transport, project, { kind: "list", limit: 50 });
}
