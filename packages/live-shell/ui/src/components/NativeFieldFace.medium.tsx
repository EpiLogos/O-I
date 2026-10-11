import type {FieldFaceView} from './nativeFieldFaceViews.tsx'
import {short} from './nativeFieldFaceValues.ts'
import {dispatchOpenDevice} from './nativeDrag'

/** Shared Medium: source-bound coupling diagram; Enabled and dimension switches. The physical plane is owned by Physics. */
export const mediumFaceView: FieldFaceView = {
  draw: ({graphValue, value}) => <>
      <rect x="48" y="17" width="264" height="99" rx="2" className="native-medium-boundary" />
      {Array.from({length: 11}, (_, index) => <path key={index} d={`M${48 + index * 26.4} 17V116`} className="native-grid-line" />)}
      {Array.from({length: 5}, (_, index) => <path key={index} d={`M48 ${17 + index * 24.75}H312`} className="native-grid-line" />)}
      <path d={`M70 67H${70 + graphValue * 30}M290 67H${290 - graphValue * 30}`} className="native-response-line" />
      <text x="141" y="70" className="native-graph-label">Coupling</text>
      <text x="56" y="31" className="native-graph-label">{short(value('medium.gridRes') ?? 0)}² grid · extent {short(value('medium.extent') ?? 0)} px</text>
      <text x="56" y="108" className="native-graph-label">Pressure {short(value('medium.pressure') ?? 0)} · shared field</text>
    </>,
  switches: ({reading, disabled, apply}) => <div className="native-medium-switches"><label><input type="checkbox" checked={reading.scene.engine.mediumEnabled === true} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'mediumEnabled', value: event.target.checked}])} />Enabled</label><select aria-label="Medium dimensions" value={reading.scene.engine.mediumDimension ?? '2D'} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'mediumDimension', value: event.target.value as '2D' | '3D'}])}><option>2D</option><option>3D</option></select><p className="native-medium-plane-note">Medium plane is set in Physics · <button type="button" onClick={() => dispatchOpenDevice({scope: 'field', family: 'physics'})}>Open Physics</button></p></div>,
}
