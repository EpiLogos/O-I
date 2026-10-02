/** Human names over an already admitted owner reading. This is presentation,
 * never a registry, identity resolver or rewrite of authored prose/source. */
export function isInternalReference(value) {
  return typeof value === 'string' && (/^(?:central|world|oi|aikit|wiki|source|project|participant|agent|agent-profile|agent-session|agency|workcell|artifact|expression|scene|entity|relation|projection|presentation|role|run|task|flow|return|delivery|invocation|method|skill|control|reading|provider):[^\s]+$/.test(value.trim()) || /^(?:provider|agent|Agent|knowledge|wiki|source|projection|expression)\/[^\s]+$/.test(value.trim()));
}

export function subjectLabel(subject, fallback = 'Unnamed subject') {
  const candidates = typeof subject === 'string' ? [subject] : [subject?.label, subject?.title, subject?.name, subject?.chosen_name, subject?.presentation?.chosen_name, subject?.document?.title];
  return candidates.find(value => typeof value === 'string' && value.trim() && !isInternalReference(value))?.trim() ?? fallback;
}

/** A publication may carry the owner's newer title while an older index row
 * still has an address for its label. Only the same subject may supply it. */
export function entryLabel(entry, projections = [], fallback = 'Unnamed subject') {
  const latest=new Map();
  for(const row of projections){const prior=latest.get(row.projection_ref);if(!prior||row.projection_revision>prior.projection_revision)latest.set(row.projection_ref,row);}
  const own = [...latest.values()].filter(row => row.subject?.ref === entry?.ref && row.state === 'published')
    .sort((a, b) => b.projection_revision - a.projection_revision);
  return subjectLabel(entry, subjectLabel(own[0]?.representation?.payload, fallback));
}

/** Names come only from the supplied native subjects. Missing names remain
 * distinguishable in this reading; ordinal labels never become identities. */
export function referenceLabels(refs, subjects = [], fallback = 'Unnamed related subject') {
  return refs.map((ref, index) => ({ref, label: subjectLabel(subjects.find(subject => (subject.ref ?? subject.subject_ref) === ref), `${fallback} ${index + 1}`)}));
}

export function subjectKind(kind) {
  return ({'central-world':'World','wiki-node':'Knowledge page','wiki-space':'Wiki collection','curated-artifact':'Document',constellation:'Constellation',participant:'Participant','agent-session':'Agent session','world-position':'Agent position',workcell:'Workcell',practice:'Practice',activity:'Activity','shared-field':'Shared undertaking',unavailable:'Unavailable subject'})[kind] ?? 'Subject';
}

/** A relation's meaning is kept typed, with readable words in its label. */
export function relationLabel(value) {
  const known = {'oi.world/artifact':'Produces','oi.world/constellation':'Includes constellation','oi.world/carried-by':'Carried by','oi.world/practises':'Practises','oi.activity/participant':'Participant','oi.activity/works-on':'Works on','oi.agent/session':'Agent session','aikit.constellation/participation':'Member of constellation'};
  return known[value] ?? String(value ?? 'Related to').split(/[/.]/).filter(Boolean).at(-1)?.replaceAll('-', ' ') ?? 'Related to';
}
