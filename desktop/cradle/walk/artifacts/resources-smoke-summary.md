# Resources walk — summary

label: `baseline-during-shell-rebuild` · generated 2026-09-08T04:05:08.570Z

- base URL: http://localhost:1423
- bridge URL: http://127.0.0.1:4179
- cycles: 4 (warm-up 3, sampled 1)
- window.gc exposed: true
- step issues recorded: 23

| cycle | wall ms | heap used (B) | heap total (B) | nodes | listeners | documents | frames | bridge reqs | surfaces-tabs |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 4 | 150194 | 6861728 | 9306112 | 135 | 176 | 1 | 1 | 593 | 0 |

## first stable vs last

| | first stable (cycle 4) | last (cycle 4) |
|---|---:|---:|
| heap used (B) | 6861728 | 6861728 |
| nodes | 135 | 135 |
| listeners | 176 | 176 |
| documents | 1 | 1 |

growth per cycle: heap 0 B/cycle · nodes 0/cycle

**verdict:** bounded — heap grows 0 B/cycle (< 1% of first-stable 6861728 B) and DOM nodes grow 0/cycle (< 5/cycle)

## step issues

- cycle 1 · 2-split-maximize-restore: timed out waiting for locator count === 2 (last saw 1)
- cycle 1 · 2-close-both: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.tab').first()
    - locator resolved to <div role="tab" tabindex="0" draggable="true" title="README.md" class="tab active" data-active="true" data-dirty="false" data-pinned="false" aria-selected="true" data-title="README.md" data-surface-id="a49f7d24-8933-4a3f-9cda-ee6b78b0470c">…</div>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

- cycle 1 · 3-wiki-open-pan-zoom: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })

- cycle 1 · 3-restore-files-mode: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: files', exact: true })

- cycle 1 · 4-right-region-toggle: page.waitForFunction: Timeout 5000ms exceeded.
- cycle 1 · 5-tab-switch: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 1 · 5-close-both: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.tab').first()
    - locator resolved to <div role="tab" tabindex="0" draggable="true" title="README.md" class="tab active" data-active="true" data-dirty="false" data-pinned="false" aria-selected="true" data-title="README.md" data-surface-id="a49f7d24-8933-4a3f-9cda-ee6b78b0470c">…</div>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-pressed="false">History</button> from <aside data-depth="full" data-region="right" data-overlay="false" class="desktop-side right depth-full" aria-label="Agent and inspector region" data-focus-ref="central:path:/Users/admin/Central:Work/O-I/docs/ARCHITECTURE.md">…</aside> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-pressed="false">History</button> from <aside data-depth="full" data-region="right" data-overlay="false" class="desktop-side right depth-full" aria-label="Agent and inspector region" data-focus-ref="central:path:/Users/admin/Central:Work/O-I/docs/ARCHITECTURE.md">…</aside> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-pressed="false">History</button> from <aside data-depth="full" data-region="right" data-overlay="false" class="desktop-side right depth-full" aria-label="Agent and inspector region" data-focus-ref="central:path:/Users/admin/Central:Work/O-I/docs/ARCHITECTURE.md">…</aside> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 2 · 1-open-close: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 2 · 2-split-maximize-restore: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 2 · 2-close-both: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.tab').first()
    - locator resolved to <div role="tab" tabindex="0" draggable="true" title="README.md" class="tab active" data-active="true" data-dirty="false" data-pinned="false" aria-selected="true" data-title="README.md" data-surface-id="a49f7d24-8933-4a3f-9cda-ee6b78b0470c">…</div>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-pressed="false">History</button> from <aside data-depth="full" data-region="right" data-overlay="false" class="desktop-side right depth-full" aria-label="Agent and inspector region" data-focus-ref="central:path:/Users/admin/Central:Work/O-I/docs/ARCHITECTURE.md">…</aside> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-pressed="false">History</button> from <aside data-depth="full" data-region="right" data-overlay="false" class="desktop-side right depth-full" aria-label="Agent and inspector region" data-focus-ref="central:path:/Users/admin/Central:Work/O-I/docs/ARCHITECTURE.md">…</aside> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-pressed="false">History</button> from <aside data-depth="full" data-region="right" data-overlay="false" class="desktop-side right depth-full" aria-label="Agent and inspector region" data-focus-ref="central:path:/Users/admin/Central:Work/O-I/docs/ARCHITECTURE.md">…</aside> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 2 · 3-wiki-open-pan-zoom: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })

- cycle 2 · 3-restore-files-mode: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: files', exact: true })

- cycle 2 · 5-tab-switch: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 3 · 1-open-close: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 3 · 2-split-maximize-restore: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 3 · 3-wiki-open-pan-zoom: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })

- cycle 3 · 3-restore-files-mode: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: files', exact: true })

- cycle 3 · 5-tab-switch: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 4 · 1-open-close: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 4 · 2-split-maximize-restore: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')

- cycle 4 · 3-wiki-open-pan-zoom: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })

- cycle 4 · 3-restore-files-mode: locator.getAttribute: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: files', exact: true })

- cycle 4 · 5-tab-switch: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('complementary', { name: 'World navigator' }).locator('[data-file-path="Work/O-I/README.md"]')


