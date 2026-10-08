/** What Arrangement for Expressions does not do yet, each with its owner reason.
 * Reasons are grounded in INSTRUMENTATION-CONTRACT (Scene recording into
 * Arrangement) and the composition types; none is a control. */
const ABSENT: readonly [string, string][] = [
  ['Placed occurrences with start and end', 'the native owner admits no start, end, offset, trim, reorder or remove operation for time-placed occurrences, so states show only their authored axis.'],
  ['Recording from Session', 'there is no timed visual-occurrence recording owner; it needs stable occurrence identities and an agreed visual clock.'],
  ['Loop regions and the loop switch', 'the Journey loop flag is not carried by the composition reading, and no loop-region operation exists.'],
  ['Per-occurrence repeat', 'there is no repeat-instance contract; it depends on the occurrence identities above.'],
  ['Automation lanes in Arrangement', 'automation is authored per device parameter (nativeDeviceEdits.ts); no lane-timed automation operation is admitted.'],
  ['Split, and per-source enable or solo', 'native glyph changes have no split, and clip sources expose only select, edit and open (nativeContent.ts).'],
];

export function NativeArrangementAbsences() {
  return <details className="nar-absences">
    <summary>Not yet in Arrangement for Expressions · {ABSENT.length}</summary>
    <ul>{ABSENT.map(([name, reason]) => <li key={name}><strong>{name}:</strong> {reason}</li>)}</ul>
  </details>;
}
