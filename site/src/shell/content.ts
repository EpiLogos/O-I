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
    what:
      'Central holds the meaningful continuity of a Life: the articulated ground through which it can say what its world is, why it matters, and what its history has made present.\n\n' +
      'It is deeper than persistence or memory. It is where a Life\'s world remains intelligibly its world — originating meanings, disclosed self-understanding, recognised powers, learned history and returned reflection. For a human, that is autobiography in the broadest sense: commitments, memories, purposes, projects, inherited meanings, written in their own words as durable source. For an agent, it is durable authored and accumulated ground that survives changes of model, session, machine and application.\n\n' +
      'An agent can enter a world with permission-bounded authored ground rather than treating every session as a blank prompt or silently inventing a replacement profile. Availability still does not mean disclosure into every context.',
    change:
      'A Life\'s world remains intelligibly its world across changing tools. Continuity is carried as inspectable source instead of being reconstructed from application settings and scattered memories. Agents meet a ground they did not invent.',
  },
  {
    name: 'Actuation',
    office: 'living articulation',
    repo: 'https://github.com/EpiLogos/Actuation',
    what:
      'Actuation is the active substance of a Life: the causal stream through which its internality articulates itself into events, encounters actuality, and is changed by what those events disclose.\n\n' +
      'An internality is not a collection of stored objects — it does things. Internal differentiation becomes causal event; event encounters actuality; encounter leaves traces and meets resistance; discovery returns as changed internality. Perception, thought, speech and action are articulated events in a field. An LLM token, a human utterance, a gesture and a practical act participate in the same problem of a field expressing a determination which then has consequences.\n\n' +
      'Delegation, authority and orchestration are particular agentic forms of this deeper office. Explicit technological agency is one developed region of living articulation: who acts, from what determination and bounds, in relation with whom, and how attributable difference Returns. Semantic identity survives material change; process, model, harness and session remain attributable body facts — they do not, by themselves, create a new enduring actor.',
    change:
      'Internality becomes causal event, encounters actuality, and returns as changed internality. Living articulation is held open so a plurality of agents can be related without collapsing who holds authority and consequence. Authority, refusal and dissent become inspectable relations instead of assumptions hidden in orchestration code.',
  },
  {
    name: 'AIKit',
    office: 'potency',
    repo: 'https://github.com/EpiLogos/ai-kit',
    what:
      'AIKit holds the potency of a Life: the changing horizon of what it can know, express, reach and bring to bear — including what is possible, unavailable, unresolved or still becoming possible.\n\n' +
      'Capacity is subtler than an inventory. A Life\'s horizon contains what is present, absent, ambiguous, jointly possible, indeterminate and not yet articulated. Powers arise, mature, are exercised, recede, are retained or transformed. For a person: language, knowledge, skill, attention, access, the power to wield tools and the means to enquire. For an artificial actor: models, skills, knowledge horizons, tools, sessions, interfaces, execution possibilities.\n\n' +
      'Technically: exists ≠ available ≠ relevant ≠ permitted ≠ selected ≠ operative. AIKit resolves which part of that horizon can become operative here and now. An agent receives a small orientation into a larger world, then retrieves deeper material when the act requires it, instead of carrying the whole environment as standing prompt.',
    change:
      'The changing horizon of what a Life can know, express, reach and bring to bear becomes operable here and now. Models, skills, sources, sessions and interfaces can form one usable horizon a person can inspect and compose, without surrendering them to a single agent runtime.',
  },
  {
    name: 'Software Factory',
    office: 'transformative becoming',
    repo: 'https://github.com/EpiLogos/Factory',
    what:
      'Factory holds the transformative becoming of a Life: the process through which a possibility is desired, composed, tested in actuality and precipitated into a new condition from which further development proceeds.\n\n' +
      'The underlying relation is intention → action → experience → learning. Something wants to become; possibilities gather; forms enter matter; a determinate result precipitates; that result becomes material for further becoming. In software, Project, Run, Candidate, Evidence and Recognition make that continuity explicit — Software Factory as a literal instantiation of transformative becoming, not a narrower category that replaces it.\n\n' +
      'A person commissions work worth making, lets agents carry developmental labour, then meets what returned: is this the intended condition, should it go back, or must the intention itself change? Failure, resistance and surprise become information development can learn from.',
    change:
      'Intention, action, experience and learning stay in relation so development can understand itself. What is made remains answerable to what was originally meant, even when implementation moves much faster than human meaning.',
  },
  {
    name: 'Workcell',
    office: 'situated existence',
    repo: 'https://github.com/EpiLogos/Workcell',
    what:
      'Workcell holds the situated existence of a Life: the concrete here in which it finds itself, encounters a world through a bounded aperture, becomes available to others, and makes its activity materially consequential.\n\n' +
      'A Life does not first exist abstractly and then acquire a location. It finds itself already here. Body means the concrete locus through which an internality is here rather than nowhere — susceptible to the world and available within it to others.\n\n' +
      'Technologically: workspaces, processes, services, machines, networks, storage and browser surfaces are the conditions through which an act can actually occur — without those providers becoming the higher ontology of World or Agency. An agent can ask for a material capability through stable semantics, act through what was bound, and return material evidence to the system that owns the purpose of the act.',
    change:
      'Placement, aperture and material consequence become the concrete conditions through which an act can occur and through which what became real can return, without provider topology becoming the identity of the work. A Project does not become "a Docker project" merely because Docker satisfied today\'s demand.',
  },
  {
    name: 'Quaternal Logic',
    office: 'transcendent relation',
    repo: 'https://github.com/EpiLogos/QL-MEF',
    what:
      'Quaternal Logic holds Transcendent Relation: the formal movement through which unity articulates difference, difference enters relation, and an internality remains open to the larger wholes in which its own distinctions arise.\n\n' +
      'Transcendence here does not require an absolute exterior. Nesting in larger fields of co-internality is enough — other lives, communities, ecologies, worlds, the structures that condition a Life, and the wholes within which Self and Other arise as relative positions. Quaternal Logic makes that relation first-class: a means to locate, refract and compare these relations while each subject remains itself.\n\n' +
      'For an agent, it can take a reading of a subject that already exists and return attributable difference without rewriting identity into a parallel ontology. Ordinary technological agency can proceed without this centre; the horizon opens when someone wants formal location, comparison, synthesis, or an experimental test of whether a claimed relation still operates.',
    change:
      'Formal distinctions can be held open to operational consequence — including negative and null results — while each subject remains itself. A claimed relation earns its place by making a discriminable, testable difference, not by decorative terminology.',
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
        eyebrow: 'Use',
        title: 'Give artificial agents a world that persists.',
        sub: 'What you mean · what they may do · what they can bring to bear · how work develops · where it runs · how results return',
        body:
          'You use {O:I} to give artificial agents a world that persists: what you mean, what they may do, what they can bring to bear, how work develops, where it runs, and how results return to you — so capacity becomes situated agency instead of a one-shot prompt.\n\n' +
          'A person uses it to write who they are and what they refuse as durable ground that stays operative across models and sessions. An engineer uses it to build and compose that world-structure under the harness without replacing the harness itself.\n\n' +
          '{O:I} names and develops the technological field in which model capacity becomes situated agency.',
        layout: 'statement',
        tone: 'dark',
      },
      {
        eyebrow: 'How it works',
        title: 'Under the harness sits world-structure, not another stack.',
        body:
          'Durable ground, living articulation, potency horizon, intentional becoming, situated body-world, and transcendent relation. Many consequential changes to an agentic system happen without changing model weights. Persistent authored ground plus actuated capacity yields a situated technological agency.\n\n' +
          'Existing worlds people already have remain realities to enter relation with, not migrate away from. Your editor, shell, repositories, agents, skills and machines already form a real environment — start there.',
        layout: 'split',
        tone: 'light',
      },
      {
        eyebrow: 'Theory of mind as theory of world',
        title: 'To give an artificial mind a usable world, say what a world must hold.',
        body:
          'Theory of mind, here, is already theory of world: the same structures that make an agent situated also keep the account open to human life. The technology holds those structures as operable offices — ground, articulation, potency, becoming, situation, relation — addressable under changing harnesses, not by philosophising them in the prompt.\n\n' +
          'The decisive distinction the offices make operable is Objective Internality ≠ Subjective Immediacy. Objective Internality is the structured field of objects, events and relations that constitutes the world of a being. Subjective Immediacy is that world\'s first-person appearing. The technology addresses Objective Internality without pretending to exhaust or simulate first-person appearing.',
        layout: 'feature',
        tone: 'dark',
        figure: 1,
      },
      {
        eyebrow: 'Personal and shared',
        title: 'Equal weight on personal inquiry and working with agents.',
        body:
          'Both are uses of the same world-structure.\n\n' +
          'Personal. Intent preservation is the hard problem. Implementation can move faster than human meaning. You write the ground; disclosure makes relevant parts operative for an act; the agent exercises situated judgement; the world resists; evidence and difference Return; you recognise, refuse, redirect or revise.\n\n' +
          'Shared. Projection makes a representation available without transferring ownership. Independently grounded worlds can enter relation without ceasing to be separately grounded. Shared work is not a softer version of personal authorship; it is the same technology under co-internality.',
        layout: 'split',
        tone: 'light',
      },
      {
        eyebrow: 'Six offices',
        title: 'Aspects of Life as Objective Internality.',
        body:
          'Each office holds open one stretch of that structure and makes it operable. They are not a seventh layer stacked on top of Life, and not a product catalogue — custodians of stretches of one circuit.',
        items: PRODUCTS.map((product) => ({ name: product.name, detail: product.office })),
        layout: 'index',
        tone: 'dark',
      },
      {
        eyebrow: 'Where next',
        title: 'Open a centre for the stretch you need.',
        body:
          'Recover the durable language for the fuller ground. Open a centre page for the stretch you need to build against or inhabit. This landing stays the front door.',
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
      title: 'World and Life.',
      body:
        'O:I concerns World and Life. A Life is a self-disclosure within an Objective Internality: it carries a meaningful ground, articulates itself through events, possesses changing powers, develops through transformation, exists from a concrete situation, and is always already related to larger fields of life and world.',
    },
    sections: [
      {
        eyebrow: 'First language',
        title: 'A World. A Life.',
        body:
          'A World is the whole field within which something can appear, persist, relate and matter.\n\n' +
          'A Life is a self-disclosure within an internality which, in disclosing itself, also discloses the World in which it is contained.\n\n' +
          'That is universal before it is technological. Articulation is the common denominator: difference becoming determinate, relations becoming expressed, a field disclosing itself through events. Speech, thought, gesture, action, machine tokens, tool calls and agent acts are further determinations of that same problem.\n\n' +
          '{O:I} names and develops the technological field in which model capacity becomes situated agency.',
        layout: 'band',
        media: { media: 'c', poster: 3, zoom: 1.3 },
      },
      {
        eyebrow: 'Decisive distinction',
        title: 'Objective Internality ≠ Subjective Immediacy.',
        body:
          'Objective Internality is the structured field of objects, events and relations that constitutes the world of a being. Subjective Immediacy is that world\'s first-person appearing.\n\n' +
          'What appears as external is itself disclosed from within an internality. Relations between beings are relations among internalities within larger fields of co-internality. External inspection still occurs through an internality.\n\n' +
          'That distinction keeps the inquiry open and universal. Human psyche, animal life, artificial agency and larger social or technical wholes can be investigated as different forms of internally articulated worldhood. They need not possess identical Subjective Immediacy in order to share homologous structures of Objective Internality. The technology addresses Objective Internality without pretending to exhaust or simulate first-person appearing.',
        layout: 'statement',
        tone: 'light',
      },
      {
        eyebrow: 'Ref grammar',
        title: 'Relation without capture.',
        body:
          'The key primitive is the Ref: a stable logical identity by which something can be addressed independently of its present process, host, projection or storage representation.\n\n' +
          'Ref → Relation → Operation → Consequence → Return\n\n' +
          'A Ref says this. A Relation says how this stands with that. An Operation says what can happen through that relation. Binding or resolution makes the abstract relation real here. Projection or disclosure says what another world can encounter without acquiring the source. Provenance, evidence and Return say where this came from, what actually happened, and how the result can alter the world from which the act began.\n\n' +
          'Central source remains Central source. An Actuation agency remains an agency. An AIKit resource retains its provider identity. A Factory run remains a run. A Workcell material world remains Workcell-owned. Quaternal Logic refracts those subjects rather than renaming them. The abstract field still terminates in real functions, files, agents, APIs, providers, processes and machines.',
        layout: 'split',
        tone: 'dark',
      },
      {
        eyebrow: 'Living-primitive rule',
        title: 'A term stays alive when its defining relation stays attached.',
        body:
          'Never define a primitive only by what category it belongs to. Define what it relates, what it changes, and what observable consequence makes that meaning real. That living-primitive rule is the bridge from meaning into executable technical function.\n\n' +
          'The six offices are aspects of Life as Objective Internality — how that Life is held open as durable, operable structure — not a seventh layer stacked on top of Life.',
        items: [
          { name: 'Central', detail: 'meaningful continuity' },
          { name: 'Actuation', detail: 'living articulation' },
          { name: 'AIKit', detail: 'potency' },
          { name: 'Software Factory', detail: 'transformative becoming' },
          { name: 'Workcell', detail: 'situated existence' },
          { name: 'Quaternal Logic', detail: 'transcendent relation' },
        ],
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
      body:
        'Each office holds open one stretch of Life as Objective Internality and makes it operable. Centres deepen each office from durable language. They compose through O:I where their responsibilities meet — and remain usable independently.',
    },
    sections: [
      {
        eyebrow: PRODUCTS[0].office,
        title: PRODUCTS[0].name,
        body: PRODUCTS[0].what,
        items: [
          { name: 'What it changes', detail: PRODUCTS[0].change },
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
          { name: 'What it changes', detail: PRODUCTS[1].change },
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
          { name: 'What it changes', detail: PRODUCTS[2].change },
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
          { name: 'What it changes', detail: PRODUCTS[3].change },
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
          { name: 'What it changes', detail: PRODUCTS[4].change },
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
          { name: 'What it changes', detail: PRODUCTS[5].change },
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
      title: 'Independently grounded worlds in relation.',
      body:
        'A World is the whole field within which something can appear, persist, relate and matter. A Shared Field is where independently grounded worlds meet without either losing its source identity and provenance.',
    },
    sections: [
      {
        eyebrow: 'Projection',
        title: 'Source stays with the world.',
        body:
          'Projection makes a representation available without transferring ownership. The source keeps its canonical identity; the projection carries enough provenance for another participant to understand where it came from.\n\n' +
          'The same distinction matters when the source is personal or human-authored. Making a bounded part of a person\'s ground agent-readable or publicly shareable is not the same as transferring ownership of the source.',
        layout: 'band',
        media: { media: 'a', poster: 1, zoom: 1.3 },
      },
      {
        eyebrow: 'Co-internality',
        title: 'Shared work is the same technology under co-internality.',
        body:
          'Independently grounded worlds can enter relation without ceasing to be separately grounded. Return still lands at the locus that can recognise and revise — alone, and with others.\n\n' +
          'Shared work is not a softer version of personal authorship. What was projected, how it was encountered, what difference was returned, and how that difference later changed either world — legibility without capture.',
        layout: 'statement',
        tone: 'light',
      },
      {
        eyebrow: 'Relation without capture',
        title: 'Each subject remains itself.',
        body:
          'Central source remains Central source. An Actuation agency remains an agency. An AIKit resource retains its provider identity. A Factory run remains a run. A Workcell material world remains Workcell-owned. Quaternal Logic refracts those subjects rather than renaming them.',
        layout: 'split',
        tone: 'dark',
      },
      {
        eyebrow: 'Explore',
        title: 'Where those worlds become visible.',
        body:
          'Explore is the public surface for addressable worlds, agents, projections and contributions — each carrying provenance. Open it to search, filter and inspect the worlds and contributions that have chosen to be visible.',
        layout: 'feature',
        tone: 'light',
        figure: 2,
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
      title: 'An open research platform for situated agency.',
      body:
        'The object is the technological world around model capacity — the field in which capacity becomes situated agency. We build these structures so the community can use them, vary them, compare them and return evidence about what they actually change.',
    },
    sections: [
      {
        eyebrow: 'What we study',
        title: 'Theory of mind as theory of world.',
        body:
          'To give an artificial mind a usable world, you must say what a world must hold for any life that acts, remembers, develops and returns. The same structures that make an agent situated also keep the account open to human life.\n\n' +
          'Capacity is what the model and compute can provide. Provisioning is what an act has available. Potentiation is what becomes possible because the surrounding structure has a particular form. Many consequential changes happen without changing model weights.',
        layout: 'band',
        media: { media: 'd', poster: 2, zoom: 1.3 },
      },
      {
        eyebrow: 'Human authorship',
        title: 'Intent preservation is the hard problem.',
        body:
          'Implementation can move faster than human meaning. An agent can convert a phrase into types, tickets, tests and interfaces within hours; each step can be locally competent while gradually deleting the reason the phrase mattered.\n\n' +
          'Authored intent and ordinary work must survive the lifecycle of whichever agent product is current. The human can author durable parts of the operative world from which later agency proceeds — and Central gives that question a concrete technical shape. You write the ground; disclosure makes relevant parts operative; evidence and difference Return; you recognise, refuse, redirect or revise.',
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
        title: 'Formal distinctions held open to operational consequence.',
        body:
          'Where a formal distinction is claimed to matter, implementation should make a discriminable difference. Negative and null results are legitimate and return to the research. Quaternal Logic refracts subjects rather than renaming them — operational consequence, not decorative form.',
        layout: 'statement',
        tone: 'light',
      },
      {
        eyebrow: 'Collective',
        title: 'Community is part of the method.',
        body:
          'Abstraction → SDK → local accommodation → fixture + evidence → share → reproduce → return. Reference implementations open paths; community implementations widen the field. No single team inhabits the whole possibility space.',
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
      body:
        '`oi` is the local doorway into the composed system. An engineer uses it to build and compose world-structure under the harness without replacing the harness itself. The extension direction matters equally: native SDKs and public contracts let developers connect the technologies they already use.',
    },
    sections: [
      {
        eyebrow: 'Doorway',
        title: 'Extend the world you already use.',
        body:
          'Existing worlds people already have remain realities to enter relation with, not migrate away from. Public contracts and SDKs let real technologies join the field as providers, connectors and fixtures — not private patches.\n\n' +
          'Install steps, CLI tables and alias dumps live in repository docs when earned. This page stays the doorway: what you enter through, and how extension works — not an install dump.',
        layout: 'statement',
        tone: 'light',
      },
      {
        eyebrow: 'Where to look',
        title: 'Source and governing documents.',
        items: [
          { name: 'Install guide', detail: 'docs/INSTALL.md — when you need the supported path' },
          { name: 'CLI surface', detail: 'docs/CLI.md — current oi commands' },
          { name: 'Founding positions', detail: 'docs/positions/FOUNDING-POSITIONS.md' },
          { name: 'Architecture', detail: 'docs/ARCHITECTURE.md — product and whole-level seams' },
          { name: 'Shared Field', detail: 'docs/SHARED-FIELD.md' },
          { name: 'Research protocol', detail: 'docs/RESEARCH-PROTOCOL.md' },
        ],
        layout: 'index',
        tone: 'dark',
      },
      {
        eyebrow: 'Composition',
        title: 'Two package relations, not one.',
        body:
          'The ordinary `oi` distribution and the O:I extension envelope solve different problems. Until the public distribution package lands, the repository install guide remains the source of truth for installing the command.',
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
      body:
        'Explore is a distinct application surface. It renders addressable worlds, agents, projections and contributions from the shared-field read model, each carrying provenance — so independently grounded worlds can be encountered without capture.',
    },
    sections: [
      {
        eyebrow: 'Open',
        title: 'Enter the field.',
        body:
          'Open the Explore application to search, filter and inspect the worlds and contributions that have chosen to be visible. Each object carries provenance and can open outward into the world and source relations around it.\n\n' +
          'The same field can carry reusable work on O:I itself: integration fixtures, providers, connectors, studies and reproductions as attributable contributions rather than private setup knowledge.',
        layout: 'band',
        media: { media: 'b', poster: 3, zoom: 1.3 },
      },
      {
        eyebrow: 'Relation',
        title: 'Legibility without capture.',
        body:
          'Projection makes a representation available without transferring ownership. Independently grounded worlds meet; Return still lands at the locus that can recognise and revise. Explore makes that relation visible.',
        layout: 'statement',
        tone: 'light',
      },
    ],
  },
];
