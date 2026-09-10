'use client';

import { useEffect, useState } from 'react';
import { ShellNav } from './ShellNav';
import { HeroParallax } from './HeroParallax';
import { CONTENT, PAGES } from './pages';
import './shell.css';

function pageFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash && PAGES.some((page) => page.id === hash) ? hash : 'home';
}

function PageShell({ id, onNavigate }: { id: string; onNavigate: (id: string) => void }) {
  const content = CONTENT[id];
  const page = PAGES.find((entry) => entry.id === id)!;

  return (
    <div className="pg">
      <ShellNav page={id} onNavigate={onNavigate} />
      <main className="pg__body">
        <div className="pg__eyebrow">
          <span>{page.index}</span>
          <span>{page.label}</span>
        </div>

        <h1 className="pg__title">{content.title}</h1>
        <p className="pg__sub">{content.sub}</p>

        {content.offices ? (
          <ol className="pg__offices">
            {content.offices.map(([name, office], index) => (
              <li key={name}>
                <span className="pg__offices-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="pg__offices-name">{name}</span>
                <span className="pg__offices-office">{office}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </main>
    </div>
  );
}

function Home() {
  return (
    <div className="home">
      <ShellNav page="home" onNavigate={navigateTo} />
      <main>
        <HeroParallax />
        <section className="home-note">
          <p>
            A capable model is not yet a capable agent in a world.
            <br />
            O:I maps the field that makes it one.
          </p>
        </section>
        <footer className="sf">
          <span>O:I — World and Life</span>
          <span>Objective : Internality</span>
        </footer>
      </main>
    </div>
  );
}

function navigateTo(id: string) {
  window.location.hash = id === 'home' ? '/' : `/${id}`;
}

export default function ShellApp() {
  const [page, setPage] = useState<string>(pageFromHash);

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (page === 'home') return <Home />;
  return <PageShell id={page} onNavigate={navigateTo} />;
}
