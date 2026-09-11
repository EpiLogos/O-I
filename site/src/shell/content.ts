export type Media = { media: 'a' | 'b' | 'c' | 'd'; poster?: 1 | 2 | 3; zoom?: number };

export type Item = { name: string; detail?: string };

export type Layout = 'statement' | 'split' | 'feature' | 'grid' | 'index' | 'band';

export type Section = {
  eyebrow?: string;
  title: string;
  sub?: string;
  body?: string;
  items?: Item[];
  layout: Layout;
  tone?: 'light' | 'dark';
  figure?: 1 | 2 | 3;
  flip?: boolean;
  media?: Media;
};

export type Page = {
  id: string;
  label: string;
  index: string;
  hint: string;
  intro: { eyebrow: string; title: string; body: string };
  sections: Section[];
};

export const PRODUCTS: Array<{ name: string; office: string; repo: string; what: string; change: string }> = [
  {
    name: 'Central',
    office: 'meaningful continuity',
    repo: 'https://github.com/EpiLogos/Central',
    what: 'Durable human-authored ground, kept in ordinary files and exposed through bounded Actions — so a world stays recognisably yours across changing models, machines and runtimes.',
    change: 'Write your purpose, principles and ways of working once, in your own words, instead of reconstructing yourself in every session.',
  },
  {
    name: 'Actuation',
    office: 'living articulation',
    repo: 'https://github.com/EpiLogos/Actuation',
    what: 'The constitution of agency — Agent, Agency, determination, authority, bounds, delegation, federation and Return — so a composed system can say who acts and on whose behalf.',
    change: 'Authority, refusal and dissent become inspectable relations instead of assumptions hidden in orchestration code.',
  },
  {
    name: 'AIKit',
    office: 'potency',
    repo: 'https://github.com/EpiLogos/ai-kit',
    what: 'Resolves a heterogeneous field of models, skills, tools, sources, sessions and runtime bodies into a usable horizon for one actor, here and now, without rewriting it into one runtime.',
    change: 'You can inspect what exists, what is relevant, what is permitted, and why — instead of inheriting accidental global state.',
  },
  {
    name: 'Software Factory',
    office: 'transformation',
    repo: 'https://github.com/EpiLogos/agent-system-design',
    what: 'Keeps authored intention connected to design, agent-led implementation, evidence, Candidates and Recognition as software changes.',
    change: 'Fast agentic implementation can stay answerable to human purpose instead of silently losing why the software was worth making.',
  },
  {
    name: 'Workcell',
    office: 'situation',
    repo: 'https://github.com/EpiLogos/Workcell',
    what: 'Turns provider-neutral demand into actual workspaces, processes, services, containers, VMs and hosts — with inspectable lifecycle and evidence.',
    change: 'A Project does not become "a Docker project" merely because Docker happened to satisfy today\'s demand.',
  },
  {
    name: 'Quaternal Logic',
    office: 'transcendent relation',
    repo: 'https://github.com/EpiLogos/QL-MEF',
    what: 'The executable formal research product: QL/MEF structures, refraction, provenance-bearing readings and operational experiments.',
    change: 'A formal distinction earns its place by making a discriminable, testable difference — not by decorative terminology.',
  },
];

export const PAGES: Page[] = [
  {
    id: 'home',
    label: 'Home',
    index: '00',
    hint: 'Objective : Internality',
    intro: { eyebrow: 'O:I', title: 'World and Life', body: '' },
    sections: [
      {
        eyebrow: 'What is O:I',
        title: 'O:I maps what it means for an AI agent to have a world.',
        sub: 'Operating Infrastructure · Objective Internality',
        body: 'An agent works through an inference model — and through the project it can see, the tools it can use, the knowledge it can reach, the authority it has, the history it carries and the purposes that orient it. O:I makes that surrounding field explicit: Operating Infrastructure · Objective Internality.',
        layout: 'statement',
        tone: 'dark',
      },
      {
        eyebrow: 'Existing worlds',
        title: 'Start where you are.',
        body: 'Your editor, shell, repositories, agents, skills and machines already form a real environment. O:I starts there — no migration into one stack. Principles, preferences and ways of working can stay as durable source in your own words instead of being retyped into every session.',
        layout: 'split',
        tone: 'light',
      },
      {
        eyebrow: 'One possibility space',
        title: 'Minimal or developed — one substrate.',
        items: [
          { name: 'Ground', detail: 'durable ground + actuated capacity' },
          { name: 'Orientation', detail: 'purpose · principles · preferences' },
          { name: 'Continuity', detail: 'projects that persist' },
          { name: 'Knowledge', detail: 'sources the agent can trace' },
          { name: 'Capability', detail: 'skills · tools · actions' },
          { name: 'Agency', detail: 'differentiated + delegated forms' },
          { name: 'Development', detail: 'evidence · decisions · learning' },
          { name: 'Material', detail: 'environments work can run in' },
          { name: 'Relation', detail: 'worlds meeting worlds' },
        ],
        layout: 'grid',
        tone: 'dark',
      },
      {
        eyebrow: 'Products',
        title: 'Six offices, one Life.',
        body: 'The six centres are custodians of stretches of one circuit — not a product catalogue. Each is an aspect of a Life as Objective Internality.',
        items: PRODUCTS.map((product) => ({ name: product.name, detail: product.office })),
        layout: 'index',
        tone: 'light',
      },
      {
        eyebrow: 'Shared field',
        title: 'From your world to a shared field.',
        body: 'A document, project result or agent can be projected outward while its source identity and provenance stay with the world that owns it. Independently grounded worlds meet without ceasing to be separately grounded.',
        layout: 'feature',
        tone: 'dark',
        figure: 2,
      },
      {
        eyebrow: 'Build',
        title: 'Extend the world you already use.',
        body: '`oi` is the local doorway. Public contracts and SDKs let real technologies join the field as providers, connectors and fixtures — not private patches.',
        layout: 'statement',
        tone: 'light',
      },
    ],
  },
  {
    id: 'oi',
    label: 'O:I',
    index: '01',
    hint: 'World and Life',
    intro: {
      eyebrow: 'O:I',
      title: 'O:I gives AI agents a world to act in.',
      body: 'Change the project, tools, permissions, history and environment around the same model and you have changed the conditions of agency. O:I makes those conditions explicit enough to build, inspect and study.',
    },
    sections: [
      {
        eyebrow: 'Two readings of one name',
        title: 'Operating Infrastructure. Objective : Internality.',
        body: 'Operating Infrastructure names the engineering around an agent: projects, capabilities, sessions, history, material environments, relations. Objective Internality names the same field from the actor\'s side — what an agent can actually draw on while acting.',
        layout: 'band',
        media: { media: 'c', poster: 3, zoom: 1.3 },
      },
      {
        eyebrow: 'The operational claim',
        title: 'A precise object, not a claim about consciousness.',
        body: 'Objective Internality gives us an inspectable engineering object without requiring a conclusion about artificial subjectivity. We build and compare systems, then let implementation and use return evidence about where the concept helps and where it needs revision.',
        layout: 'statement',
        tone: 'light',
      },
      {
        eyebrow: 'Human agency',
        title: 'More agency should create more room for authorship.',
        body: 'The aim is not fewer buttons to press. It is to keep the human causally present where authorship matters — while routine setup and bookkeeping move away from continuous attention.',
        items: [
          { name: 'Authorship', detail: 'purpose · principles · preferences' },
          { name: 'Authority', detail: 'what an agency may do' },
          { name: 'Commission', detail: 'work worth undertaking' },
          { name: 'Recognition', detail: 'judging what returned' },
          { name: 'Revision', detail: 'changing the ground' },
          { name: 'Refusal', detail: 'a constitutional act' },
        ],
        layout: 'split',
        tone: 'dark',
      },
      {
        eyebrow: 'Research field',
        title: 'Agentic engineering is an open, collective field.',
        body: 'No single team inhabits the whole possibility space. Public SDKs, providers and fixtures widen the empirical field, so more real worlds return evidence that improves the products themselves.',
        layout: 'feature',
        tone: 'light',
        figure: 1,
        flip: true,
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    index: '02',
    hint: 'Six offices',
    intro: {
      eyebrow: 'Products',
      title: 'Six offices, one Life.',
      body: 'Each centre owns a different technical problem and its own repository. They compose through O:I where their responsibilities meet — and remain usable independently.',
    },
    sections: [
      {
        eyebrow: PRODUCTS[0].office,
        title: PRODUCTS[0].name,
        body: PRODUCTS[0].what,
        items: [
          { name: 'What changes', detail: PRODUCTS[0].change },
          { name: 'Native centre', detail: PRODUCTS[0].repo },
        ],
        layout: 'feature',
        tone: 'light',
        figure: 1,
      },
      {
        eyebrow: PRODUCTS[1].office,
        title: PRODUCTS[1].name,
        body: PRODUCTS[1].what,
        items: [
          { name: 'What changes', detail: PRODUCTS[1].change },
          { name: 'Native centre', detail: PRODUCTS[1].repo },
        ],
        layout: 'split',
        tone: 'dark',
      },
      {
        eyebrow: PRODUCTS[2].office,
        title: PRODUCTS[2].name,
        body: PRODUCTS[2].what,
        items: [
          { name: 'What changes', detail: PRODUCTS[2].change },
          { name: 'Native centre', detail: PRODUCTS[2].repo },
        ],
        layout: 'feature',
        tone: 'light',
        figure: 2,
        flip: true,
      },
      {
        eyebrow: PRODUCTS[3].office,
        title: PRODUCTS[3].name,
        body: PRODUCTS[3].what,
        items: [
          { name: 'What changes', detail: PRODUCTS[3].change },
          { name: 'Native centre', detail: PRODUCTS[3].repo },
        ],
        layout: 'split',
        tone: 'dark',
      },
      {
        eyebrow: PRODUCTS[4].office,
        title: PRODUCTS[4].name,
        body: PRODUCTS[4].what,
        items: [
          { name: 'What changes', detail: PRODUCTS[4].change },
          { name: 'Native centre', detail: PRODUCTS[4].repo },
        ],
        layout: 'feature',
        tone: 'light',
        figure: 3,
      },
      {
        eyebrow: PRODUCTS[5].office,
        title: PRODUCTS[5].name,
        body: PRODUCTS[5].what,
        items: [
          { name: 'What changes', detail: PRODUCTS[5].change },
          { name: 'Native centre', detail: PRODUCTS[5].repo },
        ],
        layout: 'statement',
        tone: 'dark',
      },
    ],
  },
  {
    id: 'shared-field',
    label: 'Shared Field',
    index: '03',
    hint: 'Between worlds',
    intro: {
      eyebrow: 'Shared Field',
      title: 'Between worlds.',
      body: 'A World is the durable place an agent acts from. A Shared Field is where independently grounded worlds meet without either losing its source identity and provenance.',
    },
    sections: [
      {
        eyebrow: 'Projection',
        title: 'Source stays with the world.',
        body: 'Projection creates an addressable representation for a particular audience. The source keeps its canonical identity; the projection carries enough provenance for another participant to understand where it came from.',
        layout: 'band',
        media: { media: 'a', poster: 1, zoom: 1.3 },
      },
      {
        eyebrow: 'Objective Co-Internality',
        title: 'Independent worlds in relation.',
        body: 'What was projected, how it was encountered, what difference was returned, and how that difference later changed either world. Legibility without capture.',
        layout: 'statement',
        tone: 'light',
      },
      {
        eyebrow: 'Explore',
        title: 'Where those worlds become visible.',
        body: 'Explore is the public surface for addressable worlds, agents, projections and contributions — each carrying provenance.',
        layout: 'split',
        tone: 'dark',
      },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    index: '04',
    hint: 'Operational consequence',
    intro: {
      eyebrow: 'Research',
      title: 'An open research platform.',
      body: 'The object is the technological world around model capacity. We build these structures so the community can use them, vary them, compare them and return evidence about what they actually change.',
    },
    sections: [
      {
        eyebrow: 'What we study',
        title: 'Capacity. Provisioning. Potentiation.',
        body: 'Capacity is what the model and compute can provide. Provisioning is what an act has available. Potentiation is what becomes possible because the surrounding structure has a particular form.',
        layout: 'band',
        media: { media: 'd', poster: 2, zoom: 1.3 },
      },
      {
        eyebrow: 'Human authorship',
        title: 'Where should the human enter?',
        body: 'Not only supervision. The human can author durable parts of the operative world from which later agency proceeds — and Central gives that question a concrete technical shape.',
        layout: 'split',
        tone: 'light',
      },
      {
        eyebrow: 'Method',
        title: 'Research should remain reopenable.',
        items: [
          { name: 'Discover' },
          { name: 'Source-lock' },
          { name: 'Study' },
          { name: 'Interpret' },
          { name: 'Abstract' },
          { name: 'Compare' },
          { name: 'Operationalise' },
          { name: 'Experiment' },
          { name: 'Find / revise / reject' },
          { name: 'Return' },
        ],
        layout: 'index',
        tone: 'dark',
      },
      {
        eyebrow: 'Quaternal Logic',
        title: 'A deeper formal programme.',
        body: 'Operational parity is the discipline: where a formal distinction is claimed to matter, implementation should make a discriminable difference. Negative and null results are legitimate and return to the research.',
        layout: 'statement',
        tone: 'light',
      },
      {
        eyebrow: 'Collective',
        title: 'Community is part of the method.',
        body: 'Abstraction → SDK → local accommodation → fixture + evidence → share → reproduce → return. Reference implementations open paths; community implementations widen the field.',
        layout: 'feature',
        tone: 'dark',
        figure: 3,
      },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    index: '05',
    hint: 'Start with oi',
    intro: {
      eyebrow: 'Build',
      title: 'Start with oi.',
      body: '`oi` is the local doorway into the composed system. The extension direction matters equally: native SDKs and public contracts let developers connect the technologies they already use.',
    },
    sections: [
      {
        eyebrow: 'Start here',
        title: 'Source, installation and governing documents.',
        items: [
          { name: 'Install O:I', detail: 'docs/INSTALL.md' },
          { name: 'CLI surface', detail: 'docs/CLI.md' },
          { name: 'Founding positions', detail: 'docs/positions/FOUNDING-POSITIONS.md' },
          { name: 'Vision', detail: 'docs/VISION.md' },
          { name: 'Architecture', detail: 'docs/ARCHITECTURE.md' },
          { name: 'Research protocol', detail: 'docs/RESEARCH-PROTOCOL.md' },
          { name: 'Shared Field', detail: 'docs/SHARED-FIELD.md' },
        ],
        layout: 'index',
        tone: 'light',
      },
      {
        eyebrow: 'Distinct packages',
        title: 'Two package relations, not one.',
        body: 'The ordinary `oi` distribution and the O:I extension envelope solve different problems. Until the public distribution package lands, the install guide remains the source of truth.',
        layout: 'band',
        media: { media: 'a', poster: 1, zoom: 1.3 },
      },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    index: '06',
    hint: 'The shared field, made visible',
    intro: {
      eyebrow: 'Explore',
      title: 'The shared field, made visible.',
      body: 'Explore is a distinct application surface. It renders addressable worlds, agents, projections and contributions from the shared-field read model, each carrying provenance.',
    },
    sections: [
      {
        eyebrow: 'Open',
        title: 'Enter the field.',
        body: 'Open the Explore application to search, filter and inspect the worlds and contributions that have chosen to be visible.',
        layout: 'band',
        media: { media: 'b', poster: 3, zoom: 1.3 },
      },
    ],
  },
];
