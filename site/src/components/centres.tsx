import { getBody, getChild, getSection } from '@/lib/public-content';

type ArchitectureNode = {
  name: string;
  detail: string;
};

type ArchitectureColumn = {
  label: string;
  nodes: ArchitectureNode[];
};

type CentreVisual = {
  id: string;
  tone: 'light' | 'dark';
  columns: ArchitectureColumn[];
  figureLabel: string;
};

const CENTRE_VISUALS: CentreVisual[] = [
  {
    id: 'central',
    tone: 'light',
    figureLabel: 'Central architecture: owned Control and Work source, operated through ctrl Actions and machine-specific connectors, with derived state kept subordinate.',
    columns: [
      {
        label: 'Owned world',
        nodes: [
          { name: 'Control/', detail: 'user · agents · machines' },
          { name: 'Work/', detail: 'ordinary projects + files' },
          { name: '.central/', detail: 'derived local state' },
        ],
      },
      {
        label: 'Stable operation',
        nodes: [
          { name: 'ctrl', detail: 'native CLI' },
          { name: 'Actions / SDK', detail: 'stable operations over the world' },
        ],
      },
      {
        label: 'Environment binding',
        nodes: [
          { name: 'connectors/', detail: 'replaceable integrations' },
          { name: 'host tools', detail: 'machine + application reality' },
        ],
      },
    ],
  },
  {
    id: 'actuation',
    tone: 'dark',
    figureLabel: 'Actuation architecture: Agent identity becomes situated Agency with purpose, world binding, authority and bounds; Actuation may delegate, derive or federate; Return carries encountered reality back.',
    columns: [
      {
        label: 'Identity',
        nodes: [{ name: 'Agent', detail: 'enduring identity' }],
      },
      {
        label: 'Situated agency',
        nodes: [
          { name: 'Agency', detail: 'purpose · authority · bounds' },
          { name: 'WorldBinding', detail: 'where the Agency stands' },
        ],
      },
      {
        label: 'Actuation',
        nodes: [
          { name: 'determine', detail: 'authorise an act' },
          { name: 'delegate / derive / federate', detail: 'compose agency without identity collapse' },
        ],
      },
      {
        label: 'Return',
        nodes: [{ name: 'Return', detail: 'evidence · dissent · outcome · changed understanding' }],
      },
    ],
  },
  {
    id: 'aikit',
    tone: 'light',
    figureLabel: 'AIKit architecture: discover a heterogeneous capability and source field, resolve it for the current project and Agency, compose runtime bodies and sessions, then disclose the resulting horizon through Surfaces and explanation.',
    columns: [
      {
        label: 'Discover',
        nodes: [
          { name: 'models + CLI agents', detail: 'available inference / harness surfaces' },
          { name: 'Skills + Actions', detail: 'procedures + invocable powers' },
          { name: 'ContextSources', detail: 'knowledge + project sources' },
        ],
      },
      {
        label: 'Resolve',
        nodes: [
          { name: 'Context', detail: 'project · task · Agency' },
          { name: 'Capability field', detail: 'relevant · permitted · available' },
        ],
      },
      {
        label: 'Compose',
        nodes: [
          { name: 'HarnessComposition', detail: 'runtime Components + services' },
          { name: 'sessions / muxes', detail: 'active working bodies' },
        ],
      },
      {
        label: 'Disclose',
        nodes: [
          { name: 'Surfaces', detail: 'human + agent interfaces' },
          { name: 'Explain / History', detail: 'why this horizon exists' },
        ],
      },
    ],
  },
  {
    id: 'factory',
    tone: 'dark',
    figureLabel: 'Software Factory architecture: a Project and Commission enter a durable Run and RunMap, development produces Candidate and Evidence, and Recognition returns reality into the Project.',
    columns: [
      {
        label: 'Authored ground',
        nodes: [
          { name: 'Project', detail: 'intent · vision · current understanding' },
          { name: 'Commission', detail: 'work worth undertaking' },
        ],
      },
      {
        label: 'Development',
        nodes: [
          { name: 'Run / RunMap', detail: 'durable intended transformation' },
          { name: 'design + implementation', detail: 'agentic + deterministic labour' },
        ],
      },
      {
        label: 'Returned reality',
        nodes: [
          { name: 'Candidate', detail: 'executable possible reality' },
          { name: 'Evidence', detail: 'tests · observations · decisions' },
        ],
      },
      {
        label: 'Recognition',
        nodes: [
          { name: 'Recognition', detail: 'human / authorised judgement' },
          { name: 'Return', detail: 'revises future Project ground' },
        ],
      },
    ],
  },
  {
    id: 'workcell',
    tone: 'light',
    figureLabel: 'Workcell architecture: provider-neutral demand becomes a plan, provider selection and BindingGraph, concrete material resources, then observed lifecycle evidence and release.',
    columns: [
      {
        label: 'Demand',
        nodes: [{ name: 'Demand', detail: 'what computational world is required' }],
      },
      {
        label: 'Resolve',
        nodes: [
          { name: 'Plan', detail: 'provider-neutral material plan' },
          { name: 'provider matching', detail: 'which real substrate can satisfy it' },
        ],
      },
      {
        label: 'Bind',
        nodes: [{ name: 'BindingGraph', detail: 'source · service · network · resource relations' }],
      },
      {
        label: 'Materialise',
        nodes: [
          { name: 'workspace / process / service', detail: 'running software' },
          { name: 'container / VM / host', detail: 'placement + isolation' },
        ],
      },
      {
        label: 'Lifecycle',
        nodes: [{ name: 'observe · collect · retain · release', detail: 'material evidence + cleanup' }],
      },
    ],
  },
  {
    id: 'ql',
    tone: 'dark',
    figureLabel: 'Quaternal Logic architecture: formal source propositions become explicit references and operators, MEF refraction and provider operations, provenance-bearing readings, experiments and returned evidence.',
    columns: [
      {
        label: 'Formal source',
        nodes: [{ name: 'proposition', detail: 'relation · recurrence · archetypal form' }],
      },
      {
        label: 'Executable form',
        nodes: [
          { name: 'QL refs / operators', detail: 'specified formal structures' },
          { name: 'MEF registry', detail: 'twelve-lens manifold' },
        ],
      },
      {
        label: 'Refraction',
        nodes: [
          { name: 'providers / services', detail: 'operational implementations' },
          { name: 'readings', detail: 'provenance-bearing outputs' },
        ],
      },
      {
        label: 'Experiment',
        nodes: [{ name: 'operational parity', detail: 'discriminable consequence + evidence' }],
      },
      {
        label: 'Return',
        nodes: [{ name: 'revision', detail: 'formal / technical account changes' }],
      },
    ],
  },
];

function ProductArchitectureFigure({ visual }: { visual: CentreVisual }) {
  return (
    <div className="product-map" role="img" aria-label={visual.figureLabel}>
      <div className="product-map__flow">
        {visual.columns.map((column, index) => (
          <div className="product-map__step" key={`${visual.id}-${column.label}`}>
            {index > 0 ? <span className="product-map__arrow" aria-hidden="true">→</span> : null}
            <div className="product-map__column">
              <span className="product-map__label">{column.label}</span>
              <div className="product-map__nodes">
                {column.nodes.map((node) => (
                  <div className="product-map__node" key={`${column.label}-${node.name}`}>
                    <strong>{node.name}</strong>
                    <span>{node.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function centreContent(id: string) {
  const node = getSection('products', id);
  return {
    id,
    name: node.title,
    summary: getChild(node, 'summary').title,
    lede: getChild(node, 'lede').title,
    what: getBody(node, 'what'),
    why: getBody(node, 'why'),
    change: getBody(node, 'change'),
    capabilities: getBody(node, 'capabilities'),
    href: getBody(node, 'repo').trim(),
  };
}

export function CentresIndex() {
  return (
    <div className="centre-index">
      {CENTRE_VISUALS.map(({ id }) => {
        const centre = centreContent(id);
        return (
          <a key={id} className="centre-index__item" href={`./products.html#${id}`}>
            <span className="centre-index__name">{centre.name}</span>
            <span className="centre-index__summary">{centre.summary}</span>
            <span className="centre-index__arrow" aria-hidden="true">↗</span>
          </a>
        );
      })}
    </div>
  );
}

/**
 * The six native products. Public prose is projected from
 * site/content/public-site.md; this component owns the architecture figures
 * and page composition derived from the accepted product/architecture docs.
 */
export function CentresSection() {
  return (
    <div className="centres centres--product-page">
      {CENTRE_VISUALS.map((visual) => {
        const centre = centreContent(visual.id);
        return (
          <article key={centre.id} id={centre.id} className={`centre centre--wide centre--tone-${visual.tone}`}>
            <header className="centre__head">
              <span className="centre__summary">{centre.summary}</span>
              <h2>{centre.name}</h2>
              <p className="centre__lede">{centre.lede}</p>
            </header>
            <div className="centre__figure">
              <ProductArchitectureFigure visual={visual} />
            </div>
            <div className="centre__body">
              <div className="centre__passage">
                <span className="centre__label">What it is</span>
                <p>{centre.what}</p>
              </div>
              <div className="centre__passage">
                <span className="centre__label">Why it exists</span>
                <p>{centre.why}</p>
              </div>
              <div className="centre__passage">
                <span className="centre__label">What changes</span>
                <p>{centre.change}</p>
              </div>
              <p className="centre__capabilities">{centre.capabilities}</p>
              <div className="centre__links">
                <a className="link-arrow centre__repo" href={centre.href} target="_blank" rel="noreferrer">
                  <span>Native repository</span>
                  <strong>{centre.href.replace('https://github.com/', '')}</strong>
                  <span aria-hidden="true">↗</span>
                </a>
                {centre.id === 'ql' ? <a className="centre__pointer" href="./research.html#ql">Research programme →</a> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}