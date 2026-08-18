import './index.css';
import { ParallaxComponent } from './components/ui/parallax-scrolling';
import { OICube } from './components/ui/oi-cube';
import { OIMark } from './components/ui/oi-mark';
import { PossibilityField } from './components/possibility-field';
import { CentresSection } from './components/centres';
import { SharedFieldFigure } from './components/shared-field-figure';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function ExternalLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
      {children}
    </a>
  );
}

function SiteNav() {
  return (
    <header className="site-nav">
      <ExternalLink href="#top" className="site-nav__brand" aria-label="O:I home">
        <OIMark className="site-nav__mark" />
      </ExternalLink>
      <nav className="site-nav__links" aria-label="Primary">
        <a href="#what">Understand</a>
        <a href="#field">Field</a>
        <a href="#centres">Centres</a>
        <a href="./explore.html">Explore</a>
        <a href="#build">Build</a>
        <ExternalLink href="https://github.com/EpiLogos/O-I" className="site-nav__github" aria-label="GitHub repository">
          <GitHubIcon />
        </ExternalLink>
      </nav>
    </header>
  );
}

function ArrowIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

export default function App() {
  return (
    <div id="top">
      <SiteNav />
      <main>
        <section className="hero" aria-label="O:I opening statement">
          <h1 className="visually-hidden">O:I — Operating Infrastructure · Objective Internality</h1>
          <ParallaxComponent />
        </section>

        <section id="what" className="section section--black" aria-labelledby="what-title">
          <div className="section__eyebrow"><span>What is O:I</span></div>
          <div className="section__grid section__grid--intro">
            <h2 id="what-title" className="display-copy">A capable model is not yet a capable agent.</h2>
            <div className="body-copy body-copy--lead">
              <p>
                What a model can do depends on the world around it: where it stands, what persists
                between sessions, which tools and sources it can reach, what authority it holds,
                which projects continue, and how what happens returns into later action.
                O:I — Operating Infrastructure · Objective Internality — is an open architecture
                and research programme for that surrounding field: the technological structures
                through which model capacity becomes situated agency.
              </p>
              <p>
                These arrangements are experimental. Hold the model constant and change the loop,
                the memory, the capability field, the authority structure or the material
                environment, and a different agency appears. O:I exists to make that field explicit
                enough to engineer, compare and study — not to hide it inside one prescribed stack.
              </p>
            </div>
          </div>

          <div className="statement-block">
            <h3>You do not have to replace your AI setup.</h3>
            <p>
              O:I begins from the technological world you already inhabit: your models, agents,
              editors, shells, projects, prompts, skills, tools, services, machines and working
              habits. That world already matters, and it stays yours. O:I can make its structure
              explicit without migration, without surrendering its ownership or continuity, and
              without rewriting it into someone else's runtime. Heterogeneous setups are not a
              problem to eliminate — they are the practical starting point, and part of what the
              research exists to understand.
            </p>
          </div>

          <div className="premise-strip">
            <div>
              <span className="premise-strip__label">Agency is not an agent</span>
              <p>A situated actor with a ground, a history and relations is different from a model producing output.</p>
            </div>
            <div>
              <span className="premise-strip__label">The world is the variable</span>
              <p>The same capacity in a different surrounding arrangement becomes a different capability.</p>
            </div>
            <div>
              <span className="premise-strip__label">Yours by default</span>
              <p>Open source, locally installed, human-authored. Sharing extends from personal ground; it does not replace it.</p>
            </div>
          </div>
        </section>

        <section id="field" className="section section--white" aria-labelledby="field-title">
          <div className="section__eyebrow"><span>One possibility space</span></div>
          <div className="section__grid section__grid--heading">
            <h2 id="field-title" className="feature-title">Start small. Stay whole.</h2>
            <div className="body-copy">
              <p>
                The smallest O:I is already a complete relation: persistent authored ground, plus
                model capacity that can act upon it. A directory containing a real project and an
                agent that can work there. A Git repository and a model in a loop. Nothing else is
                required — and nothing in the wider field is a prerequisite.
              </p>
              <p>
                These are not product tiers, and the six centres below are not six prerequisites.
                The maximal case is the minimal relation developed through need — one centre,
                several, all six, or interoperable alternatives.
              </p>
            </div>
          </div>
          <PossibilityField />
        </section>

        <section id="centres" className="section section--black" aria-labelledby="centres-title">
          <div className="section__eyebrow"><span>Six centres</span></div>
          <div className="section__grid section__grid--heading">
            <h2 id="centres-title" className="feature-title">Instruments in the field, not prerequisites.</h2>
            <div className="body-copy">
              <p>
                Each centre exists because a distinct difficulty demanded it. They interlock by
                contract rather than by pipeline — each remains itself, each can meet equivalents,
                and none is a tollbooth for the others.
              </p>
            </div>
          </div>
          <CentresSection />
        </section>

        <section id="name" className="section section--white section--cube" aria-labelledby="name-title">
          <div className="section__eyebrow"><span>Two readings of one name</span></div>
          <div className="section__grid section__grid--heading">
            <h2 id="name-title" className="feature-title feature-title--wide">Operating Infrastructure. Objective Internality.</h2>
            <div className="body-copy">
              <p>
                The first reading is engineering. An operating system gives programs files,
                processes, memory and permissions. O:I names the corresponding organisation around
                model inference: projects and ground, capabilities and actions, sessions and
                runtime bodies, developmental history, material environments, relations to other
                worlds.
              </p>
            </div>
          </div>

          <div className="cube-wrap" aria-hidden="true"><OICube /></div>

          <div className="readings-grid">
            <article>
              <h3>Objective Internality</h3>
              <p>
                The second reading names the same field from inside an act. An actor's operative
                internal world — what it can actually draw on when it acts — is not identical to
                the inside of a model. Projects held in files, available powers, persistent memory,
                machine state, prior decisions, relations to other actors: these are objective
                structures. They exist between invocations, they can be inspected and changed, and
                they can be disclosed into an invocation as part of what the actor is working with.
                Objective Internality names that relation: an operative interior made objective —
                externalised, structured, and able to return.
              </p>
            </article>
            <article>
              <h3>What is not being claimed</h3>
              <p>
                The claim is operational, not phenomenal. O:I does not assert that an artificial
                actor is a subject, or that inspectable structure exhausts a mind. It asserts
                something narrower and more useful: the operative interior of an act is not
                automatically identical to the computational interior of the model producing the
                next token — and designing that wider interior deliberately changes what agency
                becomes.
              </p>
              <p className="readings-grid__aside">
                The philosophical depth of this position is developed in the{' '}
                <a href="https://github.com/EpiLogos/Antykathera-Essay-Work">Antykathera essay work</a>.
              </p>
            </article>
          </div>
        </section>

        <section id="research" className="section section--black" aria-labelledby="research-title">
          <div className="section__eyebrow"><span>Formal research · Quaternal Logic</span></div>
          <div className="section__grid section__grid--intro">
            <h2 id="research-title" className="display-copy display-copy--compact">Where the metaphysics becomes answerable.</h2>
            <div className="body-copy body-copy--lead">
              <p>
                Quaternal Logic belongs to the wider Epi-Logos programme, whose account of mind,
                relation and form draws on depth psychology and Eastern metaphysics rather than on
                the material-computational ontology most AI engineering assumes. O:I does not ask
                anyone to accept that account. It does something more useful: it makes the
                account's formal claims executable enough to be tested.
              </p>
              <p>
                Operational parity is the test. If a formal distinction is supposed to matter to an
                operation, implementing it must make a discriminable difference. A classical
                approach may outperform an informed one; two formally different structures may
                prove equivalent; a distinction may improve explanation without improving
                execution. Those are answers, not embarrassments. Software does not prove the
                metaphysics — it gives the metaphysics somewhere precise to be wrong.
              </p>
              <p>
                The relation is old: an archetypal image is expressed into a technical reflection,
                and the reflection returns information about what the originating form actually
                means. A minimal O:I never needs any of this. A maximal research programme can ask,
                through it, what agency looks like when engineered from a different account of
                relation, interiority, recurrence and form.
              </p>
            </div>
          </div>
        </section>

        <section id="shared" className="section section--white" aria-labelledby="shared-title">
          <div className="section__eyebrow"><span>The shared field</span></div>
          <div className="section__grid section__grid--heading">
            <h2 id="shared-title" className="feature-title">Worlds, not accounts.</h2>
            <div className="body-copy">
              <p>
                The maximal direction of O:I is social — but it is not one giant hosted AI account.
                A world remains independently grounded: owned, continued and authoritative locally.
                It selectively projects part of itself into a shared field — a document, a project
                result, a wiki space, an experiment. Other worlds encounter the projection from
                their own ground, respond, contest, extend — and return an attributable difference.
              </p>
              <p>
                Projection is not upload. Source authority and canonical identity do not move; the
                field mediates presentations, not ownership. Participation never requires
                surrendering the distinction between source and projection, encounter and mutation,
                another's contribution and one's own state. Even where the field is hosted, the
                hosting carries no claim over what a world is.
              </p>
            </div>
          </div>
          <SharedFieldFigure />
          <p className="shared-note">
            Self and Other are positions, not identity kinds — the same participant occupies either
            side from another view.
          </p>
        </section>

        <section id="explore" className="section section--black oi-surface-dark" aria-labelledby="explore-title">
          <div className="section__eyebrow section__eyebrow--signal">
            <span className="meta-signal" aria-hidden="true" />
            <span>Explore</span>
          </div>
          <div className="section__grid section__grid--intro">
            <h2 id="explore-title" className="display-copy display-copy--compact">The platform, becoming visible.</h2>
            <div className="body-copy body-copy--lead">
              <p>
                Explore is the public surface of the shared field: addressable worlds, and beneath
                them agents, projects, wiki spaces, projections, relations and contributions —
                each carrying its provenance, each resolvable to the source that remains
                authoritative for it. Search begins at an addressable object and opens outward into
                its bounded local relations and authored presentation.
              </p>
              <p>
                It begins with the O:I programme's own world — its products, documents and
                relations, projected with their real sources. The architecture hard-codes no one:
                any independently grounded world can project into the same grammar and remain
                itself.
              </p>
              <p>
                <ExternalLink href="./explore.html" className="inline-link">Open Explore ↗</ExternalLink>
              </p>
            </div>
          </div>
        </section>

        <section id="build" className="section section--black section--build" aria-labelledby="build-title">
          <div className="section__eyebrow"><span>Build</span></div>
          <div className="section__grid section__grid--heading">
            <h2 id="build-title" className="feature-title">Read the positions. Enter the code.</h2>
            <div className="body-copy">
              <p>
                One install: the <strong>oi</strong> command discovers, installs and composes the
                six centres into a managed local environment, while leaving each product's native
                identity and CLI intact. The public projection stays projection; the canonical
                repositories carry their own instructions.
              </p>
            </div>
          </div>
          <div className="build-links">
            <ExternalLink href="https://github.com/EpiLogos/O-I/blob/main/docs/positions/FOUNDING-POSITIONS.md" className="link-arrow">
              <span>Founding positions</span>
              <strong>What O:I is actually saying</strong>
              <ArrowIcon />
            </ExternalLink>
            <ExternalLink href="https://github.com/EpiLogos/O-I/blob/main/docs/VISION.md" className="link-arrow">
              <span>Vision</span>
              <strong>Agency · world · return</strong>
              <ArrowIcon />
            </ExternalLink>
            <ExternalLink href="https://github.com/EpiLogos/O-I/blob/main/docs/ARCHITECTURE.md" className="link-arrow">
              <span>Architecture</span>
              <strong>Canonical product field</strong>
              <ArrowIcon />
            </ExternalLink>
            <ExternalLink href="https://github.com/EpiLogos/O-I/blob/main/docs/SHARED-FIELD.md" className="link-arrow">
              <span>Shared field</span>
              <strong>How worlds meet</strong>
              <ArrowIcon />
            </ExternalLink>
            <ExternalLink href="./explore.html" className="link-arrow">
              <span>Explore</span>
              <strong>Enter the shared field</strong>
              <ArrowIcon />
            </ExternalLink>
            <ExternalLink href="https://github.com/EpiLogos/O-I" className="link-arrow">
              <span>Repository</span>
              <strong>EpiLogos/O-I</strong>
              <ArrowIcon />
            </ExternalLink>
          </div>
        </section>

        <section className="section section--black section--closing">
          <div className="closing-mark" aria-hidden="true">{`{O:I}`}</div>
          <div className="closing-copy">
            <h2>An open field for situated agency.</h2>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span>O:I — Objective Internality</span>
        <span>
          <a href="#what">Understand</a> · <a href="#centres">Centres</a> · <a href="./explore.html">Explore</a> · <a href="#build">Build</a>
        </span>
        <span>Open source · open protocols</span>
      </footer>
    </div>
  );
}
