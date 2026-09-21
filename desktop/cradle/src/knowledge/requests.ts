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
  run: () => Promise<unknown>;
  subscribers: Set<Subscriber>;
  started: boolean;
};
const aborted = () => new DOMException("This knowledge read was cancelled", "AbortError");

export class KnowledgeReadCoordinator {
  private readonly entries = new Map<string, PendingRead>();
  private readonly waiting: PendingRead[] = [];
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

  read<T>(key: string, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(aborted());
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.waiting.length >= this.maxWaiting) return Promise.reject(new Error("Knowledge read queue is full; retry the requested reading"));
      entry = {key, run, subscribers: new Set(), started: false};
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
    while (this.active < this.concurrency && this.waiting.length) {
      const entry = this.waiting.shift()!;
      if (!entry.subscribers.size) { this.entries.delete(entry.key); continue; }
      entry.started = true;
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
