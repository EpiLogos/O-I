import type { ReactNode } from 'react';
import './index.css';
import { ParallaxComponent } from './components/ui/parallax-scrolling';
import { OICube } from './components/ui/oi-cube';
import { OIMark } from './components/ui/oi-mark';
import { PossibilityField } from './components/possibility-field';
import { CentresIndex, CentresSection } from './components/centres';
import { SharedFieldFigure } from './components/shared-field-figure';
import { MarkdownBody } from './components/markdown-body';
import { getBody, getChild, getPage, getSection, getTitle } from './lib/public-content';

type PageId = 'home' | 'oi' | 'products' | 'shared-field' | 'research' | 'build';

const PAGE_FILES: Record<PageId, string> = {
  home: 'index.html',
  oi: 'oi.html',
  products: 'products.html',
  'shared-field': 'shared-field.html',
  research: 'research.html',
  build: 'build.html',
};

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const external = href.startsWith('http');
  return (
    <a href={href} className={className} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      {children}
    </a>
  );
}

function currentPage(): PageId {
  const filename = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
  if (!filename || filename === 'index.html') return 'home';
  const entry = (Object.entries(PAGE_FILES) as Array<[PageId, string]>).find(([, file]) => file === filename);
  return entry?.[0] ?? 'home';
}

function SiteNav({ active }: { active: PageId }) {
  const links: Array<{ id: PageId; label: string }> = [
    { id: 'oi', label: 'O:I' },
    { id: 'products', label: 'Products' },
    { id: 'shared-field', label: 'Shared Field' },
    { id: 'research', label: 'Research' },
    { id: 'build', label: 'Build' },
  ];

  return (
    <header className="site-nav">
      <a href="./index.html" className="site-nav__brand" aria-label="O:I home">
        <OIMark className="site-nav__mark" />
      </a>
      <nav className="site-nav__links" aria-label="Primary">
        {links.map((link) => (
          <a key={link.id} href={`./${PAGE_FILES[link.id]}`} aria-current={active === link.id ? 'page' : undefined}>
            {link.label}
          </a>
        ))}
        <a href="./explore.html">Explore</a>
        <ExternalLink href="https://github.com/EpiLogos/O-I" className="site-nav__github">
          <GitHubIcon />
        </ExternalLink>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>O:I — Objective : Internality</span>
      <span>
        <a href="./oi.html">O:I</a> · <a href="./products.html">Products</a> · <a href="./shared-field.html">Shared Field</a> ·{' '}
        <a href="./research.html">Research</a> · <a href="./build.html">Build</a> · <a href="./explore.html">Explore</a>
      </span>
      <span>Open source · open protocols</span>
    </footer>
  );
}

function PageShell({ active, children }: { active: PageId; children: ReactNode }) {
  return (
    <div id="top">
      <SiteNav active={active} />
      {children}
      <Footer />
    </div>
  );
}

function NarrativeSection({
  pageId,
  sectionId,
  tone = 'white',
  display = false,
  children,
}: {
  pageId: PageId;
  sectionId: string;
  tone?: 'white' | 'black';
  display?: boolean;
  children?: ReactNode;
}) {
  const section = getSection(pageId, sectionId);
  const title = getTitle(section);
  const body = getBody(section, 'title');
  return (
    <section id={sectionId} className={`section section--${tone}`} aria-labelledby={`${pageId}-${sectionId}-title`}>
      <div className="section__eyebrow"><span>{section.title}</span></div>
      <div className={`section__grid ${display ? 'section__grid--intro' : 'section__grid--heading'}`}>
        <h2 id={`${pageId}-${sectionId}-title`} className={display ? 'display-copy display-copy--compact' : 'feature-title'}>
          {title}
        </h2>
        <MarkdownBody source={body} className={display ? 'body-copy body-copy--lead' : 'body-copy'} />
      </div>
      {children}
    </section>
  );
}

function PageOpening({ pageId, sectionId = 'intro' }: { pageId: Exclude<PageId, 'home'>; sectionId?: string }) {
  const page = getPage(pageId);
  const section = getSection(pageId, sectionId);
  return (
    <section className="section section--black page-opening" aria-labelledby={`${pageId}-page-title`}>
      <div className="section__eyebrow"><span>{page.title}</span></div>
      <div className="page-opening__grid">
        <h1 id={`${pageId}-page-title`} className="page-opening__title">{getTitle(section)}</h1>
        <MarkdownBody source={getBody(section, 'title')} className="body-copy body-copy--lead" />
      </div>
    </section>
  );
}

function HomePage() {
  const heroTitle = getChild(getSection('home', 'hero'), 'title').title;
  const existing = getSection('home', 'existing-world');
  return (
    <PageShell active="home">
      <main>
        <section className="hero" aria-label="O:I opening statement">
          <h1 className="visually-hidden">{heroTitle} — Operating Infrastructure</h1>
          <ParallaxComponent title={heroTitle} />
        </section>

        <NarrativeSection pageId="home" sectionId="what" tone="black" display />

        <section className="section section--black section--statement" aria-labelledby="existing-world-title">
          <div className="statement-block">
            <div className="section__eyebrow"><span>{existing.title}</span></div>
            <h2 id="existing-world-title">{getTitle(existing)}</h2>
            <MarkdownBody source={getBody(existing, 'title')} className="body-copy" />
            <a className="inline-link statement-block__link" href="./oi.html#existing-world">Read why non-displacement matters →</a>
          </div>
        </section>

        <NarrativeSection pageId="home" sectionId="field" tone="white">
          <PossibilityField />
        </NarrativeSection>

        <NarrativeSection pageId="home" sectionId="centres" tone="black">
          <CentresIndex />
        </NarrativeSection>

        <NarrativeSection pageId="home" sectionId="shared" tone="white" />
        <NarrativeSection pageId="home" sectionId="build" tone="black" />

        <section className="section section--black section--closing">
          <div className="closing-mark" aria-hidden="true">{`{O:I}`}</div>
          <div className="closing-copy">
            <h2>An open field for situated agency.</h2>
          </div>
        </section>
      </main>
    </PageShell>
  );
}

function OIPage() {
  const name = getSection('oi', 'name');
  return (
    <PageShell active="oi">
      <main>
        <PageOpening pageId="oi" />
        <NarrativeSection pageId="oi" sectionId="existing-world" tone="white" />
        <NarrativeSection pageId="oi" sectionId="possibility" tone="black" />
        <section id="name" className="section section--white section--cube" aria-labelledby="oi-name-title">
          <div className="section__eyebrow"><span>{name.title}</span></div>
          <div className="section__grid section__grid--heading">
            <h2 id="oi-name-title" className="feature-title feature-title--wide">{getTitle(name)}</h2>
            <MarkdownBody source={getBody(name, 'title')} className="body-copy" />
          </div>
          <div className="cube-wrap" aria-hidden="true"><OICube /></div>
          <div className="readings-grid">
            <article>
              <h3>{getChild(name, 'objective-internality').title}</h3>
              <MarkdownBody source={getBody(name, 'objective-internality')} />
            </article>
            <article>
              <h3>{getChild(name, 'non-claim').title}</h3>
              <MarkdownBody source={getBody(name, 'non-claim')} />
            </article>
          </div>
        </section>
        <NarrativeSection pageId="oi" sectionId="human-agency" tone="black" />
        <NarrativeSection pageId="oi" sectionId="research-field" tone="white" />
      </main>
    </PageShell>
  );
}

function ProductsPage() {
  return (
    <PageShell active="products">
      <main>
        <PageOpening pageId="products" />
        <section className="section section--black" aria-label="Six O:I products">
          <CentresSection />
        </section>
      </main>
    </PageShell>
  );
}

function SharedFieldPage() {
  return (
    <PageShell active="shared-field">
      <main>
        <PageOpening pageId="shared-field" />
        <NarrativeSection pageId="shared-field" sectionId="projection" tone="white">
          <SharedFieldFigure />
        </NarrativeSection>
        <NarrativeSection pageId="shared-field" sectionId="co-internality" tone="black" />
        <NarrativeSection pageId="shared-field" sectionId="explore" tone="white" />
      </main>
    </PageShell>
  );
}

function ResearchPage() {
  return (
    <PageShell active="research">
      <main>
        <PageOpening pageId="research" />
        <NarrativeSection pageId="research" sectionId="parity" tone="white" />
        <NarrativeSection pageId="research" sectionId="bimba" tone="black" />
        <NarrativeSection pageId="research" sectionId="optional" tone="white" />
      </main>
    </PageShell>
  );
}

function BuildPage() {
  const links = getSection('build', 'links');
  return (
    <PageShell active="build">
      <main>
        <PageOpening pageId="build" />
        <section id="links" className="section section--white" aria-labelledby="build-links-title">
          <div className="section__eyebrow"><span>{links.title}</span></div>
          <div className="section__grid section__grid--heading">
            <h2 id="build-links-title" className="feature-title">{getTitle(links)}</h2>
            <MarkdownBody source={getBody(links, 'title')} className="body-copy public-link-list" />
          </div>
        </section>
        <NarrativeSection pageId="build" sectionId="health" tone="black" />
      </main>
    </PageShell>
  );
}

export default function App() {
  switch (currentPage()) {
    case 'oi':
      return <OIPage />;
    case 'products':
      return <ProductsPage />;
    case 'shared-field':
      return <SharedFieldPage />;
    case 'research':
      return <ResearchPage />;
    case 'build':
      return <BuildPage />;
    default:
      return <HomePage />;
  }
}
