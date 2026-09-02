import React from 'react';
import {
  initialParticipantComposerState,
  participantAddressFromComposer,
  participantComposerTransition,
  visibleParticipantCandidates,
} from './participant-composer-model.mjs';
import type {
  ParticipantAddress,
  ParticipantComposerEvent,
  ParticipantComposerState,
  ParticipantTarget,
} from './participant-composer-model.mjs';
import './participant-composer.css';

export type { ParticipantAddress, ParticipantTarget } from './participant-composer-model.mjs';

/**
 * Conversation-shaped participant composition over stable native refs.
 *
 * Search/open/highlight/chip placement are local presentation state. The emitted
 * value is only `aikit.participant-address/v1`; no membership, invocation,
 * authority or Attention state is inferred from selection.
 */
export function ParticipantComposer({
  candidates,
  channel = 'to',
  label = channel === 'to' ? 'To:' : '@',
  onChange,
}: {
  candidates: ParticipantTarget[];
  channel?: 'to' | 'mention';
  label?: string;
  onChange?: (address: ParticipantAddress) => void;
}) {
  const [state, setState] = React.useState<ParticipantComposerState>(() => initialParticipantComposerState());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const visible = React.useMemo(() => visibleParticipantCandidates(state, candidates), [state, candidates]);
  const selected = channel === 'to' ? state.to : state.mentions;

  const transition = React.useCallback((event: ParticipantComposerEvent) => {
    setState((current) => {
      const next = participantComposerTransition(current, event, candidates);
      onChange?.(participantAddressFromComposer(next));
      return next;
    });
  }, [candidates, onChange]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      transition({ type: 'arrow-down' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      transition({ type: 'arrow-up' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      transition({ type: 'select-highlighted', channel });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      transition({ type: 'escape' });
    } else if (event.key === 'Backspace' && state.query === '') {
      transition({ type: 'backspace' });
    }
  }

  return (
    <div className="oi-participant-composer" data-channel={channel}>
      <div className="oi-participant-composer__field" onClick={() => inputRef.current?.focus()}>
        <strong>{label}</strong>
        <div className="oi-participant-composer__chips">
          {selected.map((target) => (
            <button
              type="button"
              className="oi-participant-composer__chip"
              key={`${target.kind}:${target.participant}:${target.address}`}
              onClick={(event) => {
                event.stopPropagation();
                transition({ type: 'remove', target });
              }}
              title={`Remove ${target.address}`}
            >
              <span>{target.address}</span>
              <small>{target.kind}</small>
              <span aria-hidden>×</span>
            </button>
          ))}
          <input
            ref={inputRef}
            value={state.query}
            aria-label={`${label} participant search`}
            placeholder={selected.length ? 'Add…' : 'Human, Agent or AgentSet'}
            onFocus={() => transition({ type: 'open' })}
            onChange={(event) => transition({ type: 'query', value: event.target.value })}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>

      {state.open && (
        <div className="oi-participant-composer__popover" role="listbox" aria-label="Participant candidates">
          {visible.length === 0 ? (
            <p>No eligible participant targets are currently disclosed.</p>
          ) : visible.map((target, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === state.highlighted}
              data-highlighted={index === state.highlighted}
              key={`${target.kind}:${target.participant}:${target.address}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => transition({ type: 'select', target, channel })}
            >
              <span>
                <strong>{target.address}</strong>
                <small>{target.kind}</small>
              </span>
              <code>{target.participant}</code>
            </button>
          ))}
          <footer>
            <span>↑↓ choose · Enter add · Esc close</span>
            <span>addressing ≠ invocation ≠ authority</span>
          </footer>
        </div>
      )}
    </div>
  );
}
