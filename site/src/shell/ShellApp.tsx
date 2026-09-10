'use client';

import { useEffect, useState } from 'react';
import { ShellNav } from './ShellNav';
import { HeroParallax } from './HeroParallax';
import { VideoField } from './VideoField';
import { PAGES, type Page, type Section, type Item } from './content';
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

function Eyebrow({ text }: { text?: string }) {
  return text ? <div className="sec__eyebrow">{text}</div> : null;
}

function Title({ section }: { section: Section }) {
  return (
    <>
      <Eyebrow text={section.eyebrow} />
      <h2 className="sec__title">{section.title}</h2>
    </>
  );
}

function ItemLink({ detail }: { detail: string }) {
  if (isUrl(detail)) {
    return (
      <a className="sec__detail sec__link" href={detail} target="_blank" rel="noreferrer">
        {detail.replace('https://github.com/', '')} ↗
      </a>
    );
  }
  return <span className="sec__detail">{detail}</span>;
}

function ItemsList({ items }: { items: Item[] }) {
  return (
    <ul className="sec__items">
      {items.map((item, index) => (
        <li key={index}>
          <span className="sec__item-name">{item.name}</span>
          {item.detail ? <ItemLink detail={item.detail} /> : null}
        </li>
      ))}
    </ul>
  );
}

function Meta({ items }: { items: Item[] }) {
  return (
    <div className="sec__meta">
      {items.map((item, index) => (
        <span className="sec__meta-item" key={index}>
          <span className="sec__meta-name">{item.name}</span>
          {item.detail ? (
            isUrl(item.detail) ? (
              <a className="sec__meta-value sec__link" href={item.detail} target="_blank" rel="noreferrer">
                {item.detail.replace('https://github.com/', '')} ↗
              </a>
            ) : (
              <span className="sec__meta-value">{item.detail}</span>
            )
          ) : null}
        </span>
      ))}
    </div>
  );
}

function Figure({ n }: { n: number }) {
  return (
    <figure className="sec__figure">
      <img src={`./media/motion/oi-pointcloud-poster-${n}.jpg`} alt="" loading="lazy" />
    </figure>
  );
}

function SectionView({ section }: { section: Section }) {
  const tone = section.tone === 'light' ? 'sec--light' : 'sec--dark';

  if (section.layout === 'band') {
    return (
      <section className="band">
        <VideoField
          media={section.media?.media ?? 'b'}
          poster={section.media?.poster ?? 1}
          zoom={section.media?.zoom ?? 1.3}
          className="band__video"
        />
        <div className="band__shade" aria-hidden="true" />
        <div className="band__inner">
          <Title section={section} />
          {section.body ? (
            <div className="sec__prose">
              <Prose text={section.body} />
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.layout === 'statement') {
    return (
      <section className={`sec sec--statement ${tone}`}>
        <div className="sec__inner">
          <Title section={section} />
          {section.body ? (
            <div className="sec__prose sec__prose--statement">
              <Prose text={section.body} />
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.layout === 'split') {
    return (
      <section className={`sec sec--split ${tone}`}>
        <div className="sec__inner">
          <div className="sec__head">
            <Title section={section} />
          </div>
          <div className="sec__side">
            {section.body ? (
              <div className="sec__prose">
                <Prose text={section.body} />
              </div>
            ) : null}
            {section.items ? <ItemsList items={section.items} /> : null}
          </div>
        </div>
      </section>
    );
  }

  if (section.layout === 'feature') {
    return (
      <section className={`sec sec--feature ${tone}${section.flip ? ' sec--feature--flip' : ''}`}>
        <div className="sec__inner">
          <Figure n={section.figure ?? 1} />
          <div className="sec__side">
            <Title section={section} />
            {section.body ? (
              <div className="sec__prose">
                <Prose text={section.body} />
              </div>
            ) : null}
            {section.items ? <Meta items={section.items} /> : null}
          </div>
        </div>
      </section>
    );
  }

  if (section.layout === 'grid') {
    return (
      <section className={`sec sec--grid ${tone}`}>
        <div className="sec__inner">
          <Title section={section} />
          <div className="sec__cells">
            {section.items?.map((item, index) => (
              <div className="sec__cell" key={index}>
                <span className="sec__cell-index">{String(index + 1).padStart(2, '0')}</span>
                <strong className="sec__cell-name">{item.name}</strong>
                {item.detail ? <span className="sec__cell-detail">{item.detail}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section.layout === 'index') {
    return (
      <section className={`sec sec--index ${tone}`}>
        <div className="sec__inner">
          <Title section={section} />
          <ol className="sec__rows">
            {section.items?.map((item, index) => (
              <li key={index}>
                <span className="sec__row-index">{String(index + 1).padStart(2, '0')}</span>
                <strong className="sec__row-name">{item.name}</strong>
                {item.detail ? <ItemLink detail={item.detail} /> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return null;
}

function Opening({ page }: { page: Page }) {
  return (
    <header className="opening">
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
