import type { ReactNode } from 'react';
import { SelfOtherPortal } from '@/components/self-other-portal';
import { OICube } from '@/components/ui/oi-cube';
import { OIGlyph } from '@/components/ui/oi-mark';
import { ParallaxComponent } from '@/components/ui/parallax-scrolling';

const surfaces = [
  {
    function: 'Persistent personal ground',
    project: 'Central',
    href: 'https://github.com/EpiLogos/Central',
  },
  {
    function: 'Agent actuation',
    project: 'Agent Runtime',
    href: 'https://github.com/EpiLogos/agent-system-design/issues/94',
  },
  {
    function: 'Capability and context resolution',
    project: 'AIKit',
    href: 'https://github.com/EpiLogos/ai-kit',
  },
  {
    function: 'Developmental agency',
    project: 'Software Factory',
    href: 'https://github.com/EpiLogos/agent-system-design',
  },
  {
    function: 'Material execution',
    project: 'Workcell',
    href: 'https://github.com/EpiLogos/Workcell',
  },
  {
    function: 'Recursive formal intelligence',
    project: 'Quaternal Logic',
    href: 'https://github.com/EpiLogos/QL-MEF',
  },
];

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="link-arrow">
      {children}
      <span aria-hidden="true">↗</span>
    </a>
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
          <a href="#idea">Idea</a>
          <a href="#field">Field</a>
          <a href="#shared">Self / Other</a>
          <ExternalLink href="https://github.com/EpiLogos/O-I">GitHub</ExternalLink>
        </nav>
      </header>

      <main id="top" data-oi-surface="projection-root" data-oi-state="front-door">
        <ParallaxComponent />

        <section id="idea" className="section section--black" aria-labelledby="idea-title">
          <div className="section__eyebrow">OPEN SOFTWARE PROJECT</div>
          <div className="section__grid section__grid--intro">
            <h1 id="idea-title" className="display-copy">
              An architecture for the engineering around the model.
            </h1>
            <div className="body-copy body-copy--lead">
              <p>
                A model supplies capacity. An agent loop puts some of that capacity into motion. What the act can
                become depends on the world around it.
              </p>
              <p>
                <strong>O:I</strong> is an open idea and architecture for provisioning and potentiating technological
                agency around available model capacity.
              </p>
            </div>
          </div>

          <div className="definition-grid" aria-label="The two readings of O:I">
            <article>
              <span>O</span>
              <h2>Operating Infrastructure</h2>
              <p>The structures through which an artificial actor can operate.</p>
            </article>
            <article>
              <span>I</span>
              <h2>Objective Internality</h2>
              <p>
                An actor's operative interior can also exist as objective, inspectable structure: projects,
                capabilities, histories, sources and environments that can become effective again in later action.
              </p>
            </article>
          </div>
        </section>

        <section className="section section--white" aria-labelledby="small-title">
          <div className="section__grid section__grid--feature">
            <div>
              <div className="section__eyebrow">START SMALL</div>
              <h2 id="small-title" className="feature-title">
                Personal ground.
                <br />
                Model in motion.
              </h2>
            </div>
            <div className="feature-copy">
              <p>
                The smallest O:I is deliberately ordinary: a durable personal working ground plus an LLM running in a
                loop.
              </p>
              <p>
                From there, the same architecture can open into richer capability, knowledge, development, material
                execution and recursive intelligence without turning into one mandatory stack.
              </p>
            </div>
          </div>
        </section>

        <section id="field" className="section section--black" aria-labelledby="field-title">
          <div className="section__eyebrow">THE FIELD</div>
          <div className="section__grid section__grid--heading">
            <h2 id="field-title" className="feature-title">
              Six centres.
              <br />
              One possibility space.
            </h2>
            <p className="feature-copy">
              Each project can stand on its own. Together they describe a broad working field for technological
              agency.
            </p>
          </div>

          <div className="surface-list" role="list">
            {surfaces.map((surface, index) => (
              <a
                key={surface.project}
                href={surface.href}
                target="_blank"
                rel="noreferrer"
                className="surface-row"
                role="listitem"
              >
                <span className="surface-row__index">0{index + 1}</span>
                <span className="surface-row__function">{surface.function}</span>
                <span className="surface-row__project">{surface.project}</span>
                <span className="surface-row__arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="section section--white section--cube" aria-labelledby="local-title">
          <div className="cube-wrap" aria-hidden="true">
            <OICube />
          </div>
          <div className="section__grid section__grid--feature">
            <div>
              <div className="section__eyebrow">LOCAL FIRST</div>
              <h2 id="local-title" className="feature-title">
                Your world stays yours.
              </h2>
            </div>
            <div className="feature-copy">
              <p>
                O:I is aimed toward personal technological agency. Files, projects, preferences, machines, tools and
                histories can remain grounded in a local authored world even when computation extends elsewhere.
              </p>
              <p>
                The shared field adds selective projection rather than central ownership: expose what you mean to
                share, preserve its provenance, keep the source where it belongs.
              </p>
            </div>
          </div>
        </section>

        <section id="shared" className="section section--black" aria-labelledby="shared-title">
          <div className="section__eyebrow">SHARED FIELD</div>
          <div className="section__grid section__grid--heading">
            <h2 id="shared-title" className="feature-title">
              Self.
              <br />
              Other.
            </h2>
            <div className="feature-copy">
              <p>
                Shared agency begins with one simple fact: another centre can appear in the world available to this
                one, without either being reduced to the other.
              </p>
              <p>
                O:I calls the objective, inspectable form of that mutual implication <strong>Objective
                Co-Internality</strong>. The field relates local worlds through selective projection and provenance;
                it does not become the owner of either mind or identity.
              </p>
            </div>
          </div>

          <SelfOtherPortal />
        </section>

        <section className="section section--black section--closing" aria-labelledby="closing-title">
          <div className="closing-mark" aria-hidden="true">
            {'{O:I}'}
          </div>
          <div className="closing-copy">
            <div className="section__eyebrow">BUILD IN THE OPEN</div>
            <h2 id="closing-title">The shared front door is the repository.</h2>
            <div className="closing-links">
              <ExternalLink href="https://github.com/EpiLogos/O-I">Explore O:I on GitHub</ExternalLink>
              <ExternalLink href="https://github.com/EpiLogos/O-I#start-here">Read the documentation</ExternalLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>{'{O:I}'}</span>
        <span>Operating Infrastructure · Objective Internality</span>
        <span>Open project · 2026</span>
      </footer>
    </div>
  );
}
