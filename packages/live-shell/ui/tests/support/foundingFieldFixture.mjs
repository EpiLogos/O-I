// The founding field as the atlas suites' FIXTURE holds it: the Jung vault's ingest shape (a `vaultPath`/`vaultLedgerLine` descriptor,
// `jung` cites, a `subject` word) reshaped to the C2 Field contract (provider descriptor, freshness line, the founding tie bases,
// `cites`). This is the pure reshaping the retired provider/archetypalEarthProvider.ts (adaptFoundingField) did on a bundle it read;
// the shell no longer reads that bundle (the atlas reads the suite through provider/suiteProvider.ts), so the occurrence-seam,
// refresh and contract suites keep their model here, as a fixture, with no provider behind it.
const FOUNDING_TIE_BASES = [
  {id: 'jung', label: 'Jung'},
  {id: 'inferred', label: 'Inferred'},
  {id: 'site', label: 'Read here'},
]

/** @param {any} raw a founding record as the vault ingest writes it. @returns {any} the same record as a C2 Field. */
export function adaptFoundingFixture(raw) {
  const {meta, occurrences, ...rest} = raw
  const {vaultPath, vaultLedgerLine, ...verbatimMeta} = meta
  return {
    ...rest,
    meta: {
      ...verbatimMeta,
      provider: {id: 'archetypal-earth', name: 'Jung archetypal field', home: vaultPath},
      freshness: vaultLedgerLine,
      ties: {bases: FOUNDING_TIE_BASES},
    },
    occurrences: occurrences.map(({jung, subject: _subject, ...occurrence}) => ({...occurrence, cites: jung ?? []})),
  }
}
