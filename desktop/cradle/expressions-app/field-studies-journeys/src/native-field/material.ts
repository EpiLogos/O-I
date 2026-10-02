/** D30 declared instance policy. These bounds are the native Scene contract,
 * not a new Bimba magnitude, personal determinant or empirical material law. */
export const SCENE_MATERIAL_STANDING='declared-material-policy: no source table fixes presentation scale, damping, strike amplitude or output gain (QL-MEF #135)';
export interface NativeSceneMaterial {damping_per_second:number;strike_metres:number;audio_gain_per_metre:number;strike_on_event:boolean}
export interface CurrentSceneMaterialPolicy {schema:'oi.epi-current-material-policy/v1';material:NativeSceneMaterial;standing:typeof SCENE_MATERIAL_STANDING}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function requireSceneMaterial(value:unknown):NativeSceneMaterial {
 if(!object(value)||Object.keys(value).length!==4||!['damping_per_second','strike_metres','audio_gain_per_metre','strike_on_event'].every(key=>Object.prototype.hasOwnProperty.call(value,key)))throw Error('The complete native material policy is unavailable.');
 const m=value as unknown as NativeSceneMaterial;
 if(!Number.isFinite(m.damping_per_second)||m.damping_per_second<0||m.damping_per_second>1e6||!Number.isFinite(m.strike_metres)||m.strike_metres<=0||m.strike_metres>1||!Number.isFinite(m.audio_gain_per_metre)||Math.abs(m.audio_gain_per_metre)>1e6||typeof m.strike_on_event!=='boolean')throw Error('The native material policy is outside its Scene contract.');
 return m;
}
export function requireCurrentSceneMaterialPolicy(value:unknown):CurrentSceneMaterialPolicy {
 if(!object(value)||Object.keys(value).length!==3||value.schema!=='oi.epi-current-material-policy/v1'||value.standing!==SCENE_MATERIAL_STANDING)throw Error('The retained material adjustment lost its declared standing.');
 requireSceneMaterial(value.material);return value as unknown as CurrentSceneMaterialPolicy;
}
