/**
 * Bounded Nara → Expression embodiment projection (consumer side).
 * Private PersonalFieldState / identity material never enter the Expression document.
 * Co-refers with #336 speech via nara_ref + subject_ref + expression_ref.
 */

export const AUTHORED_CHAKRA_STARTER = 'authored-seven-centre-expression-material' as const;
export const NARA_PERSONAL_LIVE = 'nara-personal-m4-live-projection' as const;
export const CYMATIC_STATION = 'cymatic-material-resonance-station' as const;
export type CentreStanding =
  | typeof AUTHORED_CHAKRA_STARTER
  | typeof NARA_PERSONAL_LIVE
  | typeof CYMATIC_STATION;

export const NARA_ANIMA_PROFILE_SCHEMA = 'ql.nara-anima-expression-profile/v1';
export const PRIVATE_PRESENTATION_CHANNEL = 'oi.private-identity-presentation/v2';

export interface AnimaCentreBinding {
  ordinal: number;
  locus_ref: string;
  label: string;
  source_ref: string;
  source_revision: string;
  m1_basis_ref: string;
  m2_basis_ref: string;
  m3_basis_ref: string;
  amplitude: number;
  m1_source_ref?: string;
  m1_value?: number;
  m2_source_ref?: string;
  m2_value?: number;
  m3_source_ref?: string;
  m3_value?: number;
}

export interface AnimaExpressionProfile {
  schema: typeof NARA_ANIMA_PROFILE_SCHEMA;
  subject_ref: string;
  event_ref: string;
  profile_generation: number;
  personal_reception_generation: number;
  current: boolean;
  centres: AnimaCentreBinding[];
  earth_body: {locus_ref: string; frame_ref: string; standing: string; source_ref?: string; source_revision?: string};
  centre_identity_neq_cymatic_station: true;
  standing: string;
  lineage?: string;
  presentation_mapping?: Record<string, string>;
}

export interface PersonalProjectionBinding {
  nara_ref: string;
  subject_ref: string;
  expression_ref: string;
  expression_revision: string;
  profile: AnimaExpressionProfile | null;
  standing: CentreStanding;
  disconnected: boolean;
}

/** Admit a live Anima profile without copying private M4 into the Expression. */
export function bindPersonalProjection(input: {
  nara_ref: string;
  subject_ref: string;
  expression_ref: string;
  expression_revision: string;
  profile: AnimaExpressionProfile;
}): PersonalProjectionBinding {
  if (input.profile.schema !== NARA_ANIMA_PROFILE_SCHEMA) {
    throw new Error('Anima ExpressionProfile schema mismatch');
  }
  if (input.profile.subject_ref !== input.subject_ref) {
    throw new Error('Anima profile subject does not match binding subject');
  }
  if (input.profile.centres.length !== 7) {
    throw new Error('Anima profile requires exactly seven centres');
  }
  if (!input.profile.centre_identity_neq_cymatic_station) {
    throw new Error('centre identity must remain distinct from cymatic stations');
  }
  if (
    input.profile.centres.some((c) => c.locus_ref === input.profile.earth_body.locus_ref)
  ) {
    throw new Error('EarthBody must not appear as a centre peer');
  }
  if (!input.profile.current) {
    throw new Error('stale Anima profile refused; personal reception is not current');
  }
  return {
    nara_ref: input.nara_ref,
    subject_ref: input.subject_ref,
    expression_ref: input.expression_ref,
    expression_revision: input.expression_revision,
    profile: input.profile,
    standing: NARA_PERSONAL_LIVE,
    disconnected: false,
  };
}

/** Disconnect live Nara; retain authored Expression without claiming last reading current. */
export function disconnectPersonalProjection(
  binding: PersonalProjectionBinding,
): PersonalProjectionBinding {
  return {
    ...binding,
    profile: null,
    standing: AUTHORED_CHAKRA_STARTER,
    disconnected: true,
  };
}

export function personalStandingLabel(binding: PersonalProjectionBinding | null): CentreStanding {
  if (!binding || binding.disconnected || !binding.profile) {
    return AUTHORED_CHAKRA_STARTER;
  }
  return binding.standing === NARA_PERSONAL_LIVE ? NARA_PERSONAL_LIVE : AUTHORED_CHAKRA_STARTER;
}

/** Privacy: these must never enter a generic Expression / Library export. */
export const FORBIDDEN_EXPRESSION_FIELDS = [
  'identity_hash_ref',
  'protected_value_ref',
  'PersonalFieldState',
  'identity_slot_body',
  'transcript',
  'journal_refs',
] as const;

export function assertNoPrivateLeak(documentJson: string): void {
  for (const key of FORBIDDEN_EXPRESSION_FIELDS) {
    if (documentJson.includes(`"${key}"`) || documentJson.includes(`'${key}'`)) {
      throw new Error(`private Nara material must not enter Expression document (${key})`);
    }
  }
}

/** Same nara_ref / subject / Expression for speech (#336) and personal body. */
export function assertSharedPersonalIdentity(
  a: {nara_ref: string; subject_ref: string; expression_ref: string},
  b: PersonalProjectionBinding,
): void {
  if (a.nara_ref !== b.nara_ref || a.subject_ref !== b.subject_ref) {
    throw new Error('Nara speech and personal projection must share nara_ref and subject_ref');
  }
  if (a.expression_ref !== b.expression_ref) {
    throw new Error('Nara speech and personal projection must share expression_ref');
  }
}
