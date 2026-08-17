import './ai-stack-aperture.css';

type StackRelation = {
  concern: string;
  primary: string;
  support: string;
  distinction: string;
};

const relations: StackRelation[] = [
  {
    concern: 'Agents · orchestration',
    primary: 'Actuation',
    support: 'AIKit · Workcell',
    distinction: 'Agency is semantic identity and relation; the harness and execution body remain separate.',
  },
  {
    concern: 'Context · tools · model routing',
    primary: 'AIKit',
    support: 'Central · Factory · Actuation',
    distinction: 'Resolve the operative field here and now without reducing Context to prompt tokens.',
  },
  {
    concern: 'Coding agents · evals',
    primary: 'Software Factory',
    support: 'AIKit · Actuation · Workcell',
    distinction: 'Development keeps Runs, candidates, evidence and decisions instead of becoming a tool-call transcript.',
  },
  {
    concern: 'Sandboxes · serving · GPUs',
    primary: 'Workcell',
    support: 'AIKit · Factory',
    distinction: 'Material execution is its own boundary; a container, endpoint or GPU is not semantic identity.',
  },
  {
    concern: 'Memory · durable workspace',
    primary: 'Central',
    support: 'AIKit · Factory',
    distinction: 'Human-authored ground stays distinct from agent memory, session history and the model context window.',
  },
  {
    concern: 'MCP · A2A · formal relation',
    primary: 'AIKit · O:I · Quaternal Logic',
    support: 'Actuation',
    distinction: 'Protocols move capabilities and relations; they do not define Agent identity, authority or Agency.',
  },
];

const guideHref =
  'https://github.com/EpiLogos/O-I/blob/agent/ql-relational-field/docs/AI-ENGINEERING-FIELD-GUIDE.md';

export function AIStackAperture() {
  return (
    <aside className="stack-aperture" aria-labelledby="stack-aperture-title">
      <div className="stack-aperture__intro">
        <div>
          <div className="stack-aperture__eyebrow">HOW THIS MAPS TO THE AI STACK</div>
          <h2 id="stack-aperture-title">Familiar terms. Clearer boundaries.</h2>
        </div>
        <div className="stack-aperture__copy">
          <p>
            O:I covers recognisable concerns—agents, context engineering, tools, coding agents, evals, sandboxes,
            serving, memory and protocols—without pretending they are all the same layer.
          </p>
          <a className="link-arrow" href={guideHref} target="_blank" rel="noreferrer">
            Full AI engineering field guide
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <div className="stack-relations" role="table" aria-label="Modern AI stack concerns mapped to the O:I field">
        <div className="stack-relations__head" role="row">
          <span role="columnheader">Familiar concern</span>
          <span role="columnheader">Primary locus</span>
          <span role="columnheader">Works with</span>
          <span role="columnheader">Boundary O:I keeps visible</span>
        </div>
        {relations.map((relation) => (
          <div className="stack-relation" role="row" key={relation.concern}>
            <span className="stack-relation__concern" role="cell">
              {relation.concern}
            </span>
            <span className="stack-relation__primary" role="cell">
              {relation.primary}
            </span>
            <span className="stack-relation__support" role="cell">
              {relation.support}
            </span>
            <span className="stack-relation__distinction" role="cell">
              {relation.distinction}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
