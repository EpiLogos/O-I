import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ShellNav } from './ShellNav';
import { HeroParallax } from './HeroParallax';
import { VideoField } from './VideoField';
import { MotionControl, MotionProvider, motionSettings, useMotion } from './motion';
import { PAGES, type Page, type Section, type Item } from './content';
import './shell.css';

function pageFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return PAGES.some(page => page.id === hash) ? hash : 'home';
}
const isUrl = (value: string) => /^https?:\/\//.test(value);

// Presentation only: source strings remain unchanged, including punctuation.
const notation = /(Objective Internality ≠ Subjective Immediacy|Ref → Relation → Operation → Consequence → Return|exists ≠ available ≠ relevant ≠ permitted ≠ selected ≠ operative|intention → action → experience → learning)/g;
function Inline({ text }: { text: string }) {
  return <>{text.split(notation).map((part, index) => index % 2
    ? <span className="sec__notation" key={index}>{part}</span> : part)}</>;
}
function Prose({ text }: { text: string }) {
  return <>{text.split('\n\n').map((paragraph, index) => (
    <p key={index} className={paragraph === 'Ref → Relation → Operation → Consequence → Return' ? 'sec__formula' : undefined}>
      <Inline text={paragraph} />
    </p>
  ))}</>;
}
function Title({ section, id }: { section: Section; id: string }) {
  return <div className="sec__heading">
    {section.eyebrow && <div className="sec__eyebrow">{section.eyebrow}</div>}
    <h2 className="sec__title" id={id}>{section.title}</h2>
  </div>;
}
function Copy({ section }: { section: Section }) {
  return <>
    {section.sub && <p className="sec__sub">{section.sub}</p>}
    {section.body && <div className="sec__prose"><Prose text={section.body} /></div>}
  </>;
}
function ItemLink({ detail }: { detail: string }) {
  return isUrl(detail)
    ? <a className="sec__detail sec__link" href={detail} target="_blank" rel="noreferrer">
        {detail.replace('https://github.com/', '')}<span className="sec__arrow" aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span>
      </a>
    : <span className="sec__detail">{detail}</span>;
}
function ItemsList({ items }: { items: Item[] }) {
  return <ul className="sec__items">{items.map((item, index) => (
    <li key={index}><span className="sec__item-name">{item.name}</span>{item.detail && <ItemLink detail={item.detail} />}</li>
  ))}</ul>;
}
function Meta({ items }: { items: Item[] }) {
  return <div className="sec__meta">{items.map((item, index) => (
    <span className="sec__meta-item" key={index}>
      <span className="sec__meta-name">{item.name}</span>
      {item.detail && <ItemLink detail={item.detail} />}
    </span>
  ))}</div>;
}
function Figure({ n }: { n: number }) {
  return <figure className="sec__figure" aria-hidden="true">
    <div className="sec__figure-field"><img src={`./media/motion/oi-pointcloud-poster-${n}.jpg`} alt="" loading="lazy" decoding="async" /></div>
  </figure>;
}
function SectionView({ section }: { section: Section }) {
  const id = useId();
  const tone = section.tone === 'light' ? 'sec--light' : 'sec--dark';
  if (section.layout === 'band') {
    return <section className="band sec--dark" data-layout="band" aria-labelledby={id}>
      <VideoField media={section.media?.media ?? 'b'} poster={section.media?.poster ?? 1}
        zoom={Math.min(section.media?.zoom ?? 1.03, 1.06)} className="band__video" />
      <div className="band__shade" aria-hidden="true" />
      <div className="band__inner" data-reveal><Title section={section} id={id} /><Copy section={section} /></div>
    </section>;
  }
  return <section className={`sec sec--${section.layout} ${tone}${section.flip ? ' sec--feature--flip' : ''}`} data-layout={section.layout} aria-labelledby={id}>
    <div className="sec__inner" data-reveal>
      {section.layout === 'feature' ? <>
        <Figure n={section.figure ?? 1} />
        <div className="sec__side"><Title section={section} id={id} /><Copy section={section} />{section.items && <Meta items={section.items} />}</div>
      </> : section.layout === 'split' ? <>
        <div className="sec__head"><Title section={section} id={id} /></div>
        <div className="sec__side"><Copy section={section} />{section.items && <ItemsList items={section.items} />}</div>
      </> : <>
        <Title section={section} id={id} /><Copy section={section} />
        {section.layout === 'grid' && <div className="sec__cells">{section.items?.map((item, index) => (
          <div className="sec__cell" key={index}>
            <span className="sec__cell-index">{String(index + 1).padStart(2, '0')}</span>
            <strong className="sec__cell-name">{item.name}</strong>
            {item.detail && <ItemLink detail={item.detail} />}
          </div>
        ))}</div>}
        {section.layout === 'index' && <ol className="sec__rows">{section.items?.map((item, index) => (
          <li key={index}>
            <span className="sec__row-index">{String(index + 1).padStart(2, '0')}</span>
            <strong className="sec__row-name">{item.name}</strong>
            {item.detail && <ItemLink detail={item.detail} />}
          </li>
        ))}</ol>}
        {section.layout === 'statement' && section.items && <ItemsList items={section.items} />}
      </>}
    </div>
  </section>;
}
function Opening({ page }: { page: Page }) {
  return <header className="opening">
    <div className="opening__inner">
      <div className="opening__eyebrow"><span>{page.index}</span><span>{page.intro.eyebrow}</span></div>
      <h1 className="opening__title">{page.intro.title}</h1>
      {page.intro.body && <p className="opening__body"><Inline text={page.intro.body} /></p>}
    </div>
  </header>;
}
function Footer() {
  return <footer className="sf"><span>O:I — World and Life</span><span>Objective : Internality</span></footer>;
}

function Shell() {
  const { still } = useMotion();
  const [pageId, setPageId] = useState(pageFromHash);
  const mainRef = useRef<HTMLElement>(null);
  const current = useRef(pageId);
  const generation = useRef(0);
  const transition = useRef<Animation | null>(null);
  const shouldFocus = useRef(false);
  const stillRef = useRef(still);
  stillRef.current = still;
  const page = PAGES.find(entry => entry.id === pageId) ?? PAGES[0];

  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash();
      const version = ++generation.current;
      transition.current?.cancel();
      if (next === current.current) return;
      const commit = () => {
        if (version !== generation.current) return;
        shouldFocus.current = true;
        setPageId(next);
      };
      const node = mainRef.current;
      if (still || !node) { commit(); return; }
      const { fast, ease } = motionSettings();
      transition.current = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast, easing: ease, fill: 'forwards' });
      void transition.current.finished.then(commit).catch(() => {});
    };
    window.addEventListener('hashchange', onHash);
    // A preference change can cancel a transition; always reconcile with the URL.
    onHash();
    return () => {
      ++generation.current;
      transition.current?.cancel();
      window.removeEventListener('hashchange', onHash);
    };
  }, [still]);

  useLayoutEffect(() => {
    current.current = page.id;
    document.title = page.id === 'home' ? 'O:I — World and Life' : `${page.label} — O:I`;
    if (!shouldFocus.current) return;
    transition.current?.cancel();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
    shouldFocus.current = false;
    if (!stillRef.current && mainRef.current) {
      const { normal, ease } = motionSettings();
      transition.current = mainRef.current.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: normal, easing: ease });
    }
  }, [page.id]);

  useEffect(() => {
    const root = mainRef.current;
    if (!root || still) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const animations = new Set<Animation>();
    const { slow, ease } = motionSettings();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target as HTMLElement;
        if (node.dataset.reveal === 'pending') {
          node.dataset.reveal = 'done';
          const animation = node.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: slow, easing: ease });
          animations.add(animation);
          void animation.finished.then(() => animations.delete(animation)).catch(() => {});
        }
        observer.unobserve(node);
      }
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });
    for (const node of nodes) {
      // Above-fold content stays visible; absent/failed JS never hides the page.
      if (node.getBoundingClientRect().top >= window.innerHeight) node.dataset.reveal = 'pending';
      observer.observe(node);
    }
    return () => {
      observer.disconnect();
      animations.forEach(animation => animation.cancel());
      nodes.forEach(node => { node.dataset.reveal = 'done'; });
    };
  }, [page.id, still]);

  const navigateTo = (id: string) => {
    if (pageFromHash() === id) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      mainRef.current?.focus({ preventScroll: true });
    } else window.location.hash = id === 'home' ? '/' : `/${id}`;
  };

  return <div className="shell" data-motion={still ? 'still' : 'full'}>
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault();
      mainRef.current?.focus({ preventScroll: true });
      (mainRef.current?.querySelector('[data-layout]') ?? mainRef.current)?.scrollIntoView();
    }}>Skip to content</a>
    <ShellNav page={page.id} onNavigate={navigateTo} />
    <main id="main-content" ref={mainRef} tabIndex={-1} key={page.id} data-page={page.id}>
      {page.id === 'home' ? <><h1 className="sr-only">{page.intro.title}</h1><HeroParallax /></> : <Opening page={page} />}
      {page.sections.map((section, index) => <SectionView key={index} section={section} />)}
      <Footer />
    </main>
    <MotionControl />
  </div>;
}

export default function ShellApp() {
  return <MotionProvider><Shell /></MotionProvider>;
}
