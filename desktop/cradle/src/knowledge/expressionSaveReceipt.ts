import type {CentralLocation} from '../kernel/types';
import type {ExpressionResult} from '../expression/types';
import {ExpressionOperationFailure, requireExpressionOutcome} from './expressionOutcome';

export interface SavedExpressionReceipt extends ExpressionResult {
  state: 'saved';
  persisted: true;
  readback_verified: true;
  file: {location: CentralLocation; revision: string};
}

/** The shared outcome reader owns native failure interpretation. This narrower
 * error covers a nominal success whose persistence evidence is incomplete. */
export class ExpressionSaveError extends ExpressionOperationFailure {
  constructor(result: ExpressionResult) {
    super('Expression save', result);
    this.name = 'ExpressionSaveError';
    const reason = result.persisted === true
      ? 'The file write was acknowledged, but its readback is not verified.'
      : 'The save returned no complete native persistence receipt.';
    this.message = `${reason} ${this.message} The exact operation is retained; inspect the destination before retrying.`;
  }
}

/** A file location/ref/revision is part of success, not optional UI metadata.
 * Native refusal uses the existing shared gate rather than another classifier. */
export function requireSavedExpression(result: ExpressionResult): asserts result is SavedExpressionReceipt {
  requireExpressionOutcome(result, 'Expression save');
  const file = result.file, location = file?.location;
  if (result.state !== 'saved' || result.persisted !== true || result.readback_verified !== true
    || !file || typeof file.revision !== 'string' || !file.revision
    || !location || location.schema !== 'central.path-ref/v1'
    || typeof location.ref !== 'string' || !location.ref
    || typeof location.root !== 'string' || !location.root || typeof location.path !== 'string') {
    throw new ExpressionSaveError(result);
  }
}
