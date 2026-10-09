import {useRef} from 'react'
import {CutIcon} from './agentIcons'
import {AGENT_DATA_I, AGENT_TRANSPORT_TIPS} from './agentFidelity'
import {useAgentShell, EFFORT_STEPS} from './AgentShellContext'
import {startAgentVoice, stopAgentVoice} from './useAgentVoice'
import type {DictationSession} from '../../../../../desktop/cradle/src/dictation/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import './agentShell.css'

/** The transport, at the mockup's rhythm, with the icon specimen's marks
 * (icon-cut.html ruling): Link/Tap/Follow/Arm/Hand-back/Capture/Loop drawn
 * monoline; Play/Stop/Record the filled keys; ‹ › and Σ stay the mockup's
 * own characters; the heartbeat takes the pendulum. */
export function AgentShellTransport({
  title,
  browser,
  detail,
  dock,
  toggleBrowser,
  toggleDetail,
  toggleDock,
  onCentreView,
  centreView,
  tokensIn = '—',
  tokensOut = '—',
  spendFill = null as number | null,
  running = true,
  controlBusy = false,
  onRun,
  onStop,
  budgetLabel = '— / —',
  positionLabel = '— . — . —',
  transport,
}: {
  title: string
  browser: boolean
  detail: boolean
  dock: boolean
  toggleBrowser: () => void
  toggleDetail: () => void
  toggleDock: () => void
  onCentreView: (view: 'session' | 'arrangement') => void
  centreView: 'session' | 'arrangement' | 'thread'
  tokensIn?: string
  tokensOut?: string
  spendFill?: number | null
  running?: boolean
  controlBusy?: boolean
  onRun?: () => void
  onStop?: () => void
  budgetLabel?: string
  positionLabel?: string
  transport: KernelTransportStatus
}) {
  const shell = useAgentShell()
  const voiceSession = useRef<DictationSession | null>(null)
  const stepEffort = (dir: -1 | 1) => {
    const i = EFFORT_STEPS.indexOf(shell.effort)
    const next = EFFORT_STEPS[Math.max(0, Math.min(EFFORT_STEPS.length - 1, i + dir))]
    shell.setEffort(next)
  }
  const tap = () => {
    const line = `Tap ${new Date().toISOString()} · ${shell.heartbeat ? 'heartbeat on' : 'heartbeat off'}`
    shell.setTapNote(line)
    shell.recordCapture('tap')
    if (!shell.openTiles.includes('agents')) shell.toggleTile('agents')
  }
  const toggleVoice = async () => {
    if (shell.voiceArmed && voiceSession.current) {
      const note = await stopAgentVoice(voiceSession.current)
      voiceSession.current = null
      shell.setVoiceArmed(false)
      shell.setVoiceNote(note)
      return
    }
    shell.setVoiceArmed(true)
    shell.recordCapture('voice')
    const started = await startAgentVoice(transport)
    if (!started.ok) {
      shell.setVoiceNote(started.note)
      return
    }
    voiceSession.current = started.session
    shell.setVoiceNote('Recording — click Voice again to transcribe into the armed track.')
  }
  const toggleCapture = () => {
    if (shell.capturing) {
      shell.setCapturing(false)
      shell.setCaptureNote(`Captured ${shell.captureLog.length} action(s) as a worked-example clip.`)
      return
    }
    shell.setCapturing(true)
    shell.recordCapture('capture-start')
    shell.setCaptureNote('Capture on — shell actions land as a skill example.')
  }
  return (
    <header className="transport agent-shell-transport" data-region="transport">
      <div className="set-title"><b>{title}</b></div>
      <div className="transport-controls">
        <button type="button" id="tBrowser" data-i={AGENT_DATA_I.tBrowser} className="chrome-toggle" aria-pressed={browser} title={AGENT_TRANSPORT_TIPS.browser} onClick={toggleBrowser}><CutIcon name="browser" size={14} /></button>
        <div className="transport-group">
          <button type="button" className="agent-nc" data-i={AGENT_DATA_I.link} title={AGENT_TRANSPORT_TIPS.link}><CutIcon name="link" size={14} /></button>
          <button type="button" className="agent-nc" id="tap" data-i={AGENT_DATA_I.tap} title={AGENT_TRANSPORT_TIPS.tap} onClick={tap}><CutIcon name="tap" size={14} /></button>
          <button type="button" className="agent-fld" id="effort" data-i={AGENT_DATA_I.effort} title={AGENT_TRANSPORT_TIPS.effort}><span>{shell.effort}</span></button>
          <button type="button" className="agent-nc" id="effDn" data-i={AGENT_DATA_I.effDn} title={AGENT_TRANSPORT_TIPS.effortDn} onClick={() => stepEffort(-1)}>‹</button><button type="button" className="agent-nc" id="effUp" data-i={AGENT_DATA_I.effUp} title={AGENT_TRANSPORT_TIPS.effortUp} onClick={() => stepEffort(1)}>›</button>
          <span className="agent-fld" id="budget" data-i={AGENT_DATA_I.budget} title={AGENT_TRANSPORT_TIPS.budget}>{budgetLabel}</span>
          <button type="button" className={'agent-nc' + (shell.heartbeat ? ' on' : '')} id="hb" data-i={AGENT_DATA_I.hb} title={AGENT_TRANSPORT_TIPS.heartbeat} onClick={() => shell.setHeartbeat(!shell.heartbeat)}><CutIcon name="metro" size={14} /></button>
          <button type="button" className="agent-nc" id="quantize" data-i={AGENT_DATA_I.quantize} title={AGENT_TRANSPORT_TIPS.quantize} onClick={shell.cycleQuantize}>{shell.quantize} ▾</button>
        </div>
        <div className="transport-group" style={{marginLeft: 14}}>
          <button type="button" className="agent-nc" id="tokScope" data-i={AGENT_DATA_I.tokScope} title={AGENT_TRANSPORT_TIPS.tokens} onClick={shell.cycleTokenScope}>Σ {shell.tokenScope}</button>
          <span className="agent-fld" data-i={AGENT_DATA_I.tokIn} title={AGENT_TRANSPORT_TIPS.tokIn}><small>in</small><span id="tokIn">{tokensIn}</span></span>
          <span className="agent-fld" data-i={AGENT_DATA_I.tokOut} title={AGENT_TRANSPORT_TIPS.tokOut}><small>out</small><span id="tokOut">{tokensOut}</span></span>
        </div>
        <div className="transport-spacer" />
        <div className="transport-group">
          <button type="button" className={'agent-nc' + (shell.follow ? ' on' : '')} id="follow" data-i={AGENT_DATA_I.follow} title={AGENT_TRANSPORT_TIPS.follow} onClick={() => shell.setFollow(!shell.follow)}><CutIcon name="follow" size={14} /></button>
          <span className="agent-fld" id="position" data-i={AGENT_DATA_I.position} title={AGENT_TRANSPORT_TIPS.position}>{positionLabel}</span>
          <button type="button" className={'agent-tbtn play' + (running ? ' on' : '')} id="play" data-i={AGENT_DATA_I.play} title={AGENT_TRANSPORT_TIPS.run} disabled={controlBusy} onClick={onRun}><CutIcon name="play" size={15} /></button>
          <button type="button" className="agent-tbtn" id="stop" data-i={AGENT_DATA_I.stop} title={AGENT_TRANSPORT_TIPS.stop} disabled={controlBusy} onClick={onStop}><CutIcon name="stop" size={15} /></button>
          <button type="button" className={'agent-tbtn rec' + (shell.voiceArmed ? ' on' : '')} id="rec" data-i={AGENT_DATA_I.rec} title={AGENT_TRANSPORT_TIPS.voice} onClick={() => void toggleVoice()}><CutIcon name="rec" size={15} /></button>
          <button type="button" className={'agent-nc' + (shell.steer ? ' on' : '')} id="od" data-i={AGENT_DATA_I.od} title={AGENT_TRANSPORT_TIPS.steer} onClick={() => shell.setSteer(!shell.steer)}><CutIcon name="plus" size={12} /></button>
          <button type="button" className={'agent-nc' + (shell.writeArm ? ' on' : '')} id="arm" data-i={AGENT_DATA_I.arm} title={AGENT_TRANSPORT_TIPS.writeArm} onClick={() => shell.setWriteArm(!shell.writeArm)}><CutIcon name="arm" size={14} /></button>
          <button type="button" className={'agent-nc' + (shell.handBackLit ? ' warn' : '')} data-i={AGENT_DATA_I.handBack} title={AGENT_TRANSPORT_TIPS.handBack} onClick={() => shell.setHandBackLit(false)}><CutIcon name="back" size={14} /></button>
          <button type="button" className={'agent-nc' + (shell.capturing ? ' on' : '')} id="capture" data-i={AGENT_DATA_I.capture} title={AGENT_TRANSPORT_TIPS.capture} onClick={toggleCapture}><CutIcon name="cap" size={14} /></button>
          <button type="button" className={'agent-nc' + (shell.loopOn ? ' on' : '')} id="loop" data-i={AGENT_DATA_I.loop} title={AGENT_TRANSPORT_TIPS.loop} onClick={() => shell.setLoopOn(!shell.loopOn)}><CutIcon name="loop" size={13} /></button>
        </div>
        <div className="transport-spacer" />
        <div className="transport-group">
          <span className="cpu-meter" data-i={AGENT_DATA_I.spend} title={AGENT_TRANSPORT_TIPS.spend} style={spendFill === null ? undefined : {['--fill' as string]: `${Math.round(spendFill * 100)}%`}} />
        </div>
        <button type="button" id="tDetail" data-i={AGENT_DATA_I.tDetail} className="chrome-toggle" aria-pressed={detail} title={AGENT_TRANSPORT_TIPS.detail} onClick={toggleDetail}><CutIcon name="detail" size={14} /></button>
        <button type="button" id="tDock" data-i={AGENT_DATA_I.tDock} className="chrome-toggle" aria-pressed={dock} title={AGENT_TRANSPORT_TIPS.dock} onClick={toggleDock}><CutIcon name="dock" size={14} /></button>
        <nav className="surface-icons" aria-label="Agent working surface">
          <button type="button" id="vSession" data-i={AGENT_DATA_I.vSession} aria-pressed={centreView === 'session'} title={AGENT_TRANSPORT_TIPS.sessionTab} onClick={() => onCentreView('session')}><CutIcon name="session" size={15} /></button>
          <button type="button" id="vArr" data-i={AGENT_DATA_I.vArr} aria-pressed={centreView === 'arrangement'} title={AGENT_TRANSPORT_TIPS.arrangementTab} onClick={() => onCentreView('arrangement')}><CutIcon name="arrangement" size={15} /></button>
        </nav>
      </div>
      {(shell.tapNote || shell.voiceNote || shell.captureNote) && (
        <p className="agent-transport-note" role="status">{shell.voiceNote ?? shell.captureNote ?? shell.tapNote}</p>
      )}
    </header>
  )
}
