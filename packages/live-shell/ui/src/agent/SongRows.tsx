// Songs under Material (O-I #844; manual §10.3 Material: "songs made into clips"; §19.1: "It stands under Material in the browser, under
// the project that made it"): Factory's clips, read for every Factory source Central discloses (songClips.ts readSongs), grouped by the
// project that keeps each. A press selects one — the browser's own selection, which the Skillset rack's Capture page takes as its "A
// selected clip" source — and its preview at the foot of the list says what it was made from and where its set stands, with Remake, and
// Routine… with its schedule (Repeat and when): with the song's note chosen in a task's Clip view, AIKit prepares the schedule and files
// the take's Method for you to accept (songClips.ts routineOfSong; each run of the routine a take Factory starts), and Make routine… opens
// Settings › Automations on the new routine with that schedule (songRoutineRequest; O-I #758). A drag carries the
// clip (SONG_CLIP_DRAG) onto a session's track, where it is one unit of that session's song with the thread form canon.
// A project Factory refused says so in its words; a reading that has not come says it is reading.
import {useEffect, useReducer, useState} from 'react'
import {createPortal} from 'react-dom'
import type {ControlledBrowser} from '../frame/browser/browserKinds'
import {useWorkspace} from '../shell/workspaceContext'
import {useHeldRead} from '../owners/ownerCall'
import {onOwnerChanged} from '../owners/notices'
import {KindMark} from '../inhabitants/sdk/marks.tsx'
import {Refusal} from '../../../../../desktop/cradle/src/shared/Refusal.tsx'
import type {WorldActionReceipt} from '../timeline/worldTrackAdapter'
import {chosenNoteNow, readSongsThrough, remakeSong, ROUTINE_SONG, routineOfSong, selectSongClip, SONG_CLIP_DRAG, songPayload, songRoutineRequest, songWords, STANDING_WORD,
  useSongClipFocus, type SongRoutineReceipt, type SongRow, type SongsReading} from './songClips'
import {scheduleFromInput, type ScheduleShape} from '../settings/routines'
import {openSettings} from '../settings/host'
import {REMAKE, remakeDoes} from '../frame/detail/remake'
import type {NewRoutineRequest} from '../settings/adapter'

export interface SongRowsViewProps {
  readonly reading: SongsReading | null
  readonly query: string
  readonly selected: SongRow | null
  readonly onSelect: (row: SongRow) => void
  readonly onRemake: (row: SongRow) => void
  /** Remake's answer: Factory's note, or its refusal. */
  readonly remade?: WorldActionReceipt | null
  /** Routine…'s press, with the schedule given, and its answer: AIKit's filed Method, or the refusal. */
  readonly onRoutine?: (row: SongRow, shape: ScheduleShape) => void
  readonly routined?: SongRoutineReceipt | null
  /** Make routine…'s press: Settings › Automations on the new routine Routine… answered with. */
  readonly onMakeRoutine?: (row: SongRow, routine: NewRoutineRequest) => void
  readonly previewHost?: HTMLElement | null
}

/** The songs, grouped by the project that keeps each. Pure of owners: the reading is handed in. */
export function SongRowsView({reading, query, selected, onSelect, onRemake, remade = null, onRoutine, routined = null, onMakeRoutine, previewHost = null}: SongRowsViewProps) {
  if (!reading) return <p className="browser-empty" role="status">Reading your songs…</p>
  if (reading.state === 'absent') return <Refusal className="native-error" said="Your songs were not read." error={reading.why} ownWords />
  const needle = query.trim().toLowerCase()
  const groups = reading.groups.map(group => ({...group, songs: needle ? group.songs.filter(row => row.name.toLowerCase().includes(needle)) : group.songs}))
  const shown = groups.some(group => group.songs.length)
  return <section className="mode-browser-rows place-rows" aria-label="Songs" data-browser-songs>
    <div className="browser-list-heading">Name <span /></div>
    <ul>{groups.map(group => <li key={group.label} data-song-project={group.project ?? 'root'}>
      {(group.songs.length > 0 || group.state === 'refused') && <h4 className="place-rows-group">{group.label}</h4>}
      {group.state === 'refused' && <Refusal className="native-error" said={`${group.label}'s songs were not read.`} error={group.why} ownWords />}
      {group.songs.map(row => <button key={row.key} type="button" className={`mode-browser-row${row.key === selected?.key ? ' selected' : ''}`}
        aria-pressed={row.key === selected?.key} data-song={row.clipRef ?? row.name} data-standing={row.standing} title={songWords(row)}
        data-i={`${row.name}|${songWords(row)} Drag it onto a session's track: it becomes a task of that session's song, with the thread form canon.`}
        draggable={!!row.clipRef} onDragStart={event => { event.dataTransfer.setData(SONG_CLIP_DRAG, songPayload(row)); event.dataTransfer.setData('text/plain', row.name)
          event.dataTransfer.effectAllowed = 'copy' }}
        onClick={() => onSelect(row)}>
        <span aria-hidden="true"><KindMark kind="run" size={12} /></span><span>{row.name}</span><span className="mode-browser-row-meta">{STANDING_WORD[row.standing]}</span>
      </button>)}
    </li>)}</ul>
    {!shown && <p className="browser-empty">{needle ? 'No song matches.' : 'No song is made into a clip yet: File › Export Song… makes the selected task\'s song one.'}</p>}
    {remade?.ok && <p className="browser-empty" role="status">{remade.note}</p>}
    {remade && !remade.ok && <Refusal className="native-error" said="Remake did not make the song again." error={remade.error} />}
    {previewHost && selected && createPortal(songPreview(selected, onRemake, onRoutine, routined, onMakeRoutine), previewHost)}
  </section>
}

/** The selected song's preview: what it was made from and where its set stands, Remake, and Routine… with its schedule. Pure of owners. */
export function songPreview(selected: SongRow, onRemake: (row: SongRow) => void, onRoutine?: (row: SongRow, shape: ScheduleShape) => void,
  routined: SongRoutineReceipt | null = null, onMakeRoutine?: (row: SongRow, routine: NewRoutineRequest) => void) {
  return <div className="place-preview" role="status" data-song-preview={selected.clipRef ?? selected.name}>
    <p>{songWords(selected)}</p>
    <button type="button" className="mode-browser-row" data-action="remake-song" onClick={() => onRemake(selected)}
      data-i={`${REMAKE}|${remakeDoes(selected.name, 'set')}`}>{REMAKE}</button>
    <SongRoutine key={selected.key} row={selected} onRoutine={onRoutine} answer={routined} onMakeRoutine={onMakeRoutine} />
  </div>
}

/** How often a routine runs, as Settings › Automations asks it (settings/routines.ts scheduleFromInput), and what each takes. */
const REPEATS: readonly {readonly kind: ScheduleShape['kind']; readonly label: string; readonly hint: string}[] = [
  {kind: 'daily', label: 'Daily at', hint: '07:30'}, {kind: 'every', label: 'Every (seconds)', hint: '3600'},
  {kind: 'once', label: 'Once at', hint: '2026-11-05T07:30:00Z'}, {kind: 'cron', label: 'Cron', hint: '0 8 * * 1-5'},
]

/** Routine… on the selected song: its schedule (Repeat and when) and the press, which hands the schedule's shape on; a schedule that is
 * no shape is refused in the face's words before anything is asked. */
function SongRoutine({row, onRoutine, answer, onMakeRoutine}: {row: SongRow; onRoutine?: (row: SongRow, shape: ScheduleShape) => void; answer: SongRoutineReceipt | null
  onMakeRoutine?: (row: SongRow, routine: NewRoutineRequest) => void}) {
  const [repeat, setRepeat] = useState<ScheduleShape['kind']>('daily')
  const [when, setWhen] = useState('')
  const [why, setWhy] = useState<string | null>(null)
  const shown = REPEATS.find(item => item.kind === repeat) ?? REPEATS[0]!
  const press = () => {
    if (!onRoutine) return
    try { const shape = scheduleFromInput(repeat, when.trim()); setWhy(null); onRoutine(row, shape) } catch (cause) { setWhy(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <div className="browser-template-start" data-song-routine={row.clipRef ?? row.name}>
    <label>Repeat <select data-song-routine-repeat value={repeat} onChange={event => { setRepeat(event.target.value as ScheduleShape['kind']); setWhy(null) }}>
      {REPEATS.map(item => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select></label>
    <input aria-label={shown.label} data-song-routine-when value={when} placeholder={shown.hint} onChange={event => { setWhen(event.target.value); setWhy(null) }} />
    <button type="button" data-action="song-routine" disabled={!onRoutine} onClick={press} data-i={`Routine…|${ROUTINE_SONG}`}>Routine…</button>
    {why && <Refusal className="native-error" said="Routine… asked nothing." error={why} />}
    {answer?.ok && <p role="status">{answer.note}</p>}
    {answer?.ok && <button type="button" data-action="song-make-routine" disabled={!onMakeRoutine} onClick={() => onMakeRoutine?.(row, answer.routine)}
      data-i={`Make routine…|Opens Settings › Automations on a new routine of ${row.name}'s take, with this schedule's Repeat and When. Create it there once the Method is accepted and a run of it is verified.`}>Make routine…</button>}
    {answer && !answer.ok && <Refusal className="native-error" said="Routine… filed no Method." error={answer.error} ownWords />}
  </div>
}

/** The Songs category's body: Factory's reading, read again when a song is exported, remade or dropped. */
export function SongRows({controlled}: {controlled: ControlledBrowser}) {
  const {transport} = useWorkspace()
  const [again, readAgain] = useReducer((n: number) => n + 1, 0)
  useEffect(() => onOwnerChanged('temporal', () => readAgain()), [])
  const held = useHeldRead(transport.kind === 'unavailable' ? null : ['factory-songs', JSON.stringify(transport), again], () => readSongsThrough(transport))
  const reading: SongsReading | null = transport.kind === 'unavailable' ? {state: 'absent', why: `Factory is not reached: ${transport.reason ?? 'the shell has no kernel carrier'}.`}
    : held.status === 'answered' ? held.value : held.status === 'refused' ? {state: 'absent', why: held.error ?? 'Factory did not answer.'} : null
  const selected = useSongClipFocus()
  const [remade, setRemade] = useState<WorldActionReceipt | null>(null)
  const [routined, setRoutined] = useState<SongRoutineReceipt | null>(null)
  return <SongRowsView reading={reading} query={controlled.query} previewHost={controlled.previewHost} selected={selected} remade={remade}
    routined={routined}
    onSelect={row => { setRemade(null); setRoutined(null); selectSongClip(row) }}
    onRemake={row => { setRemade(null); void remakeSong(transport, row).then(setRemade) }}
    onRoutine={(row, shape) => { setRoutined(null); void routineOfSong(transport, row, chosenNoteNow(), shape).then(setRoutined) }}
    onMakeRoutine={(row, routine) => openSettings(songRoutineRequest(row, routine))} />
}
