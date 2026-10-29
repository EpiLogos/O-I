// The Flows folder and its listing, with no Flow parser and no form page (O-I #740): a reader that only names the folder or lists it
// (the shell's document pane and browser) loads this module, and the parser (./instance.ts, which carries ql-flow.html) loads with
// readFlowInstance in ./instances.ts, which re-exports what is here.
import {listFiles} from "../files/client";
import type {CentralLocation,KernelTransportStatus,NativeDirectory} from "../kernel/types";
/** The ratified flow carrier's owner routes: instances are ordinary files in
 * `Control/user/flows/` — listed through `central.files.list`, read through
 * `central.files.read`, created and saved through `central.files.write`
 * (absent file + empty expected revision = create; otherwise a
 * revision-checked CAS write whose conflict returns the owner's current
 * bytes). The desktop never invents a flow identity: it comes from the
 * document itself. */
export const USER_FLOWS_DIR = "Control/user/flows";
export interface FlowInstanceRow { name: string; location: CentralLocation; byte_len: number }
export async function listFlowInstances(transport: KernelTransportStatus): Promise<FlowInstanceRow[]> {
  let directory: NativeDirectory;
  try {
    directory = await listFiles(transport, USER_FLOWS_DIR);
  } catch (reason) {
    // The owner refuses a listing of a directory that does not exist: that
    // is exactly what "nothing remembered/written yet" looks like.
    if (/No such file or directory/i.test(String(reason))) return [];
    throw reason;
  }
  return directory.entries
    .filter(e => e.kind === "file" && /\.html$/i.test(e.name))
    .map(e => ({ name: e.name, location: e.location, byte_len: e.byte_len }));
}
