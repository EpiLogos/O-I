import { useEffect, useState } from 'react';
import './self-other-portal.css';

type ProvenanceEntry = {
  kind: string;
  ref: string;
  source_system: string;
  revision?: string;
};

type Participant = {
  schema: 'oi.participant/v1';
  participant_ref: string;
  field_ref: string;
  identity: {
    kind: 'human' | 'agent';
    ref: string;
  };
  presentation?: {
    chosen_name?: string;
  };
  provenance: {
    source_system: string;
    source_revision: string;
    source_ref?: string;
  };
};

type SharedField = {
  schema: 'oi.shared-field/v1';
  field_ref: string;
  kind: string;
  visibility: string;
  title?: string;
  provenance: ProvenanceEntry[];
};

type SelfOtherDemo = {
  schema: 'oi.self-other-demo/v1';
  field: SharedField;
  self: Participant;
  other: Participant;
};

type Position = 'self' | 'other';

function participantName(participant: Participant) {
  return participant.presentation?.chosen_name ?? participant.identity.ref;
}

export function SelfOtherPortal() {
  const [data, setData] = useState<SelfOtherDemo | null>(null);
  const [position, setPosition] = useState<Position>('self');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`${import.meta.env.BASE_URL}data/self-other-demo.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Self/Other fixture returned ${response.status}`);
        return response.json() as Promise<SelfOtherDemo>;
      })
      .then((value) => {
        if (active) setData(value);
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
      <div className="border-t border-current/20 py-8 text-sm uppercase tracking-[0.16em]" role="status">
        Shared-field projection unavailable.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border-t border-current/20 py-8 text-sm uppercase tracking-[0.16em]" role="status">
        Resolving shared field…
      </div>
    );
  }

  const selected = data[position];

  return (
    <div
      className="self-other-portal"
      data-oi-surface="self-other"
      data-oi-state={position}
      data-oi-field-ref={data.field.field_ref}
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
          <div className="self-other-portal__name">{participantName(selected)}</div>
          <div className="self-other-portal__kind">{selected.identity.kind}</div>
        </div>

        <dl className="self-other-portal__meta">
          <div>
            <dt>Identity</dt>
            <dd>{selected.identity.ref}</dd>
          </div>
          <div>
            <dt>Participant</dt>
            <dd>{selected.participant_ref}</dd>
          </div>
          <div>
            <dt>Field</dt>
            <dd>{data.field.title ?? data.field.field_ref}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {selected.provenance.source_system} · {selected.provenance.source_revision}
            </dd>
          </div>
        </dl>
      </div>

      <p className="self-other-portal__note">
        The field relates these positions without owning either identity. Switch sides; the relation stays the same.
      </p>
    </div>
  );
}
