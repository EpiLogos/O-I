/** Standing of seven-centre material in Expressions.
 * Hard law: centre identity ≠ cymatic station. Authored starter ≠ live Nara. */
export const AUTHORED_CHAKRA_STARTER = 'authored-seven-centre-expression-material' as const;
export const NARA_PERSONAL_LIVE = 'nara-personal-m4-live-projection' as const;
export const CYMATIC_STATION = 'cymatic-material-resonance-station' as const;
export type CentreStanding =
  | typeof AUTHORED_CHAKRA_STARTER
  | typeof NARA_PERSONAL_LIVE
  | typeof CYMATIC_STATION;

/** Centre identity must never be silently identified with a cymatic station. */
export function centreStandingDistinct(centre: CentreStanding, station: CentreStanding): boolean {
  if (station !== CYMATIC_STATION) return centre !== station;
  return centre !== CYMATIC_STATION;
}

export const STANDING_LABEL: Record<CentreStanding, string> = {
  [AUTHORED_CHAKRA_STARTER]: 'Authored seven-centre starter — not live Nara',
  [NARA_PERSONAL_LIVE]: 'Live Nara personal M4 projection',
  [CYMATIC_STATION]: 'Cymatic / material resonance station',
};
