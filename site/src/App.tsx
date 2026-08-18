import type { ReactNode } from 'react';
import { AIStackAperture } from '@/components/ai-stack-aperture';
import { OICube } from '@/components/ui/oi-cube';
import { OIGlyph } from '@/components/ui/oi-mark';
import { ParallaxComponent } from '@/components/ui/parallax-scrolling';

const OI = 'O:I';

type ProductSurface = {
  name: string;
  intent: string;
  what: string;
  why: string;
  href: string;
};

const products: ProductSurface[] = [
  {
    name: 'Central',
    intent: 'A durable place to stand.',
    what:
      'Human-authored Control, ordinary Work, machine intent, and the stable conventions that let an agent return to the same world.',
    why: 'Without ground, every session starts from scratch. Central keeps the world authored and recoverable.',
    href: 'https://github.com/EpiLogos/Central',
  },
  {
    name: 'Actuation',
    intent: 'Agency you can commission, inspect and relate.',
    what:
      'Situated Agents, Agencies, actuation loops, harnesses, and the composition of agentic work.',
    why: 'A model has capacity; Actuation places that capacity into a loop that can act, observe and continue.',
    href: 'https://github.com/EpiLogos/Actuation',
  },
  {
    name: 'AIKit',
    intent: 'The operative world becomes usable.',
    what:
      'Capability resolution, skills, tools, Actions, sources, models, sessions, profiles and context.',
    why: 'An agent needs to know what it can reach and how to reach it without rebuilding the environment each time.',
    href: 'https://github.com/EpiLogos/ai-kit',
  },
  {
    name: 'Software Factory',
    intent: 'Intention becomes evidenced development.',
    what:
      'Projects, Runs, Run Maps, candidates, claims, evidence, decisions and recognition.',
    why: 'Agentic work that matters needs to leave durable developmental objects, not just chat transcripts.',
    href: 'https://github.com/EpiLogos/agent-system-design',
  },
  {
    name: 'Workcell',
    intent: 'Give agency a material body.',
    what:
      'Execution environments, services, workspaces, containers, machines, endpoints and lifecycle.',
    why: 'Ideas stay ideas until they can run somewhere; Workcell makes the computational world explicit.',
    href: 'https://github.com/EpiLogos/Workcell',
  },
  {
    name: 'Quaternal Logic',
    intent: 'Make relation recursive.',
    what:
      'Formal position, refraction, synthesis, and executable semantic machinery.',
    why: 'When the structures of agency themselves become inspectable, the field can study and improve itself.',
    href: 'https://github.com/EpiLogos/QL-MEF',
  },
];

function GitHubIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" width="18" height="18">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`link-arrow ${className}`.trim()}>
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function ProductField() {
  return (
    <section id="products" className="section section--black oi-surface-dark" aria-labelledby="products-title">
      <div className="section__eyebrow">Six centres, one field</div>
      <div className="section__grid section__grid--heading">
        <h2 id="products-title" className="feature-title feature-title--wide">
          The {OI} family can be small or grow as the work grows.
        </h2>
        <p className="feature-copy">
          Each centre answers a concrete need. Together they describe the technological field through which model capacity
          becomes situated agency. Install one, or compose the whole.
        </p>
      </div>

      <div className="product-field" role="list" aria-label="O:I product field">
        {products.map((product) => (
          <a
            key={product.name}
            className="product-row"
            href={product.href}
            target="_blank"
            rel="noreferrer"
            role="listitem"
          >
            <div className="product-row__visible">
              <span className="product-row__name" role="presentation">
                {product.name}
              </span>
              <span className="product-row__intent" role="presentation">
                {product.intent}
              </span>
              <span className="product-row__arrow" aria-hidden="true">
                ↗
              </span>
            </div>
            <div className="product-row__detail">
              <p className="product-row__what" role="presentation">
                {product.what}
              </p>
              <p className="product-row__why" role="presentation">
                {product.why}
              </p>
            </div>
          </a>
        ))}
      </div>

      <AIStackAperture />
    </section>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="site-nav" aria-label="Primary navigation">
        <a href="#top" className="site-nav__mark" aria-label="O:I home">
          <OIGlyph />
        </a>
        <nav className="site-nav__links">
          <a href="#understand">Understand</a>
          <a href="./explore.html">Explore</a>
          <a href="#build">Build</a>
          <ExternalLink href="https://github.com/EpiLogos/O-I" className="site-nav__github">
            GitHub
          </ExternalLink>
        </nav>
      </header>

      <main id="top" data-oi-surface="projection-root" data-oi-state="front-door">
        <ParallaxComponent />

        <section id="what" className="section section--black oi-surface-dark" aria-labelledby="what-title">
          <div className="section__eyebrow">What is {OI}</div>
          <div className="section__grid section__grid--intro">
            <h2 id="what-title" className="display-copy display-copy--compact">
              {OI} is an architecture for the engineering around the model.
            </h2>
            <div className="body-copy body-copy--lead">
              <p>
                A model supplies capacity. What that capacity can do depends on the world around it: where it stands, what
                it can reach, what it can do, what it knows, which projects it inhabits, and how its work persists.
              </p>
              <p>
                {OI} names that wider field. It is a personal, open, composable structure for technological agency — the
                operating infrastructure that lets an agent act, and the objective internal world that makes the act
                situated.
              </p>
              <p>
                The idea is developed at length in the{' '}
                <ExternalLink href="https://github.com/EpiLogos/Antykathera-Essay-Work">Antykathera essay work</ExternalLink>,
                which explores how every actor — human or artificial — carries an operative internal world that includes,
                but is not reducible to, the worlds of others.
              </p>
            </div>
          </div>

          <div className="definition-grid" aria-label="The two readings of O:I">
            <article>
              <span>0</span>
              <h3>Persistent ground</h3>
              <p>
                A durable place from which agency can stand: human-authored files, projects, preferences, tools, sources and
                histories that remain available across sessions.
              </p>
            </article>
            <article>
              <span>1</span>
              <h3>Actuated intelligence</h3>
              <p>
                A model placed into a loop that can receive, act, observe and continue — an agent that can operate from
                that ground.
              </p>
            </article>
          </div>

          <div className="understand-strip">
            <div>
              <span className="understand-strip__label">Agency is not an agent</span>
              <p>
                An agent is a situated actor. Agency is the possibility of effective action that arises from the relation
                between actor, ground and world.
              </p>
            </div>
            <div>
              <span className="understand-strip__label">0/1 spans both sides</span>
              <p>
                The same structure applies to human and artificial actors: an operative internal world, selectively
                disclosed into action. The point of {OI} is the common denominator, not a theory of intelligence.
              </p>
            </div>
            <div>
              <span className="understand-strip__label">Open and personal</span>
              <p>
                {OI} is designed to be installed, authored and owned locally. The shared field extends from personal ground,
                rather than starting from a central platform.
              </p>
            </div>
          </div>
        </section>

        <section id="explore" className="section section--black oi-surface-dark" aria-labelledby="explore-title">
          <div className="section__eyebrow section__eyebrow--signal">
            <span className="meta-signal" aria-hidden="true" />
            EXPLORE
          </div>
          <div className="section__grid section__grid--feature">
            <div>
              <h2 id="explore-title" className="feature-title">
                Enter the shared field.
              </h2>
            </div>
            <div className="feature-copy">
              <p>
                Explore is the open field of explicitly projected O:I worlds, agents, projects, knowledge and work.
                Search begins at an addressable object and opens outward into its bounded local relations and authored
                presentation.
              </p>
              <p>
                Worlds remain projections of independently owned sources. Their presentation can be composed and
                revised without turning the browser into source authority.
              </p>
              <a href="./explore.html" className="link-arrow">
                Open Explore <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        <ProductField />

        <section className="section section--white section--cube oi-surface-light" aria-labelledby="local-title">
          <div className="cube-wrap" aria-hidden="true">
            <OICube />
          </div>
          <div className="section__grid section__grid--feature">
            <div>
              <div className="section__eyebrow">One install</div>
              <h2 id="local-title" className="feature-title">
                The parent {OI} suite composes the whole.
              </h2>
            </div>
            <div className="feature-copy">
              <p>
                The <code>oi</code> command is the front door. It discovers, installs and composes the six products into
                one managed local environment while leaving each product&apos;s native identity intact.
              </p>
              <p>
                From one installation a human can enter Central, commission agents, resolve capabilities, run
                developmental work, place execution, and reach the formal layer when needed. An agent can discover the same
                world through structured skills, schemas and state.
              </p>
              <ExternalLink href="https://github.com/EpiLogos/O-I/blob/research/cordis-composable-agency/docs/INSTALL.md">
                Install {OI}
              </ExternalLink>
            </div>
          </div>
        </section>

        <section id="build" className="section section--black section--build oi-surface-dark" aria-labelledby="build-title">
          <div className="section__eyebrow">Build</div>
          <div className="section__grid section__grid--heading">
            <h2 id="build-title" className="feature-title">
              Read the system. Enter the code.
            </h2>
            <p className="feature-copy">
              {OI} is developed in public. The repository is the shared entry point into the architecture, current work
              and the six independently useful products.
            </p>
          </div>

          <div className="build-links" role="list">
            <ExternalLink href="https://github.com/EpiLogos/O-I/blob/research/cordis-composable-agency/docs/CANONICAL-PRODUCT-FIELD.md">
              <span>Architecture</span>
              <strong>Canonical product field</strong>
            </ExternalLink>
            <ExternalLink href="https://github.com/EpiLogos/O-I#start-here">
              <span>Understand</span>
              <strong>Documentation</strong>
            </ExternalLink>
            <ExternalLink href="https://github.com/EpiLogos/O-I">
              <span>Source</span>
              <strong>O:I repository</strong>
            </ExternalLink>
            <ExternalLink href="https://github.com/EpiLogos/O-I/issues">
              <span>Contribute</span>
              <strong>Current work</strong>
            </ExternalLink>
          </div>
        </section>

        <section className="section section--black section--closing oi-surface-dark" aria-labelledby="closing-title">
          <div className="closing-mark" aria-hidden="true">
            {'{O:I}'}
          </div>
          <div className="closing-copy">
            <div className="section__eyebrow">Operating Infrastructure · Objective Internality</div>
            <h2 id="closing-title">An open field for situated agency.</h2>
          </div>
        </section>
      </main>

      <footer className="site-footer oi-surface-dark">
        <span>{OI}</span>
        <span>Understand · Explore · Build</span>
        <span>Open project · 2026</span>
      </footer>
    </div>
  );
}
