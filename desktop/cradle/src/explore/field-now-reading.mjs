/**
 * The shared NOW a field stands in (WORKCELL-NOW-TEMPORAL-FIELD §9): which
 * Workcell root NOWs and bounded child NOWs its participants projected,
 * grouped by the Workcell that carries them. Read verbatim from the hosted
 * FieldNow — the desktop mints no NOW and infers no placement.
 */
export function fieldNowReading(snapshot, fieldRef) {
  const row = (Array.isArray(snapshot?.field_now) ? snapshot.field_now : []).find((reading) => reading?.field_ref === fieldRef);
  if (!row?.contract) return null;
  const contract = row.contract;
  const roots = contract.projected_root_now_refs ?? [];
  const children = contract.projected_child_now_refs ?? [];
  const workcells = new Map();
  const place = (workcell) => {
    if (!workcells.has(workcell)) workcells.set(workcell, { workcell_ref: workcell, root: null, children: [] });
    return workcells.get(workcell);
  };
  for (const root of roots) place(root.workcell_ref).root = { now_ref: root.now_ref, world_ref: root.world_ref, revision: root.revision, projected_by: root.projected_by };
  for (const child of children) place(child.workcell_ref).children.push({ now_ref: child.now_ref, parent_now_ref: child.parent_now_ref, state: child.state, purpose: child.purpose_summary, projected_by: child.projected_by, under_root: roots.some((root) => root.now_ref === child.parent_now_ref) });
  return { field_ref: fieldRef, revision: row.revision, workcells: [...workcells.values()], cursors: { presence: contract.presence_cursor, activity: contract.activity_cursor, contribution: contract.contribution_cursor } };
}
