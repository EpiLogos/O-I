import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';
import { ShellMark } from '../shell/ShellMark';
import {
  hrefFor,
  resolveEssayRequest,
  type EssayCatalog,
  type EssayFile,
  type EssayResolution,
} from './resolve';

type PageBody = { id: string; title: string; meta: string; html: string };
type Pin = { office: string; scope: string };

const TRAIL_KEY = 'oi-essay-opened-path';

function pageUrl(id: string) {
  return `/essay-shell/pages/${id.split('/').map(encodeURIComponent).join('/')}.json`;
}

function pathUrl(id: string, catalog: EssayCatalog) {
  return hrefFor(id, catalog);
}

function canonicalUrl(resolution: EssayResolution, catalog: EssayCatalog, hash = '') {
  if (resolution.kind === 'page') return pathUrl(resolution.id, catalog) + hash;
  const id = resolution.kind === 'folder' ? resolution.scope : resolution.id;
  return `/essay/${id.split('/').map(encodeURIComponent).join('/')}${hash}`;
}

function readTrail(): { id: string; title: string }[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(TRAIL_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string');
  } catch {
    return [];
  }
}

function writeTrail(trail: { id: string; title: string }[]) {
  try { sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail)); } catch { /* private mode */ }
}

function pathLabel(file: EssayFile, catalog: EssayCatalog) {
  return file.id === catalog.readingRoot ? 'Reading root' : file.title;
}

function derivedBrowser(view: EssayResolution, catalog: EssayCatalog): Pin {
  if (view.kind === 'folder') return { office: view.office, scope: view.scope };
  if (view.kind === 'page') {
    const office = catalog.files.find((file) => file.id === view.id)?.office;
    if (office) return { office, scope: office };
  }
  return { office: 'section-rooms', scope: 'section-rooms' };
}

export function EssayApp() {
  const [catalog, setCatalog] = useState<EssayCatalog | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<EssayResolution | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [page, setPage] = useState<PageBody | null>(null);
  const [pageError, setPageError] = useState('');
  const [trail, setTrail] = useState(readTrail);
  const readRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/essay-shell/catalog.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The essay publication is not on this host yet.');
        return response.json();
      })
      .then((data: EssayCatalog) => {
        setCatalog(data);
        const resolution = resolveEssayRequest(location.pathname, data);
        setView(resolution);
        const url = canonicalUrl(resolution, data, location.hash);
        if (url !== location.pathname + location.hash) history.replaceState(null, '', url);
        if (resolution.kind === 'page') {
          const file = data.files.find((item) => item.id === resolution.id);
          if (file) {
            setTrail((current) => {
              if (current.some((item) => item.id === file.id)) return current;
              const next = [...current, { id: file.id, title: pathLabel(file, data) }];
              writeTrail(next);
              return next;
            });
          }
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The essay could not be opened.');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!catalog) return;
    const onPop = () => {
      setPin(null);
      setView(resolveEssayRequest(location.pathname, catalog));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [catalog]);

  const pageId = view?.kind === 'page' ? view.id : '';

  useEffect(() => {
    if (!pageId) { setPage(null); setPageError(''); return; }
    const controller = new AbortController();
    setPageError('');
    fetch(pageUrl(pageId), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('This page is not in the publication.');
        return response.json();
      })
      .then((body: PageBody) => { setPage(body); document.title = `${body.title} — The Return of Zero`; })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setPage(null);
          setPageError(reason instanceof Error ? reason.message : 'This page is not in the publication.');
        }
      });
    return () => controller.abort();
  }, [pageId]);

  useEffect(() => {
    const node = readRef.current;
    if (!node || !page) return;
    renderMathInElement(node, {
      delimiters: [{ left: '$$', right: '$$', display: true }],
      throwOnError: false,
    });
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      target?.scrollIntoView();
    } else {
      node.scrollTo(0, 0);
    }
  }, [page]);

  const browser = catalog && view ? (pin ?? derivedBrowser(view, catalog)) : null;
  const files = useMemo(() => {
    if (!catalog || !browser) return [];
    return catalog.files.filter((file) => {
      if (browser.scope === browser.office) return file.office === browser.office;
      return file.id === browser.scope || file.id.startsWith(`${browser.scope}/`);
    });
  }, [catalog, browser]);

  useEffect(() => {
    document.querySelector('.files a.on')?.scrollIntoView({ block: 'nearest' });
  }, [pageId, browser?.office, browser?.scope]);

  function remember(id: string) {
    if (!catalog) return;
    const file = catalog.files.find((item) => item.id === id);
    if (!file) return;
    setTrail((current) => {
      if (current.some((item) => item.id === id)) return current;
      const next = [...current, { id, title: pathLabel(file, catalog) }];
      writeTrail(next);
      return next;
    });
  }

  function openPath(pathname: string, mode: 'push' | 'replace' = 'push') {
    if (!catalog) return;
    const resolution = resolveEssayRequest(pathname, catalog);
    setPin(null);
    setView(resolution);
    const hash = pathname.includes('#') ? `#${pathname.split('#').slice(1).join('#')}` : '';
    const url = canonicalUrl(resolution, catalog, hash);
    if (mode === 'replace' || url === location.pathname + location.hash) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    if (resolution.kind === 'page') remember(resolution.id);
  }

  function onReadClick(event: MouseEvent<HTMLElement>) {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    const raw = anchor.getAttribute('href') || '';
    if (!raw || raw.startsWith('#')) return;
    const url = new URL(anchor.href, location.origin);
    if (url.origin !== location.origin) return;
    const path = url.pathname;
    if (!(path.startsWith('/essay') || path.startsWith('/section-rooms') || path.startsWith('/symbolon') || path.startsWith('/manuscript'))) return;
    event.preventDefault();
    openPath(path + url.hash);
  }

  if (error) {
    return (
      <main className="essay essay-wait">
        <p>{error}</p>
      </main>
    );
  }
  if (!catalog || !view || !browser) {
    return (
      <main className="essay essay-wait">
        <ShellMark className="wait-mark" />
        <p>Opening the essay…</p>
      </main>
    );
  }

  const currentFile = view.kind === 'page' ? catalog.files.find((file) => file.id === view.id) : undefined;
  const office = catalog.offices.find((item) => item.id === (currentFile?.office || browser.office));
  const links = (currentFile?.links ?? [])
    .map((id) => catalog.files.find((file) => file.id === id))
    .filter((file): file is EssayFile => Boolean(file));

  return (
    <div className="essay">
      <a className="skip" href="#reading">Skip to the reading</a>
      <header className="essay-top">
        <a className="brand" href="/essay" aria-label="Reading root" onClick={(event) => { event.preventDefault(); openPath('/essay'); }}>
          <ShellMark className="brand-mark" />
        </a>
        <div className="who">The Return of Zero</div>
      </header>
      <nav className="path" aria-label="Where you have been">
        {trail.map((item, index) => (
          <span className="path-step" key={item.id}>
            {index > 0 ? <i>→</i> : null}
            {item.id === pageId
              ? <span className="now">{item.title}</span>
              : <a href={pathUrl(item.id, catalog)} onClick={(event) => { event.preventDefault(); openPath(pathUrl(item.id, catalog)); }}>{item.title}</a>}
          </span>
        ))}
      </nav>
      <aside className="spine">
        <div className="offices" aria-label="The six">
          <h2>The field</h2>
          {catalog.offices.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${item.child ? 'child' : ''}${browser.office === item.id ? ' on' : ''}`}
              aria-pressed={browser.office === item.id}
              onClick={() => setPin({ office: item.id, scope: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="files" aria-label={`Files in ${catalog.offices.find((item) => item.id === browser.office)?.label ?? 'this folder'}`}>
          <h2>In this folder</h2>
          {files.map((file) => (
            <a
              key={file.id}
              href={pathUrl(file.id, catalog)}
              className={file.id === pageId ? 'on' : undefined}
              aria-current={file.id === pageId ? 'page' : undefined}
              onClick={(event) => { event.preventDefault(); openPath(pathUrl(file.id, catalog)); }}
            >
              {file.title}
            </a>
          ))}
        </div>
      </aside>
      <article className="read" id="reading" ref={readRef} onClick={onReadClick}>
        {view.kind === 'page' && page ? (
          <>
            <div className="crumbs">{currentFile?.office ? office?.label : 'Reading root'}</div>
            <h1>{page.title}</h1>
            {page.meta ? <p className="meta">{page.meta}</p> : null}
            <div className="body" dangerouslySetInnerHTML={{ __html: page.html }} />
          </>
        ) : null}
        {view.kind === 'page' && pageError ? (
          <>
            <div className="crumbs">{office?.label}</div>
            <h1>This page is not in the publication.</h1>
            <p>{pageError}</p>
          </>
        ) : null}
        {view.kind === 'folder' ? (
          <>
            <div className="crumbs">{catalog.offices.find((item) => item.id === view.office)?.label}</div>
            <h1>{catalog.offices.find((item) => item.id === view.office)?.label}</h1>
            <p>Choose a file in this folder.</p>
          </>
        ) : null}
        {view.kind === 'missing' ? (
          <>
            <div className="crumbs">The field</div>
            <h1>This page is not in the publication.</h1>
            <p>The address opened inside the essay. Choose a file from the folder on the left.</p>
          </>
        ) : null}
      </article>
      <aside className="graph" aria-label="From this page">
        <h2>From this page</h2>
        <LocalGraph
          title={currentFile ? pathLabel(currentFile, catalog) : 'This page'}
          links={links}
          hrefFor={(id) => pathUrl(id, catalog)}
          onOpen={(id) => openPath(pathUrl(id, catalog))}
        />
        <p>Only the pages this one actually links. Click a node to open it. The whole vault is the list on the left, not this picture.</p>
      </aside>
    </div>
  );
}

function LocalGraph({ title, links, hrefFor: href, onOpen }: { title: string; links: EssayFile[]; hrefFor: (id: string) => string; onOpen: (id: string) => void }) {
  return (
    <ul className="nodes" aria-label={`Pages linked from ${title}`}>
      <li className="here"><span className="dot" aria-hidden="true" />{title}</li>
      {links.map((link) => (
        <li key={link.id}>
          <a href={href(link.id)} onClick={(event) => { event.preventDefault(); onOpen(link.id); }}>
            <span className="dot" aria-hidden="true" />{link.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
