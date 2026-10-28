// The charts the Astrology lens knows: Jung's (curated, the first chart) and the visitor's own (this browser only).
// A chart is named by an id in routes ('you', 'jung'); its birth data is looked up here and never put in a URL.
// The list is open: a shared layer would add charts from another source behind `chartSources` without touching the lens.
import { practice, type PracticeRecord } from '../practice/store';
import { meanTimeOffset, natalChart, type BirthData } from './natal';
import type { SidecarChart } from '../types/sky';

export interface ChartRecord {
  id: string;
  label: string;
  birth: BirthData;
  /** where the chart lives: curated in the site, or kept in this browser */
  source: 'curated' | 'local';
  /** a curated chart's own words on where its data comes from */
  line?: string;
  /** who gave a curated chart's birth time, and how far the records agree */
  timeSource?: string;
  /** the clock the time is read on, when it is not the visitor's own */
  clock?: string;
  /** [§8.4 host, O-I #765] the chart as its owner calculated it (in the shell: your saved identity's natal, QL's): a held chart is
   * drawn as it is, and none is computed here for it */
  chart?: SidecarChart & { timeKnown: boolean };
}

/** The visitor's chart as stored (practice store, collection 'charts'). One chart, id 'you'. */
export interface StoredChart extends PracticeRecord {
  label: string;
  birth: BirthData;
  /** [§8.4 host, O-I #765] the owner's chart, when the host holds it */
  chart?: SidecarChart & { timeKnown: boolean };
}

export const YOU = 'you';

export interface CuratedPerson {
  id: string;
  label: string;
  birth: { date: string; time: string | null; timeSource?: string; place: string; lat: number; lon: number; offset: 'mean-time' | number };
  line: string;
}

export function curatedChart(p: CuratedPerson): ChartRecord {
  const offsetMinutes = p.birth.offset === 'mean-time' ? meanTimeOffset(p.birth.lon) : p.birth.offset;
  return {
    id: p.id, label: p.label, source: 'curated', line: p.line, timeSource: p.birth.timeSource,
    clock: p.birth.offset === 'mean-time' ? 'local mean time' : undefined,
    birth: { date: p.birth.date, time: p.birth.time, offsetMinutes, lat: p.birth.lat, lon: p.birth.lon, place: p.birth.place },
  };
}

export function localChart(): ChartRecord | null {
  const c = practice.get<StoredChart>('charts', YOU);
  return c ? { id: YOU, label: c.label || 'You', birth: c.birth, source: 'local', ...(c.chart ? { chart: c.chart } : {}) } : null;
}

/** [§8.4 host, O-I #765] A record's chart: the one its owner holds, else the one computed here from its birth. */
export function chartOf(rec: ChartRecord): SidecarChart & { timeKnown: boolean } {
  return rec.chart ?? natalChart(rec.birth);
}

export function saveLocalChart(label: string, birth: BirthData): ChartRecord {
  practice.put<StoredChart>('charts', { id: YOU, label, birth });
  return localChart()!;
}

export function forgetLocalChart() {
  practice.remove('charts', YOU);
}

/** Every chart known now: the curated ones first (Jung is user zero), then this browser's. */
export function chartSources(curated: CuratedPerson[]): ChartRecord[] {
  const out = curated.map(curatedChart);
  const mine = localChart();
  if (mine) out.push(mine);
  return out;
}
