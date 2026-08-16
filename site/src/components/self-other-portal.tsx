import { useEffect, useState } from 'react';
// @ts-ignore -- this is the tested JS boundary over canonical shared-field contracts.
import { selfOtherViewModel } from '../../self-other-read-model.mjs';
import { FieldProof } from './field-proof';
import './self-other-portal.css';

type PositionView = {
  name: string;
  kind: 'human' | 'agent';
  identity_ref: string;
  participant_ref: string;
  source_system: string;
  source_revision: string;
};

type SelfOtherView = {
  field: {
    ref: string;
    title: string;
    kind: string;
  };
  self: PositionView;
  other: PositionView;
};

type Position = 'self' | 'other';

export function SelfOtherPortal() {
  const [data, setData] = useState<SelfOtherView | null>(null);
  const [position, setPosition] = useState<Position>('self');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`${import.meta.env.BASE_URL}data/self-other-demo.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Self/Other fixture returned ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        const view = selfOtherViewModel(value) as SelfOtherView;
        if (active) setData(view);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="self-other-portal__status" role="status">
        Shared-field proof unavailable.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="self-other-portal__status" role="status">
        Resolving shared field…
      </div>
    );
  }

  const selected = data[position];

  return (
    <>
      <div
        className="self-other-portal"
        data-oi-surface="self-other"
        data-oi-state={position}
        data-oi-field-ref={data.field.ref}
      >
        <div className="self-other-portal__positions" role="group" aria-label="Choose a field-relative position">
          <button
            type="button"
            aria-pressed={position === 'self'}
            className="self-other-portal__position"
            onClick={() => setPosition('self')}
          >
            Self
          </button>
          <span className="self-other-portal__slash" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            aria-pressed={position === 'other'}
            className="self-other-portal__position"
            onClick={() => setPosition('other')}
          >
            Other
          </button>
        </div>

        <div className="self-other-portal__reading" aria-live="polite">
          <div>
            <div className="self-other-portal__label">{position}</div>
            <div className="self-other-portal__name">{selected.name}</div>
            <div className="self-other-portal__kind">{selected.kind}</div>
          </div>

          <dl className="self-other-portal__meta">
            <div>
              <dt>Identity</dt>
              <dd>{selected.identity_ref}</dd>
            </div>
            <div>
              <dt>Participant</dt>
              <dd>{selected.participant_ref}</dd>
            </div>
            <div>
              <dt>Field</dt>
              <dd>{data.field.title}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {selected.source_system} · {selected.source_revision}
              </dd>
            </div>
          </dl>
        </div>

        <p className="self-other-portal__note">
          Self and Other are positions in one shared relation. Identity, field and source provenance remain inspectable as
          the selected side changes.
        </p>
      </div>

      <FieldProof />
    </>
  );
}
