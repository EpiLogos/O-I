export type Page = {
  id: string;
  index: string;
  label: string;
  hint: string;
};

export const PAGES: Page[] = [
  { id: 'home', index: '00', label: 'Home', hint: 'Objective : Internality' },
  { id: 'oi', index: '01', label: 'O:I', hint: 'World and Life' },
  { id: 'products', index: '02', label: 'Products', hint: 'Six offices' },
  { id: 'shared-field', index: '03', label: 'Shared Field', hint: 'Between worlds' },
  { id: 'research', index: '04', label: 'Research', hint: 'Operational consequence' },
  { id: 'build', index: '05', label: 'Build', hint: 'Start with oi' },
  { id: 'explore', index: '06', label: 'Explore', hint: 'The shared field, made visible' },
];

/** Minimal per-page copy. The full content pass happens after the readmes land. */
export const CONTENT: Record<string, { title: string; sub: string; offices?: Array<[string, string]> }> = {
  oi: {
    title: 'World and Life',
    sub: 'Objective Internality, not subjective immediacy. A Life is a self-disclosure within an internality that also discloses the World containing it.',
  },
  products: {
    title: 'Six offices',
    sub: 'Not a software taxonomy — six aspects of one Life.',
    offices: [
      ['Central', 'meaningful continuity'],
      ['Actuation', 'living articulation'],
      ['AIKit', 'potency'],
      ['Software Factory', 'transformation'],
      ['Workcell', 'situation'],
      ['Quaternal Logic', 'transcendent relation'],
    ],
  },
  'shared-field': {
    title: 'Between worlds',
    sub: 'Projection · Encounter · Objective Co-Internality. Independently grounded worlds meet without ceasing to be separately grounded.',
  },
  research: {
    title: 'Operational consequence',
    sub: 'Capacity · Provisioning · Potentiation. If a distinction should matter, it must make a discriminable difference.',
  },
  build: {
    title: 'Start with oi',
    sub: 'A doorway, not a walled garden. The world you already have is the starting field.',
  },
  explore: {
    title: 'The shared field, made visible',
    sub: 'Worlds, agents, projections and contributions — each carrying provenance.',
  },
};
