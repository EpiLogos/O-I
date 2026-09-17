# Resources walk — summary

label: `baseline-during-shell-rebuild` · generated 2026-09-08T11:59:20.938Z

- base URL: http://localhost:4173
- bridge URL: http://127.0.0.1:4179
- cycles: 23 (warm-up 3, sampled 20)
- window.gc exposed: false
- step issues recorded: 0

| cycle | wall ms | heap used (B) | heap total (B) | nodes | listeners | documents | frames | bridge reqs | surfaces-tabs |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 4 | 1380 | 5504360 | 6946816 | 1563 | 354 | 2 | 2 | 69 | 0 |
| 5 | 1633 | 5721552 | 6422528 | 1563 | 354 | 2 | 2 | 70 | 0 |
| 6 | 1584 | 5743776 | 6946816 | 1563 | 354 | 2 | 2 | 70 | 0 |
| 7 | 1652 | 5705008 | 6946816 | 332 | 347 | 2 | 2 | 70 | 0 |
| 8 | 1500 | 5946528 | 6946816 | 332 | 347 | 2 | 2 | 70 | 0 |
| 9 | 1704 | 5999612 | 7208960 | 332 | 347 | 2 | 2 | 70 | 0 |
| 10 | 1934 | 6091040 | 7471104 | 331 | 347 | 2 | 2 | 70 | 0 |
| 11 | 2038 | 6135652 | 7208960 | 336 | 345 | 2 | 2 | 71 | 0 |
| 12 | 2223 | 6364580 | 7733248 | 332 | 347 | 2 | 2 | 70 | 0 |
| 13 | 2074 | 6205888 | 7471104 | 335 | 345 | 2 | 2 | 72 | 0 |
| 14 | 3075 | 6533620 | 7733248 | 332 | 345 | 2 | 2 | 69 | 0 |
| 15 | 3796 | 6272372 | 7208960 | 331 | 345 | 2 | 2 | 80 | 0 |
| 16 | 3139 | 6307364 | 7208960 | 332 | 345 | 2 | 2 | 73 | 0 |
| 17 | 5223 | 6609020 | 7471104 | 332 | 347 | 2 | 2 | 84 | 0 |
| 18 | 5732 | 6829344 | 8257536 | 332 | 345 | 2 | 2 | 76 | 0 |
| 19 | 4402 | 6381628 | 7471104 | 336 | 345 | 2 | 2 | 82 | 0 |
| 20 | 5376 | 6416712 | 7471104 | 331 | 345 | 2 | 2 | 82 | 0 |
| 21 | 4642 | 6471004 | 7208960 | 331 | 345 | 2 | 2 | 78 | 0 |
| 22 | 4708 | 6626172 | 7733248 | 332 | 347 | 2 | 2 | 76 | 0 |
| 23 | 5399 | 6985536 | 7733248 | 332 | 349 | 2 | 2 | 80 | 0 |

## first stable vs last

| | first stable (cycle 4) | last (cycle 23) |
|---|---:|---:|
| heap used (B) | 5504360 | 6985536 |
| nodes | 1563 | 332 |
| listeners | 354 | 349 |
| documents | 2 | 2 |

growth per cycle: heap 60504.26 B/cycle · nodes -47.206/cycle

**verdict:** growth observed — heap grows 60504.3 B/cycle (threshold 55043.6 B/cycle) and/or DOM nodes grow -47.21/cycle (threshold 5/cycle); not bounded within the stated envelope

## step issues

none recorded.
