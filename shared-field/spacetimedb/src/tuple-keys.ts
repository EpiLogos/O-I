/** Physical keys for the existing native relations. These keys are indexes,
 * never a replacement for a row's literal identity or its authority checks.
 * JSON's string-array encoding is injective, including delimiters, controls,
 * Unicode and lone UTF-16 surrogates. No normalization is performed. */
export function tupleKey(...parts: string[]): string {
  return `tuple:v2:${JSON.stringify(parts)}`;
}

export function hasLiteralTuple(
  row: Record<string, unknown>,
  expected: Readonly<Record<string, string | number>>,
): boolean {
  return Object.entries(expected).every(([field, value]) => row[field] === value);
}
