// The Day's design as the shell hosts it (lane BC). Every view but one is the catalogue's own (inhabitants/catalogue/panels/day.tsx,
// `central:day-die`, read-only here and loaded through the runtime's own loader, frame/devices/designsLoad.ts). The one the shell
// supplies is Full, because Full is the material (DEVICE-UI §2: "The material itself … No controls"; DLW §18.1 Full: "The full Day
// shows the open face as the template draws it"): the catalogue's Full draws the blank template from the gallery's
// `__CRADLE_DOCUMENTS__`, which the shell's build does not define — evaluated in the host's render it would throw outside the
// view's boundary (frame/devices/deviceHost.tsx HostedDevice `draw`) and blank the pane. Here Full is the Day's own page as the
// owner stands it: the picture the chain publishes at full size (CentralDevices.tsx), the same body the device pane drew before.
//
// The design is registered over the catalogue's only while the Day's binding is published: a registered design draws on the device's
// row keys when no binding stands (frame/devices/designs.ts useDesign; DeviceView.tsx useHosting), and the Day's rows are not its
// design's keys. Proposed to the runtime: a published device's picture draws Full wherever one is published — then this goes.
import {useEffect, useState} from 'react'
import {useDeviceDoor} from '../../frame/devices/deviceDoor'
import {isRegisteredDesign, registerDesignedDevice, unregisterDesignedDevice} from '../../frame/devices/designs'
import type {DesignedDevice} from '../../frame/devices/designed'

export const DAY_DESIGN_ID = 'central:day-die'

/** The device's material at pane size: its published picture, or what stands in its place. */
function Material({id, title}: {id: string; title: string}) {
  const door = useDeviceDoor()
  const entry = door.device(id)
  return <div className="dv-full" data-i={`${title}|The Day's page, as its owner stands it. Its controls stay in Device view.`}>
    {entry?.picture ? entry.picture('full') : <p className="dv-full-none">{title} is on no chain now. It returns when its chain does.</p>}
  </div>
}

/** The catalogue's Day with the shell's Full: the published material. */
export function shellDayDesign(design: DesignedDevice): DesignedDevice {
  return {...design, full: () => <Material id={design.id} title={design.title} />}
}

let catalogue: Promise<DesignedDevice | null> | null = null

/** The catalogue's Day, once (null when the catalogue does not hold it or it does not load: the generic plate draws then). */
function loadCatalogueDay(): Promise<DesignedDevice | null> {
  catalogue ??= import('../../frame/devices/designsLoad')
    .then(({loadDesign}) => loadDesign(DAY_DESIGN_ID))
    .then(design => design ?? null, cause => { console.warn(`The design of ${DAY_DESIGN_ID} did not load; the generic plate draws the Day.`, cause); return null })
  return catalogue
}

/** The shell's Day design once the catalogue's has loaded (asked for when `wanted`: the Day has readings to bind), else null. */
export function useShellDayDesign(wanted: boolean): DesignedDevice | null {
  const [design, setDesign] = useState<DesignedDevice | null>(null)
  useEffect(() => {
    if (!wanted || design) return
    let alive = true
    void loadCatalogueDay().then(found => { if (alive && found) setDesign(shellDayDesign(found)) })
    return () => { alive = false }
  }, [wanted, design])
  return design
}

/** The chains that publish the Day's binding now (the Device side and an instrument's side can both hold Central's chain). */
const holders = new Set<object>()

/** Stand the shell's Day design over the catalogue's for `holder` (a chain publishing the binding that reads its keys), or let it go
 * (that chain publishes none). The design is withdrawn only when no chain holds it. */
export function standDayDesign(holder: object, design: DesignedDevice | null): void {
  if (design) {
    holders.add(holder)
    if (!isRegisteredDesign(design.id)) registerDesignedDevice(design)
    return
  }
  holders.delete(holder)
  if (!holders.size && isRegisteredDesign(DAY_DESIGN_ID)) unregisterDesignedDevice(DAY_DESIGN_ID)
}
