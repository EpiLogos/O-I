/** Private runtime admission into the retained modal medium. No scene writes,
 * semantic identity, or new physical coefficients live in the engine. */
export interface LocalizedResonanceProjection {
  scope:string;
  drivers: readonly {
    /** Stable identity of one independent native driver. Omission preserves the
     * legacy one-driver-per-target contract by using entityId as the identity. */
    driverRef?:string;
    /** Formation receiving this driver's spatially local effect. */
    entityId:string;
    frequencyHz:number;
    driveShare:number;
  }[];
  /** Native unit quaternion in Hamilton component order. */
  orientation: Readonly<{w:number;x:number;y:number;z:number}>;
}
