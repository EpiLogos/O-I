'use client';

import { useEffect, useState } from 'react';
import { ShellNav } from './ShellNav';
import { HeroParallax } from './HeroParallax';
import { VideoField } from './VideoField';
import { PAGES, type Page, type Section } from './content';
import './shell.css';

function pageFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash && PAGES.some((page) => page.id === hash) ? hash : 'home';
}

function navigateTo(id: string) {
  window.location.hash = id === 'home' ? '/' : `/${id}`;
}

const isUrl = (value: string) => /^https?:\/\//.test(value);

function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  );
}

function SectionBody({ section }: { section: Section }) {
  return (
    <>
      <div className="sec__eyebrow">{section.eyebrow}</div>
      <h2 className="sec__title">{section.title}</h2>

      {section.body ? (
        <div className="sec__prose">
          <Prose text={section.body} />
        </div>
      ) : null}

      {section.items ? (
        <ul className="sec__items">
          {section.items.map((item, index) => (
            <li key={index}>
              <span className="sec__item-name">{item.name}</span>
              {item.detail ? (
                isUrl(item.detail) ? (
                  <a
                    className="sec__item-detail sec__item-detail--link"
                    href={item.detail}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.detail.replace('https://github.com/', '')} ↗
                  </a>
                ) : (
                  <span className="sec__item-detail">{item.detail}</span>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function SectionView({ section }: { section: Section }) {
  if (section.media) {
    return (
      <section className="band">
        <VideoField
          media={section.media.media}
          poster={section.media.poster ?? 1}
          zoom={section.media.zoom ?? 1.3}
          className="band__video"
        />
        <div className="band__shade" aria-hidden="true" />
        <div className="band__inner">
          <SectionBody section={section} />
        </div>
      </section>
    );
  }

  return (
    <section className="sec">
      <div className="sec__inner">
        <SectionBody section={section} />
      </div>
    </section>
  );
}

function Opening({ page }: { page: Page }) {
  return (
    <header className="opening">
      <div className="opening__eyebrow">
        <span>{page.index}</span>
        <span>{page.label}</span>
      </div>
      <h1 className="opening__title">{page.intro.title}</h1>
      {page.intro.body ? <p className="opening__body">{page.intro.body}</p> : null}
    </header>
  );
}

function Footer() {
  return (
    <footer className="sf">
      <span>O:I — World and Life</span>
      <span>Objective : Internality</span>
    </footer>
  );
}

function HomePage() {
  const home = PAGES.find((page) => page.id === 'home')!;
  return (
    <main>
      <HeroParallax />
      {home.sections.map((section, index) => (
        <SectionView key={index} section={section} />
      ))}
      <Footer />
    </main>
  );
}

function InteriorPage({ page }: { page: Page }) {
  return (
    <main>
      <Opening page={page} />
      {page.sections.map((section, index) => (
        <SectionView key={index} section={section} />
      ))}
      <Footer />
    </main>
  );
}

export default function ShellApp() {
  const [pageId, setPageId] = useState<string>(pageFromHash);

  useEffect(() => {
    const onHash = () => {
      setPageId(pageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const page = PAGES.find((entry) => entry.id === pageId) ?? PAGES[0];

  return (
    <div className="shell">
      <ShellNav page={page.id} onNavigate={navigateTo} />
      {page.id === 'home' ? <HomePage /> : <InteriorPage page={page} />}
    </div>
  );
}
