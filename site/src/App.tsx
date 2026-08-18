import type { ReactNode } from 'react';
import { AIStackAperture } from '@/components/ai-stack-aperture';
import { OICube } from '@/components/ui/oi-cube';
import { OIGlyph } from '@/components/ui/oi-mark';
import { ParallaxComponent } from '@/components/ui/parallax-scrolling';

type ProductSurface = {
  position: string;
  need: string;
  role: string;
  project: string;
  href: string;
};

const products: ProductSurface[] = [
  {
    position: '0',
    need: 'A durable place to author and return to.',
    role: 'Persistent personal and operative ground',
    project: 'Central',
    href: 'https://github.com/EpiLogos/Central',
  },
  {
    position: '1',
    need: 'Agency you can commission, inspect and understand.',
    role: 'Situated agency and agentic composition',
    project: 'Actuation',
    href: 'https://github.com/EpiLogos/Actuation',
  },
  {
    position: '2',
    need: 'Know what the agent can access and do here.',
    role: 'Capability, context, resources and surfaces',
    project: 'AIKit',
    href: 'https://github.com/EpiLogos/ai-kit',
  },
  {
    position: '3',
    need: 'Turn intention into developed, evidenced software.',
    role: 'Projects, Runs, candidates and recognition',
    project: 'Software Factory',
    href: 'https://github.com/EpiLogos/agent-system-design',
  },
  {
    position: '4',
    need: 'Give agency a real computational world.',
    role: 'Execution, placement, services and lifecycle',
    project: 'Workcell',
    href: 'https://github.com/EpiLogos/Workcell',
  },
  {
    position: '5',
    need: 'Make formal relations usable and recursive.',
    role: 'Relation, refraction, synthesis and recursive intelligence',
    project: 'Quaternal Logic',
    href: 'https://github.com/EpiLogos/QL-MEF',
  },
];

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
      <div className="section__eyebrow">O:I PRODUCT FIELD</div>
      <div className="section__grid section__grid--heading">
        <h1 id="products-title" className="feature-title feature-title--wide">
          Six products around one agent environment.
        </h1>
        <p className="feature-copy">
          Each centre answers a concrete human need. Together they make the operative world around an agent explicit,
          inspectable and composable.
        </p>
      </div>

      <div className="product-field" role="table" aria-label="O:I product field">
        <div className="product-field__head" role="row">
          <span role="columnheader">Human need</span>
          <span role="columnheader">Role in Objective Internality</span>
          <span role="columnheader">Software</span>
          <span aria-hidden="true" />
        </div>
        {products.map((product) => (
          <a
            key={product.project}
            className="product-row"
            href={product.href}
            target="_blank"
            rel="noreferrer"
            role="row"
          >
            <span className="product-row__need" role="cell">
              <span className="product-row__position">P{product.position}</span>
              {product.need}
            </span>
            <span className="product-row__role" role="cell">
              {product.role}
            </span>
            <span className="product-row__project" role="cell">
              {product.project}
            </span>
            <span className="product-row__arrow" aria-hidden="true">
              ↗
            </span>
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
        <ProductField />

        <section id="understand" className="section section--white oi-surface-light" aria-labelledby="understand-title">
          <div className="section__eyebrow">UNDERSTAND</div>
          <div className="section__grid section__grid--intro">
            <h2 id="understand-title" className="display-copy display-copy--compact">
              AI has a world around it.
            </h2>
            <div className="body-copy body-copy--lead">
              <p>
                Agents operate through projects, files, tools, sources, histories, models and other agents. O:I makes
                that operative world explicit.
              </p>
              <p>
                The human can see what an agent has access to, what shaped its work, what it produced or changed, and
                where authorship and stewardship enter the environment.
              </p>
            </div>
          </div>

          <div className="definition-grid" aria-label="The two public readings of O:I">
            <article>
              <span>O</span>
              <h3>Operating Infrastructure</h3>
              <p>The structures through which technological agency becomes situated and able to act.</p>
            </article>
            <article>
              <span>I</span>
              <h3>Objective Internality</h3>
              <p>
                The inspectable operative interior around an actor: authored ground, capabilities, projects, sources,
                histories, environments and the relations that can become effective in later action.
              </p>
            </article>
          </div>

          <div className="understand-strip">
            <div>
              <span className="understand-strip__label">Ground</span>
              <p>Keep durable authored context and project continuity.</p>
            </div>
            <div>
              <span className="understand-strip__label">Agency</span>
              <p>Make the actor, its powers and its current world legible.</p>
            </div>
            <div>
              <span className="understand-strip__label">Stewardship</span>
              <p>Inspect the path from source and action to result and return.</p>
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

        <section className="section section--white section--cube oi-surface-light" aria-labelledby="local-title">
          <div className="cube-wrap" aria-hidden="true">
            <OICube />
          </div>
          <div className="section__grid section__grid--feature">
            <div>
              <div className="section__eyebrow">OBJECTIVE INTERNALITY</div>
              <h2 id="local-title" className="feature-title">
                Your working world has continuity.
              </h2>
            </div>
            <div className="feature-copy">
              <p>
                Files, projects, preferences, machines, tools and histories can remain grounded in an authored world
                while computation moves across models, processes and hosts.
              </p>
              <p>
                Projection makes selected parts addressable beyond that local world while keeping source authority and
                provenance visible.
              </p>
            </div>
          </div>
        </section>

        <section id="build" className="section section--black section--build oi-surface-dark" aria-labelledby="build-title">
          <div className="section__eyebrow">BUILD</div>
          <div className="section__grid section__grid--heading">
            <h2 id="build-title" className="feature-title">
              Read the system. Enter the code.
            </h2>
            <p className="feature-copy">
              O:I is developed in public. The repository is the shared entry point into the architecture, current work
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
            <div className="section__eyebrow">OPERATING INFRASTRUCTURE · OBJECTIVE INTERNALITY</div>
            <h2 id="closing-title">An architecture for the engineering around the model.</h2>
          </div>
        </section>
      </main>

      <footer className="site-footer oi-surface-dark">
        <span>{'{O:I}'}</span>
        <span>Understand · Explore · Build</span>
        <span>Open project · 2026</span>
      </footer>
    </div>
  );
}
