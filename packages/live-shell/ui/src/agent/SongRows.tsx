// Songs under Material (O-I #844; manual §10.3 Material: "songs made into clips"; §19.1: "It stands under Material in the browser, under
// the project that made it"): Factory's clips, read for every Factory source Central discloses (songClips.ts readSongs), grouped by the
// project that keeps each. A press selects one — the browser's own selection, which the Skillset rack's Capture page takes as its "A
// selected clip" source — and its preview at the foot of the list says what it was made from and where its set stands, with Remake. A
// drag carries the clip (SONG_CLIP_DRAG) onto a session's track, where it is one unit of that session's song with the thread form canon.
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
import {readSongsThrough, remakeSong, selectSongClip, SONG_CLIP_DRAG, songPayload, songWords, STANDING_WORD, useSongClipFocus,
  type SongRow, type SongsReading} from './songClips'

export interface SongRowsViewProps {
  readonly reading: SongsReading | null
  readonly query: string
  readonly selected: SongRow | null
  readonly onSelect: (row: SongRow) => void
  readonly onRemake: (row: SongRow) => void
  /** Remake's answer: Factory's note, or its refusal. */
  readonly remade?: WorldActionReceipt | null
  readonly previewHost?: HTMLElement | null
}

/** The songs, grouped by the project that keeps each. Pure of owners: the reading is handed in. */
export function SongRowsView({reading, query, selected, onSelect, onRemake, remade = null, previewHost = null}: SongRowsViewProps) {
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
    {previewHost && selected && createPortal(<div className="place-preview" role="status" data-song-preview={selected.clipRef ?? selected.name}>
      <p>{songWords(selected)}</p>
      <button type="button" className="mode-browser-row" data-action="remake-song" onClick={() => onRemake(selected)}
        data-i={`Remake|Makes ${selected.name} again from the set it names, as that set now stands. A render is never edited in place.`}>Remake</button>
    </div>, previewHost)}
  </section>
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
  return <SongRowsView reading={reading} query={controlled.query} previewHost={controlled.previewHost} selected={selected} remade={remade}
    onSelect={row => { setRemade(null); selectSongClip(row) }}
    onRemake={row => { setRemade(null); void remakeSong(transport, row).then(setRemade) }} />
}
