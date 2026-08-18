import type { CSSProperties, ReactNode } from 'react';
import { getBody, getChild, getSection } from '@/lib/public-content';

type CentreVisual = {
  id: string;
  layout: 'split' | 'split-reverse' | 'wide';
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

const CENTRE_VISUALS: CentreVisual[] = [
  {
    id: 'central',
    layout: 'split',
    figure: <ContinuityFigure />,
    figureLabel: 'Above a line: models, interfaces, machines and runtimes — all of which change. Below the line: your ground, which remains.',
  },
  {
    id: 'actuation',
    layout: 'split-reverse',
    figure: <ActuationFigure />,
    figureLabel: 'A determining locus sends purpose, bounds and authority downward through delegation; a labouring locus returns resistance, evidence and consequence upward.',
  },
  {
    id: 'aikit',
    layout: 'wide',
    figure: <DisclosureFigure />,
    figureLabel: 'Progressive disclosure of a horizon: what models are here, what they can reach, which skills apply, what it costs, how it composes.',
  },
  {
    id: 'factory',
    layout: 'wide',
    figure: <MovementFigure />,
    figureLabel: 'A movement: commission, development, candidate, encounter, recognition — with Return altering the next commission.',
  },
  {
    id: 'workcell',
    layout: 'split',
    figure: <CrossingFigure />,
    figureLabel: 'A crossing: on one side a demand — a workspace that can build and serve this; on the other, a material body — workspace, process, service, evidence.',
  },
  {
    id: 'ql',
    layout: 'split-reverse',
    figure: <ParityFigure />,
    figureLabel: 'A cycle: proposition, executable articulation, operational consequence, renewed understanding — repeating at a different level, or failing informatively.',
  },
];

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
 * The six products as differentiated centres. Public words are projected from
 * site/content/public-site.md; this component owns only visual composition.
 */
export function CentresSection() {
  return (
    <div className="centres">
      {CENTRE_VISUALS.map((visual) => {
        const centre = centreContent(visual.id);
        return (
          <article key={centre.id} id={centre.id} className={`centre centre--${visual.layout}`}>
            <header className="centre__head">
              <h2>{centre.name}</h2>
              <p className="centre__lede">{centre.lede}</p>
            </header>
            <div className="centre__figure" role="img" aria-label={visual.figureLabel}>
              {visual.figure}
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
                {centre.id === 'ql' ? <a className="centre__pointer" href="./research.html">Research framing →</a> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
