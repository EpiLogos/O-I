import type {ExpressionResult} from '../expression/types';

/** Transport success is not native-operation success. Keep an acknowledged
 * effect distinct from a refusal, especially when independent readback fails. */
export class ExpressionOperationFailure extends Error {
  readonly state: string;
  readonly persisted: boolean | undefined;
  readonly operation: string;
  readonly result: ExpressionResult;
  constructor(operation: string, result: ExpressionResult) {
    const state = result.state ?? 'invalid_result';
    const failure = result.failure as {message?: unknown; detail?: unknown} | undefined;
    const nested = result.data as {error?: {message?: unknown}; detail?: unknown} | undefined;
    const detail = [result.error, failure?.message, failure?.detail, result.detail, nested?.error?.message, nested?.detail]
      .find((value): value is string => typeof value === 'string' && value.length > 0);
    const recovery = result.persisted === true
      ? ' The owner reports a saved effect. Inspect its native file before any retry.'
      : state.includes('conflict') ? ' Inspect the current revision; the pending intent has not been rebased.' : '';
    // Expose the explicit owner operation, never the entire source-bearing result.
    const owner = typeof result.owner_operation === 'string' && result.owner_operation ? ` (${result.owner_operation})` : '';
    super(`${operation}${owner}: ${detail ?? state.replaceAll('_', ' ')}.${recovery}`);
    this.name = 'ExpressionOperationFailure';
    this.operation = operation;
    this.result = result;
    this.state = state;
    this.persisted = typeof result.persisted === 'boolean' ? result.persisted : undefined;
  }
}

export function requireExpressionOutcome(result: ExpressionResult, operation: string): void {
  if (!result || typeof result !== 'object') throw new Error(`${operation}: the Expression owner returned no result.`);
  const state = result.state;
  if (state && (state.endsWith('_conflict') || state.endsWith('_refused') || state.endsWith('_failed') || state.endsWith('_unavailable'))) {
    throw new ExpressionOperationFailure(operation, result);
  }
}
