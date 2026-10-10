import {
  boundedText, CHANNEL_VERSION, expressionRef, FRAME_EXPRESSION_OPERATIONS,
  isDeepInstrument, isHostedAppMode, isStudioSection, NATIVE_CHANNEL, object, OPEN_STUDIO_COMMAND, positiveInteger, readHostedState, readOpenStudioResult,
  type ChannelContext, type ExpressionsOwners, type HostedAppMode, type HostedAppState,
  type HostedTechneLens, type HostTarget, type StudioSection,
} from './protocol.ts';
import {readStageResult, stageRequestMessage, type StageCommand, type StageResult} from './protocol.ts';
import {RecoveryAdmission, type RecoveryBinding} from './recoveryBinding.ts';
/** A stage control that the frame never answers settles as a refusal, never a hang. */
const STAGE_TIMEOUT_MS = 60000;

export interface ExpressionsHostOptions {
  bindingId: string;
  owners: ExpressionsOwners;
  mode?: HostedAppMode;
  /** Successful owner-selected continuation addresses. An empty array admits
   * no native work; omission preserves legacy non-recovery hosting only. */
  recoveryBindings?: readonly RecoveryBinding[];
  initialRecoveryBinding?: RecoveryBinding;
  world?: string;
  expectedOrigin?: string;
  /** The composition root knows which retained host is presented. */
  isPresented?: () => boolean;
  onState?: (state: HostedAppState) => void;
  onStatus?: (status: 'loading' | 'ready' | 'unavailable', reason?: string) => void;
  onHostRequest?: (request: Readonly<Record<string, unknown>>) => void;
  /** The application's answer to an open-studio command: opened, or refused with its reason. */
  onStudioResult?: (result: {ok: true; section: StudioSection} | {ok: false; error: string}) => void;
  handshakeTimeoutMs?: number;
  /** A newly created aperture is bound before its first document loads.
   * That load completes this epoch; later loads replace it. Existing frames
   * omit this flag so their next load is a replacement. */
  initialNavigationPending?: boolean;
  /** EventTarget injection exercises this same controller without a DOM. */
  messageTarget?: EventTarget;
}

/** One retained frame. Changing the cut posts a message and never changes src.
 * Reload/dispose invalidates every in-flight reply and captured target. */
export class ExpressionsHost {
  readonly frame: HTMLIFrameElement;
  readonly bindingId: string;
  readonly origin: string;
  private readonly options: ExpressionsHostOptions;
  private readonly messages: EventTarget;
  private readonly recovery: RecoveryAdmission;
  private mode: HostedAppMode;
  private world?: string;
  private epoch = 0;
  private alive = true;
  private ready = false;
  private initialNavigationPending: boolean;
  private reading: HostedAppState | null = null;
  private abort = new AbortController();
  private timeout?: ReturnType<typeof setTimeout>;
  private readonly seen = new Set<string>();
  private pendingOpen: {ref: string; refresh: boolean; lens?: HostedTechneLens; recovery?: RecoveryBinding} | null = null;
  /** Tagged with the document epoch it was asked of: a reload drops it. */
  private pendingStudio: {section: StudioSection; epoch: number} | null = null;
  /** Each stage control awaits its own answer by request id. A reload or disposal settles all of them. */
  private pendingStage = new Map<number, {epoch: number; settle: (result: StageResult) => void; timer: ReturnType<typeof setTimeout>}>();
  private stageRequests = 0;
  private nativeEpoch = crypto.randomUUID();
  private nativeLease: string | null = null;
  private nativeOpening = false;
  private stopOwners?: () => void;

  constructor(frame: HTMLIFrameElement, options: ExpressionsHostOptions) {
    if (!boundedText(options.bindingId)) throw Error('A hosted application needs its own binding identity');
    if (options.mode !== undefined && !isHostedAppMode(options.mode)) throw Error('Unknown Expressions cut');
    this.frame = frame;
    this.bindingId = options.bindingId;
    this.options = options;
    this.recovery = new RecoveryAdmission(options.recoveryBindings);
    this.recovery.initial(options.initialRecoveryBinding);
    this.initialNavigationPending = options.initialNavigationPending ?? false;
    this.mode = options.mode ?? 'expressions';
    this.world = options.world;
    this.origin = options.expectedOrigin ?? new URL(frame.src).origin;
    if (!this.origin || this.origin === 'null' || this.origin === '*') throw Error('The hosted application requires an exact non-opaque origin');
    this.messages = options.messageTarget ?? window;
    // Capture guard protects imported native facades as well as this channel.
    this.messages.addEventListener('message', this.guard, true);
    this.messages.addEventListener('message', this.receive);
    frame.addEventListener('load', this.loaded);
    this.stopOwners = options.owners.attach?.(frame, () => this.reading);
    this.startHandshake();
  }

  private guard = (event: Event) => {
    const e = event as MessageEvent;
    if (this.frame.contentWindow && e.source === this.frame.contentWindow && e.origin !== this.origin) e.stopImmediatePropagation();
  };
  private post(data: Record<string, unknown>) {
    if (this.alive) this.frame.contentWindow?.postMessage(data, this.origin);
  }
  private announce() {
    if (this.options.owners.channels['kernel-expression']) {
      this.post({v: CHANNEL_VERSION, kind: 'oi-kernel-channel', channel: 'kernel-expression'});
    }
    this.post({v: CHANNEL_VERSION, kind: 'host-mode', mode: this.mode, ...(this.world ? {world: this.world} : {})});
    this.post({schema: NATIVE_CHANNEL, epoch: this.nativeEpoch, kind: 'available', available: !!this.options.owners.native,
      reason: this.options.owners.native ? null : this.options.owners.unavailableReason ?? 'No native Expressions owner is attached'});
    this.post({schema: NATIVE_CHANNEL, epoch: this.nativeEpoch, kind: 'visibility', visible: this.presented()});
  }
  private startHandshake() {
    clearTimeout(this.timeout);
    this.options.onStatus?.('loading');
    this.timeout = setTimeout(() => {
      if (this.alive && !this.ready) this.options.onStatus?.('unavailable', 'The candidate Expressions application did not answer its state handshake');
    }, this.options.handshakeTimeoutMs ?? 30000);
    this.announce();
  }
  private releaseNative(lease: string | null, context = this.context()) {
    if (lease && this.options.owners.native) void this.options.owners.native({operation: 'close', lease}, context)
      .catch(() => this.options.onStatus?.('unavailable', 'The native Expressions owner did not acknowledge lease cleanup'));
  }
  private settleStage(error: string) {
    for (const [req, pending] of this.pendingStage) {clearTimeout(pending.timer); this.pendingStage.delete(req); pending.settle({ok: false, error});}
  }
  private loaded = () => {
    if (this.initialNavigationPending) {
      this.initialNavigationPending = false;
      // Module boot can issue hello/state/native reads before iframe load.
      // Their replies belong to this first document, not a discarded epoch.
      this.announce();
      return;
    }
    this.settleStage('The application reloaded before it answered this stage command');
    const lease = this.nativeLease;
    const context = this.context();
    this.abort.abort();
    this.abort = new AbortController();
    this.epoch++;
    this.nativeEpoch = crypto.randomUUID();
    this.nativeLease = null;
    this.nativeOpening = false;
    this.reading = null;
    this.ready = false;
    this.seen.clear();
    this.releaseNative(lease, context);
    this.startHandshake();
  };
  private context(): ChannelContext {
    const epoch = this.epoch;
    return {mode: this.mode, bindingId: this.bindingId, epoch, signal: this.abort.signal,
      state: this.reading, current: () => this.alive && epoch === this.epoch};
  }
  private presented() {
    return this.alive && (this.options.isPresented?.() ?? !this.frame.closest?.('[hidden],[inert]'));
  }
  private reply(kind: string, req: number, context: ChannelContext, data?: unknown, error?: string) {
    if (context.current()) this.post({v: CHANNEL_VERSION, kind: `${kind}-result`, req,
      ...(error ? {ok: false, error} : {ok: true, data})});
  }
  private receive = (event: Event) => { void this.handleMessage(event as MessageEvent); };
  /** Public for protocol acceptance: exact same handler as the browser event. */
  async handleMessage(event: Pick<MessageEvent, 'source' | 'origin' | 'data'>): Promise<void> {
    if (!this.alive || !this.frame.contentWindow || event.source !== this.frame.contentWindow || event.origin !== this.origin || !object(event.data)) return;
    const data = event.data;
    if (data.schema === NATIVE_CHANNEL) {await this.handleNative(data); return;}
    if (data.v !== CHANNEL_VERSION || !boundedText(data.kind, 128)) return;
    const kind = data.kind;
    if (kind === 'oi-app-state') {
      const state = readHostedState(data.state);
      if (!state) return;
      this.reading = state;
      if (!this.ready) {
        this.ready = true;
        clearTimeout(this.timeout);
        this.options.onStatus?.('ready');
      }
      this.options.onState?.(state);
      if (this.pendingOpen && this.presented()) {
        const pending = this.pendingOpen;
        this.pendingOpen = null;
        this.sendOpen(pending);
      }
      if (this.pendingStudio && this.presented()) {
        const pending = this.pendingStudio;
        this.pendingStudio = null;
        if (pending.epoch === this.epoch) this.sendStudio(pending.section);
      }
      return;
    }
    if (kind === 'oi-kernel-hello') {this.announce(); return;}
    if (kind === 'host-request') {
      if (!this.ready || !this.presented() || !boundedText(data.request, 128)) return;
      if (data.request === 'summon' && object(data.detail) && data.detail.kind === 'instrument' && isDeepInstrument(data.detail.lens)) {
        this.selectInstrument(data.detail.lens);
      } else this.options.onHostRequest?.(data);
      return;
    }
    // Existing Nara facade owns this grammar, and is protected by guard above.
    if (kind === 'nara-instrument') return;
    // A stage answer is keyed by its request id. Only the current epoch settles it; a stale or malformed one is dropped, never echoed.
    if (kind === 'host-capture-result' || kind === 'host-command-result') {
      const stage = readStageResult(data), pending = stage ? this.pendingStage.get(stage.req) : undefined;
      if (stage && pending && pending.epoch === this.epoch) {
        clearTimeout(pending.timer); this.pendingStage.delete(stage.req);
        pending.settle(stage.ok ? {ok: true} : {ok: false, error: stage.error});
      }
      if (kind === 'host-capture-result' || stage) return;
    }
    if (kind === 'host-command-result') {
      const result = readOpenStudioResult(data);
      if (result) this.options.onStudioResult?.(result);
      return;
    }
    if (!positiveInteger(data.req)) return;
    let context = this.context();
    const replyContext=context;
    if(kind==='techne-time-window'||kind==='techne-reading'&&object(data.request)&&data.request.facet===undefined) {
      const origin=context,scene=origin.state?.nativeScene;
      context={...origin,current:()=>origin.current()&&this.presented()&&!!scene
        &&this.reading?.nativeScene?.expression_ref===scene.expression_ref
        &&this.reading.nativeScene.revision===scene.revision
        &&this.reading.nativeScene.scene_ref===scene.scene_ref};
    }
    const key = `${kind}:${data.req}`;
    if (this.seen.has(key)) {this.reply(kind, data.req, context, undefined, 'This frame request was already handled; read the owner state before retrying'); return;}
    if (this.seen.size >= 65536) {this.reply(kind, data.req, context, undefined, 'The frame reached its bounded request history; reopen the application'); return;}
    this.seen.add(key);
    try {
      const owner = this.options.owners.channels[kind];
      if (!owner) throw Error(`No native owner is attached for host-channel kind: ${kind}`);
      if(kind==='techne-time-window'&&!context.current())throw Error('The originating time instrument is concealed or its native Scene changed');
      let request = data.request;
      if (kind === 'kernel-expression') {
        if (!object(request) || typeof request.operation !== 'string' || !FRAME_EXPRESSION_OPERATIONS.has(request.operation)) throw Error('Unsupported kernel-expression operation');
      } else if (kind === 'central-read') request = {path: data.path};
      else if (kind === 'central-subject-text' || kind === 'central-subject-bytes') request = {ref: data.ref};
      else if (kind === 'expression-recovery') {
        const binding = this.recovery.admit(request);
        const result = await owner(request, context);
        if (!context.current()) return;
        this.reply(kind, data.req, context, this.recovery.acknowledge(request as Record<string, unknown>, result, binding));
        return;
      }
      this.reply(kind, data.req, context, await owner(request, context));
    } catch (cause) {this.reply(kind, data.req, replyContext, undefined, cause instanceof Error ? cause.message : String(cause));}
  }

  private async handleNative(data: Record<string, unknown>) {
    if (data.kind === 'hello') {this.announce(); return;}
    if (data.epoch !== this.nativeEpoch) return;
    if (data.kind === 'dispose') {
      const lease = this.nativeLease;
      this.nativeLease = null;
      this.nativeOpening = false;
      this.nativeEpoch = crypto.randomUUID();
      this.releaseNative(lease);
      return;
    }
    if (!positiveInteger(data.req)) return;
    const nativeEpoch = this.nativeEpoch, context = this.context(), key = `native:${data.req}`;
    const send = (payload: Record<string, unknown>) => {
      if (context.current() && nativeEpoch === this.nativeEpoch) this.post({schema: NATIVE_CHANNEL, epoch: nativeEpoch, kind: 'result', req: data.req, ...payload});
    };
    let opening = false;
    try {
      if (this.seen.has(key)) throw Error('This native request was already handled; read the owner state before retrying');
      if (this.seen.size >= 65536) throw Error('The frame reached its bounded request history');
      this.seen.add(key);
      if (!this.options.owners.native) throw Error('No native Expressions owner is attached');
      const request = data.request;
      if (!object(request) || !['source', 'open', 'compose', 'prepare_world', 'exchange', 'observe', 'close'].includes(String(request.operation))) throw Error('Unsupported native-expression operation');
      if (request.operation === 'open' || request.operation === 'compose') {
        if (this.nativeLease || this.nativeOpening) throw Error('This frame already owns or is opening a native driver');
        this.nativeOpening = true;
        opening = true;
        const result = await this.options.owners.native(request, context);
        if (!object(result) || result.schema !== 'oi.native-expression-open/v1' || !boundedText(result.lease)) throw Error('Invalid native open receipt');
        if (!context.current() || nativeEpoch !== this.nativeEpoch) {this.releaseNative(result.lease); return;}
        this.nativeLease = result.lease;
        send({ok: true, data: result});
      } else if (request.operation === 'prepare_world' || request.operation === 'source') {
        const result = await this.options.owners.native(request, context);
        if (request.operation === 'prepare_world' && (!object(result) || result.schema !== 'oi.native-expression-prepared-world/v1'
          || !object(result.source) || !object(result.source.world) || result.source.world.schema !== 'ql.scene-world/v1'
          || !object(result.source.sky) || result.source.sky.schema !== 'ql.sky-snapshot/v1' || result.lease !== undefined)) throw Error('Invalid native world preparation receipt');
        send({ok: true, data: result});
      } else {
        if (!this.nativeLease || request.lease !== this.nativeLease) throw Error('Native lease does not belong to this frame epoch');
        const lease = this.nativeLease;
        const result = await this.options.owners.native(request, context);
        if (request.operation === 'close' && context.current() && nativeEpoch === this.nativeEpoch && this.nativeLease === lease) this.nativeLease = null;
        send({ok: true, data: result});
      }
    } catch (cause) {send({ok: false, error: cause instanceof Error ? cause.message : String(cause)});}
    finally {if (opening && context.current() && nativeEpoch === this.nativeEpoch) this.nativeOpening = false;}
  }

  getState(): HostedAppState | null {return this.reading;}
  isReady(): boolean {return this.ready && this.alive;}
  setMode(mode: HostedAppMode, world = this.world) {
    if (!this.alive) throw Error('The hosted application was disposed');
    if (!isHostedAppMode(mode)) throw Error('Unknown Expressions cut');
    this.mode = mode;
    this.world = world;
    this.post({v: CHANNEL_VERSION, kind: 'host-mode', mode, ...(world ? {world} : {})});
  }
  setPresented() {
    this.post({schema: NATIVE_CHANNEL, epoch: this.nativeEpoch, kind: 'visibility', visible: this.presented()});
  }
  selectInstrument(lens: HostedTechneLens) {
    if (!isDeepInstrument(lens)) throw Error('Unknown deep instrument');
    if (!this.presented()) throw Error('The requested application is concealed');
    this.setMode('techne');
    this.post({v: CHANNEL_VERSION, kind: 'host-command', command: 'lens', lens});
  }
  openExpression(ref: string, targetBindingId: string, options: {refresh?: boolean; lens?: HostedTechneLens} = {}) {
    if (!expressionRef(ref)) throw Error('A native Expression ref is required');
    if (targetBindingId !== this.bindingId || !this.presented()) throw Error('The requested application is not the presented target');
    if (options.lens !== undefined && !isDeepInstrument(options.lens)) throw Error('Unknown deep instrument');
    const recovery = this.recovery.binding(ref);
    const request = {ref, refresh: options.refresh ?? false, lens: options.lens, ...(recovery ? {recovery} : {})};
    if (!this.ready) this.pendingOpen = request;
    else this.sendOpen(request);
  }
  private sendOpen(request: {ref: string; refresh: boolean; lens?: HostedTechneLens; recovery?: RecoveryBinding}) {
    this.post({v: CHANNEL_VERSION, kind: 'host-command', command: request.refresh ? 'refresh-expression' : 'open-expression', ref: request.ref,
      ...(request.recovery ? {recovery: request.recovery} : {})});
    if (request.lens) this.selectInstrument(request.lens);
  }
  /** Opens one Studio section in the presented application. Refused unless the
   * section is a real nav id and this host is presented; queued until ready. */
  openStudio(section: string) {
    if (!this.alive) throw Error('The hosted application was disposed');
    if (!isStudioSection(section)) throw Error('Unknown Expressions Studio section');
    if (!this.presented()) throw Error('The requested application is concealed');
    if (!this.ready) {this.pendingStudio = {section, epoch: this.epoch}; return;}
    this.sendStudio(section);
  }
  private sendStudio(section: StudioSection) {
    this.post({v: CHANNEL_VERSION, kind: 'host-command', command: OPEN_STUDIO_COMMAND, section});
  }
  /** Runs one stage control in the presented application and settles with its answer.
   * Refused without posting unless the command is in the closed vocabulary and the application is ready and presented. */
  stageCommand(command: StageCommand): Promise<StageResult> {
    if (!this.alive) throw Error('The hosted application was disposed');
    if (!this.ready) throw Error('The Expressions application has not reported its state yet');
    if (!this.presented()) throw Error('The requested application is concealed');
    const req = ++this.stageRequests;
    const message = stageRequestMessage(req, command);
    if (!message) throw Error('Unknown Expressions stage command');
    return new Promise<StageResult>(settle => {
      const timer = setTimeout(() => {if (this.pendingStage.delete(req)) settle({ok: false, error: 'The application did not answer this stage command'});}, STAGE_TIMEOUT_MS);
      this.pendingStage.set(req, {epoch: this.epoch, settle, timer});
      this.post(message);
    });
  }
  captureTarget(): HostTarget {
    if (!this.ready || !this.presented() || !this.reading?.nativeScene) throw Error('Open one native Expression Scene before capturing its target');
    return {bindingId: this.bindingId, epoch: this.epoch, scene: {...this.reading.nativeScene}};
  }
  /** Observe an already captured operation's surviving frame epoch. This does
   * not authorize a new operation: captureTarget remains the presented gate. */
  readOutcomeTarget(target: HostTarget): HostTarget | null {
    if (!this.alive || !this.ready || target.bindingId !== this.bindingId || target.epoch !== this.epoch || !this.reading?.nativeScene) return null;
    return {bindingId:this.bindingId,epoch:this.epoch,scene:{...this.reading.nativeScene}};
  }
  assertTarget(target: HostTarget) {
    const current = this.captureTarget();
    if (target.bindingId !== current.bindingId || target.epoch !== current.epoch
      || target.scene.expression_ref !== current.scene.expression_ref || target.scene.revision !== current.scene.revision
      || target.scene.scene_ref !== current.scene.scene_ref) throw Error('The captured native Scene changed; select the current Scene again');
  }
  dispose() {
    if (!this.alive) return;
    const context = this.context(), lease = this.nativeLease;
    this.alive = false;
    this.settleStage('The hosted application was disposed');
    this.abort.abort();
    clearTimeout(this.timeout);
    this.stopOwners?.();
    this.releaseNative(lease, context);
    this.messages.removeEventListener('message', this.guard, true);
    this.messages.removeEventListener('message', this.receive);
    this.frame.removeEventListener('load', this.loaded);
    this.pendingOpen = null;
    this.pendingStudio = null;
    this.reading = null;
  }
}

/** Mount once at the shell composition root. Hide/reveal this container for
 * shell views; expressions↔techne calls host.setMode on the same handle. */
export function mountExpressionsApplication(container: HTMLElement, applicationUrl: string, options: ExpressionsHostOptions) {
  const frame = container.ownerDocument.createElement('iframe');
  frame.title = 'Expressions';
  frame.dataset.expressionsBinding = options.bindingId;
  const url = new URL(applicationUrl, container.ownerDocument.baseURI);
  const admission = new RecoveryAdmission(options.recoveryBindings);
  const initial = admission.initial(options.initialRecoveryBinding)
    ?? (url.searchParams.has('expression') ? admission.binding(url.searchParams.get('expression')!) : undefined);
  if (initial) {
    if (url.searchParams.get('expression') !== initial.expression_ref) throw Error('The boot Expression differs from its selected recovery address');
    url.searchParams.set('recovery-scope', initial.scope);
    url.searchParams.set('recovery-checkpoint', initial.checkpoint_id);
  }
  frame.src = url.href;
  frame.style.cssText = 'display:block;width:100%;height:100%;border:0;min-width:0;min-height:0';
  frame.allow = 'fullscreen; autoplay; microphone';
  frame.setAttribute('allowfullscreen', '');
  // Bind listeners before appending: early boot hello/state cannot outrun us.
  const host = new ExpressionsHost(frame, {...options, initialRecoveryBinding: initial, initialNavigationPending: true});
  container.append(frame);
  return {frame, host, dispose: () => {host.dispose(); frame.remove();}};
}
