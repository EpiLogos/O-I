import type { CSSProperties, ReactNode } from 'react';

type Centre = {
  name: string;
  lede: string;
  layout: 'split' | 'split-reverse' | 'wide';
  what: string;
  why: string;
  change: string;
  capabilities: string;
  href: string;
  pointer?: { label: string; href: string };
  figure: ReactNode;
  figureLabel: string;
};

function ContinuityFigure() {
  return (
    <div className="figure figure--continuity">
      <div className="figure--continuity-changing">
        <span>models</span><span>interfaces</span><span>machines</span><span>runtimes</span>
      </div>
      <span className="figure-caption">everything above this line changes</span>
      <div className="figure--continuity-rule" aria-hidden="true" />
      <div className="figure--continuity-ground">your ground</div>
      <span className="figure-caption">what remains</span>
    </div>
  );
}

function ActuationFigure() {
  return (
    <div className="figure figure--actuation">
      <div className="figure--actuation-locus">
        <strong>Determining</strong>
        <span>purpose · bounds · authority</span>
      </div>
      <div className="figure--actuation-flow" aria-hidden="true">
        <span>↓ delegation</span>
        <span>↑ return</span>
      </div>
      <div className="figure--actuation-locus">
        <strong>Labouring</strong>
        <span>resistance · evidence · consequence</span>
      </div>
    </div>
  );
}

function DisclosureFigure() {
  const rows = [
    'What models are here?',
    'What can they reach?',
    'Which skills apply?',
    'What will it cost?',
    'How does it compose?',
  ];
  return (
    <div className="figure figure--disclosure">
      {rows.map((row, index) => (
        <div key={row} className="figure--disclosure-row" style={{ '--oi-disclosure-depth': index } as CSSProperties}>
          {row}
        </div>
      ))}
    </div>
  );
}

function MovementFigure() {
  const beats = ['Commission', 'Development', 'Candidate', 'Encounter', 'Recognition'];
  return (
    <div className="figure figure--movement">
      <div className="figure--movement-beats">
        {beats.map((beat, index) => (
          <span key={beat} className="figure--movement-beat">
            {index > 0 ? <span className="figure--movement-arrow" aria-hidden="true">→</span> : null}
            {beat}
          </span>
        ))}
      </div>
      <span className="figure-caption">Return alters the next commission</span>
    </div>
  );
}

function CrossingFigure() {
  return (
    <div className="figure figure--crossing">
      <div className="figure--crossing-side">
        <strong>Demand</strong>
        <span>a workspace that can build and serve this</span>
      </div>
      <div className="figure--crossing-threshold" aria-hidden="true">⟶</div>
      <div className="figure--crossing-side">
        <strong>Material body</strong>
        <span>workspace · process · service · evidence</span>
      </div>
    </div>
  );
}

function ParityFigure() {
  const beats = ['Proposition', 'Executable articulation', 'Operational consequence', 'Renewed understanding'];
  return (
    <div className="figure figure--parity">
      {beats.map((beat, index) => (
        <div key={beat} className="figure--parity-beat">
          <span className="figure--parity-index" aria-hidden="true">{index + 1}</span>
          {beat}
        </div>
      ))}
      <span className="figure-caption">the cycle repeats at a different level — or fails, informatively</span>
    </div>
  );
}

const CENTRES: Centre[] = [
  {
    name: 'Central',
    lede: 'A world that remains yours.',
    layout: 'split',
    what:
      'The persistent, human-authored ground of a technological world: intent, conventions and sources held in a control plane; projects and ordinary files held in work trees; machine and tool context treated as first-class material.',
    why:
      'Models, interfaces, machines and agent runtimes now turn over faster than the work they serve. Without an owned ground, continuity belongs to whichever application happens to be current — and leaves when it does.',
    change:
      'The continuity moves to you. An agent returns to the same world across sessions and across tools; a human changes models, editors or machines without losing the thread of their own work.',
    capabilities: 'Authored control plane · ordinary work trees · machine and tool intent · durable conventions',
    href: 'https://github.com/EpiLogos/Central',
    figure: <ContinuityFigure />,
    figureLabel: 'Above a line: models, interfaces, machines and runtimes — all of which change. Below the line: your ground, which remains.',
  },
  {
    name: 'Actuation',
    lede: 'Downward authority requires upward reality.',
    layout: 'split-reverse',
    what:
      'The constitution of agency itself: who or what is acting, under whose authority, within what bounds, as which identity — and how what execution encounters returns to alter the governing intention.',
    why:
      'Running a model is not yet agency. Delegation creates a structure: a determining locus supplies purpose, scope and permission; a labouring locus meets resistance, error and consequence. If reality has no path back upward, command becomes insulated from what it causes.',
    change:
      'Agency becomes differentiated and inspectable: commissioning and refusal, federation without absorption, dissent and failure as attributable positions rather than vanished noise.',
    capabilities: 'Situated agents and agencies · actuation loops · authority and bounds · federation · Return',
    href: 'https://github.com/EpiLogos/Actuation',
    figure: <ActuationFigure />,
    figureLabel: 'A determining locus sends purpose, bounds and authority downward through delegation; a labouring locus returns resistance, evidence and consequence upward.',
  },
  {
    name: 'AIKit',
    lede: 'A horizon that discloses itself.',
    layout: 'wide',
    what:
      'The discovery and composition layer for a real setup: models, skills, tools, actions, sources, sessions, runtimes and surfaces made findable, inspectable and composable across heterogeneous hosts.',
    why:
      'Real worlds are accumulations, not clean installs. Capability that cannot be found does not exist for the actor — and capability that must be rewritten into one runtime before use destroys the world it was found in.',
    change:
      'Entering a situation becomes progressive disclosure: what is available here, what it needs, what it costs, how it composes — while the heterogeneity that made the world worth having stays intact.',
    capabilities: 'Brokered capabilities · provenance-first discovery · cross-runtime composition · managed installation',
    href: 'https://github.com/EpiLogos/ai-kit',
    figure: <DisclosureFigure />,
    figureLabel: 'Progressive disclosure of a horizon: what models are here, what they can reach, which skills apply, what it costs, how it composes.',
  },
  {
    name: 'Software Factory',
    lede: 'Vision survives the labour.',
    layout: 'wide',
    what:
      'Developmental continuity for agentic software work: the durable relation from authored intention through design, implementation and evidence to candidate realities — and on to Recognition and Return.',
    why:
      'Agentic development can produce technically competent change at a speed that deletes the reason the work mattered. A system can preserve every noun in the specification and lose the proposition.',
    change:
      'The commission stays visible through the labour. Work returns as evidenced candidates a human can recognise, reject or be changed by — and development leaves durable objects: runs, evidence, decisions — not just chat transcripts.',
    capabilities: 'Commission and recognition loops · run and evidence ledgers · candidate management · developmental Return',
    href: 'https://github.com/EpiLogos/agent-system-design',
    figure: <MovementFigure />,
    figureLabel: 'A movement: commission, development, candidate, encounter, recognition — with Return altering the next commission.',
  },
  {
    name: 'Workcell',
    lede: 'Intention crosses into matter.',
    layout: 'split',
    what:
      'The passage from declared need to inhabited computational world: a demand for an environment — workspace, process, service, container, virtual machine, host — made materially real, with lifecycle, bindings and observed evidence.',
    why:
      'Agency is always materially situated somewhere, even when the higher layers are properly provider-neutral. An intention that cannot cross into an actual environment remains a description.',
    change:
      '“I need a place where this can run” becomes an inspectable event — prepared, observed, evidenced, released — instead of an improvised shell history nobody can reconstruct.',
    capabilities: 'Demand and realisation · lifecycle evidence · bindings to labouring agencies · machine-level clarity',
    href: 'https://github.com/EpiLogos/Workcell',
    figure: <CrossingFigure />,
    figureLabel: 'A crossing: on one side a demand — a workspace that can build and serve this; on the other, a material body — workspace, process, service, evidence.',
  },
  {
    name: 'Quaternal Logic',
    lede: 'Metaphysics, made answerable.',
    layout: 'split-reverse',
    what:
      'The formal and experimental field of the programme: refraction, synthesis, recurrence and relation as operative machinery — archetypal and philosophical structures made executable enough to test.',
    why:
      'O:I suspects that the material-computational starting point of mainstream AI engineering is not the only possible one. Suspicion is cheap; this centre exists to give alternative formal claims somewhere precise to be wrong.',
    change:
      'A formal proposition stops being commentary and becomes an experiment: if a claimed structure is real for a system, changing it must change what the system can do. Operational parity is the test.',
    capabilities: 'Executable formal structures · parity experiments · discriminable outcomes · renewed understanding',
    href: 'https://github.com/EpiLogos/QL-MEF',
    pointer: { label: 'The honest framing — provenance, limits, and what counts as an answer', href: '#research' },
    figure: <ParityFigure />,
    figureLabel: 'A cycle: proposition, executable articulation, operational consequence, renewed understanding — repeating at a different level, or failing informatively.',
  },
];

/**
 * The six products as differentiated centres. Each block answers what it is,
 * why it exists, and what changes because it exists — before capabilities —
 * and each carries its own figure, composition and rhythm.
 */
export function CentresSection() {
  return (
    <div className="centres">
      {CENTRES.map((centre) => (
        <article key={centre.name} className={`centre centre--${centre.layout}`}>
          <header className="centre__head">
            <h3>{centre.name}</h3>
            <p className="centre__lede">{centre.lede}</p>
          </header>
          <div className="centre__figure" role="img" aria-label={centre.figureLabel}>
            {centre.figure}
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
                <span>Native centre</span>
                <strong>{centre.href.replace('https://github.com/', '')}</strong>
                <span aria-hidden="true">↗</span>
              </a>
              {centre.pointer ? <a className="centre__pointer" href={centre.pointer.href}>{centre.pointer.label} ↓</a> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
