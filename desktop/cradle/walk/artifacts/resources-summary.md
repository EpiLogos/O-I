# Resources walk — summary

label: `baseline-during-shell-rebuild` · generated 2026-09-08T11:01:57.891Z

- base URL: http://localhost:4173
- bridge URL: http://127.0.0.1:4179
- cycles: 20 (warm-up 3, sampled 17)
- window.gc exposed: false
- step issues recorded: 80

| cycle | wall ms | heap used (B) | heap total (B) | nodes | listeners | documents | frames | bridge reqs | surfaces-tabs |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 4 | 60616 | 7119720 | 10616832 | 1733 | 525 | 4 | 3 | 245 | 0 |
| 5 | 60438 | 7378472 | 9568256 | 1733 | 523 | 4 | 3 | 246 | 0 |
| 6 | 60844 | 6819360 | 11141120 | 1723 | 521 | 4 | 3 | 240 | 0 |
| 7 | 61021 | 7002876 | 11141120 | 1713 | 525 | 4 | 3 | 242 | 0 |
| 8 | 60849 | 7685160 | 10354688 | 1731 | 523 | 4 | 3 | 248 | 0 |
| 9 | 60350 | 7303896 | 11403264 | 1729 | 523 | 4 | 3 | 249 | 0 |
| 10 | 60248 | 7638064 | 9830400 | 1727 | 523 | 4 | 3 | 246 | 0 |
| 11 | 60284 | 6725096 | 10616832 | 1639 | 498 | 3 | 3 | 250 | 0 |
| 12 | 60356 | 7026368 | 8781824 | 1639 | 496 | 3 | 3 | 250 | 0 |
| 13 | 60307 | 6929792 | 8781824 | 1639 | 496 | 3 | 3 | 251 | 0 |
| 14 | 60286 | 8017352 | 10616832 | 1731 | 523 | 4 | 3 | 247 | 0 |
| 15 | 60288 | 7309624 | 10354688 | 1731 | 523 | 4 | 3 | 250 | 0 |
| 16 | 60294 | 7389728 | 10092544 | 1731 | 525 | 4 | 3 | 248 | 0 |
| 17 | 60302 | 7448964 | 10092544 | 1729 | 523 | 4 | 3 | 249 | 0 |
| 18 | 60275 | 7806756 | 9830400 | 1731 | 523 | 4 | 3 | 249 | 0 |
| 19 | 60407 | 6989368 | 10616832 | 1639 | 498 | 3 | 3 | 250 | 0 |
| 20 | 60449 | 7265884 | 8781824 | 1639 | 496 | 3 | 3 | 249 | 0 |

## first stable vs last

| | first stable (cycle 4) | last (cycle 20) |
|---|---:|---:|
| heap used (B) | 7119720 | 7265884 |
| nodes | 1733 | 1639 |
| listeners | 525 | 496 |
| documents | 4 | 3 |

growth per cycle: heap 15684.14 B/cycle · nodes -3.108/cycle

**verdict:** bounded — heap grows 15684.1 B/cycle (< 1% of first-stable 7119720 B) and DOM nodes grow -3.11/cycle (< 5/cycle)

## step issues

- cycle 1 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 1 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 1 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    57 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 1 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 2 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 2 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 2 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    56 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 2 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 3 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 3 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 3 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    55 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 3 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 4 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 4 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 4 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    57 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 4 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 5 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 5 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 5 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 5 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 6 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 6 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 6 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    57 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 6 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 7 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 7 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 7 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    56 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 7 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 8 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 8 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 8 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 8 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 9 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 9 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 9 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 9 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 10 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 10 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 10 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 10 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 11 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 11 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 11 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 11 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 12 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 12 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 12 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 12 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 13 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 13 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 13 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 13 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 14 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 14 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 14 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 14 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 15 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 15 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 15 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 15 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 16 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 16 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 16 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 16 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 17 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 17 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 17 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 17 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 18 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 18 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 18 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 18 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 19 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 19 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 19 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 19 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 20 · 1-open-close: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 20 · 2-split-maximize-restore: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible

- cycle 20 · 3-wiki-open-pan-zoom: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'O-I: wiki', exact: true })
    - locator resolved to <button title="Wiki" aria-pressed="false" aria-label="O-I: wiki">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <button aria-expanded="false" title="Work/O-I/suite" data-file-path="Work/O-I/suite" aria-label="Expand folder suite">…</button> from <section class="project-files" aria-label="O-I navigation">…</section> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

- cycle 20 · 5-tab-switch: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: /^(Reading|Editing) README\.md$/ }) to be visible


