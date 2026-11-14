// Each world's track head opens the world's Docs full in a pane (manual §18.1: "The settings stand on the track's head … The world's
// account of itself is Docs, on the track's chain (§18.5)"). Central's tracks are the kernel's Set (frame/tracks/kernelSet.ts, O-I #1004);
// this names, for each world's track it draws, the device its head opens. The press selects the track first, so the device reads that
// world. Opening a pane is the window's own act, not an owner's write, so it stays here rather than in the Set.
import {useEffect} from 'react'
import {nameTrackHeadDevices, type TrackHeadDevice} from '../frame/tracks/trackHeads'
import {openInstrument} from '../frame/instrumentDoor'
import {DEVICE_PANE_KIND} from '../frame/devices/deviceDoor'
import {centralDeviceId} from './devices/centralDeviceModel'
import {centralWorldTrackId} from '../timeline/centralTrackAdapter'
import type {UseModeTracks} from '../frame/tracks/modeTracks'

const DOCS_DEVICE = centralDeviceId('docs')
const WORLD_TRACK = centralWorldTrackId('')

/** Central's tracks with each world's head naming its Docs. */
export function withWorldDocs(use: UseModeTracks): UseModeTracks {
  return reading => {
    const answer = use(reading)
    const worlds = answer && !('waiting' in answer) ? answer.tracks.filter(track => track.id.startsWith(WORLD_TRACK)) : []
    const key = worlds.map(track => `${track.id}\n${track.name}`).join('\n\n')
    useEffect(() => {
      const devices = new Map<string, TrackHeadDevice>(worlds.map(track => [track.id, {
        title: 'Docs',
        does: `Open ${track.name}'s Docs full in a pane: the world's account of itself, on six tiers`,
        open: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: DOCS_DEVICE, title: `${track.name} · Docs`}),
      }]))
      nameTrackHeadDevices('central', devices)
      return () => nameTrackHeadDevices('central', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the world tracks (their ids and names) the devices are made of
    }, [key])
    return answer
  }
}
