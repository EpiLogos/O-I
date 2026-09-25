/** Bounded, in-flight-only coordination of owner reads. This is not an index
 * or a content cache: the kernel owns retained readings. A consumer may stop
 * waiting without cancelling an equivalent read another consumer still needs.
 */
type Subscriber = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  abort?: () => void;
};
type PendingRead = {
  key: string;
  resource: string;
  run: () => Promise<unknown>;
  subscribers: Set<Subscriber>;
  started: boolean;
};
const aborted = () => new DOMException("This knowledge read was cancelled", "AbortError");

export class KnowledgeReadCoordinator {
  private readonly entries = new Map<string, PendingRead>();
  private readonly waiting: PendingRead[] = [];
  // Two distinct keys (e.g. an explicit-fresh read and an ordinary one) can
  // name the identical owner resource. Running both at once races the same
  // kernel read ticket — "latest wins" there is deliberate (a genuinely
  // newer read must supersede a stale one), but two of OUR OWN concurrent
  // requests for the same resource have no such intent; one would simply
  // supersede the other's ticket by accident of timing, superseding a read
  // that was never stale. Serialising same-resource entries here removes
  // that self-inflicted race without touching the kernel's ticket law.
  private readonly activeByResource = new Map<string, PendingRead>();
  private active = 0;
  readonly concurrency: number;
  readonly maxWaiting: number;

  constructor(concurrency = 4, maxWaiting = 128) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(maxWaiting) || maxWaiting < 1) {
      throw new Error("Knowledge read limits must be positive integers");
    }
    this.concurrency = concurrency;
    this.maxWaiting = maxWaiting;
  }

  /** `resource` identifies the same owner reading across differently-keyed
   * requests (e.g. fresh vs cached) for it; it defaults to `key`, so a caller
   * that never distinguishes resource identity keeps exactly today's
   * behaviour. */
  read<T>(key: string, run: () => Promise<T>, signal?: AbortSignal, resource: string = key): Promise<T> {
    if (signal?.aborted) return Promise.reject(aborted());
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.waiting.length >= this.maxWaiting) return Promise.reject(new Error("Knowledge read queue is full; retry the requested reading"));
      entry = {key, resource, run, subscribers: new Set(), started: false};
      this.entries.set(key, entry);
      this.waiting.push(entry);
    }
    const held = entry;
    const promise = new Promise<T>((resolve, reject) => {
      const subscriber: Subscriber = {resolve: value => resolve(value as T), reject, signal};
      subscriber.abort = () => {
        held.subscribers.delete(subscriber);
        signal?.removeEventListener("abort", subscriber.abort!);
        reject(aborted());
        if (!held.started && held.subscribers.size === 0) {
          this.entries.delete(held.key);
          const index = this.waiting.indexOf(held);
          if (index >= 0) this.waiting.splice(index, 1);
        }
        this.drain();
      };
      held.subscribers.add(subscriber);
      signal?.addEventListener("abort", subscriber.abort, {once: true});
    });
    this.drain();
    return promise;
  }

  private drain(): void {
    let index = 0;
    while (this.active < this.concurrency && index < this.waiting.length) {
      const entry = this.waiting[index];
      if (!entry.subscribers.size) { this.entries.delete(entry.key); this.waiting.splice(index, 1); continue; }
      // A same-resource entry already running: leave this one queued and
      // look further down the queue rather than blocking unrelated resources.
      if (this.activeByResource.has(entry.resource)) { index++; continue; }
      this.waiting.splice(index, 1);
      entry.started = true;
      this.activeByResource.set(entry.resource, entry);
      ++this.active;
      // A synchronous transport failure follows the same cleanup path.
      void Promise.resolve().then(entry.run).then(
        value => this.finish(entry, true, value),
        error => this.finish(entry, false, error),
      );
    }
  }

  private finish(entry: PendingRead, fulfilled: boolean, value: unknown): void {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
    if (this.activeByResource.get(entry.resource) === entry) this.activeByResource.delete(entry.resource);
    --this.active;
    for (const subscriber of entry.subscribers) {
      if (subscriber.abort) subscriber.signal?.removeEventListener("abort", subscriber.abort);
      if (fulfilled) subscriber.resolve(value); else subscriber.reject(value);
    }
    entry.subscribers.clear();
    this.drain();
  }

  /** Counters describe queue occupancy, never source completeness. */
  inspect(): {active: number; waiting: number; distinct: number} {
    return {active: this.active, waiting: this.waiting.length, distinct: this.entries.size};
  }
}
