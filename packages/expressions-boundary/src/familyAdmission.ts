/** Device family admission: the neutral gate every device-widget family passes through.
 * It knows no product name and no family list. A family is admitted once by a declaration that
 * carries its repeatability; the kernel token grammar is the only validity rule held here. */

/** The kernel's device family token (expression_scene.rs device_widgets; workspacePreferences validateDeviceWidgets). */
const FAMILY_TOKEN = /^[a-z0-9-]{1,64}$/;

export interface FamilyAdmission {
  readonly id: string;
  readonly repeatable: boolean;
}

const admitted = new Map<string, FamilyAdmission>();

export function isFamilyToken(id: unknown): id is string {
  return typeof id === 'string' && FAMILY_TOKEN.test(id);
}

/** Admits one family. Admitting the same id with the same repeatability again returns the existing admission;
 * a different repeatability for an admitted id is refused. */
export function admitFamily(declaration: {readonly id: string; readonly repeatable: boolean}): FamilyAdmission {
  if (!declaration || !isFamilyToken(declaration.id)) throw Error('A device family is a token of 1 to 64 lowercase letters, digits or hyphens');
  if (typeof declaration.repeatable !== 'boolean') throw Error('A device family declares whether it may repeat');
  const existing = admitted.get(declaration.id);
  if (existing) {
    if (existing.repeatable !== declaration.repeatable) throw Error('This device family is already admitted with a different repeatability');
    return existing;
  }
  const admission: FamilyAdmission = Object.freeze({id: declaration.id, repeatable: declaration.repeatable});
  admitted.set(admission.id, admission);
  return admission;
}

/** The admission for an id, or undefined when the id is not a token or was never admitted. */
export function admittedFamily(id: unknown): FamilyAdmission | undefined {
  return isFamilyToken(id) ? admitted.get(id) : undefined;
}
