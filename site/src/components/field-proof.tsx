import { useEffect, useState } from 'react';
// @ts-ignore -- tested JS adapter over canonical shared-field contracts.
import { fieldProofViewModel } from '../../field-proof-read-model.mjs';
import './field-proof.css';

type ContributionView = {
  ref: string;
  mode: string;
  relation: string;
  contributor: string;
  target_ref: string;
  target_kind: string;
  text: string;
  source: string;
};

type FieldProofView = {
  projection: {
    ref: string;
    revision: number;
    subject_kind: string;
    title: string;
    description: string;
    source: string;
  };
  encounter: {
    ref: string;
    mediation: string;
  };
  contributions: ContributionView[];
};

export function FieldProof() {
  const [data, setData] = useState<FieldProofView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`${import.meta.env.BASE_URL}data/field-proof-demo.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Field proof fixture returned ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        const view = fieldProofViewModel(value) as FieldProofView;
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
      <div className="field-proof__status" role="status">
        Object relation proof unavailable.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="field-proof__status" role="status">
        Resolving object relation…
      </div>
    );
  }

  return (
    <div className="field-proof" data-oi-surface="field-proof" data-oi-projection-ref={data.projection.ref}>
      <header className="field-proof__projection">
        <div>
          <div className="field-proof__label">Encountered object</div>
          <h4>{data.projection.title}</h4>
          <p>{data.projection.description}</p>
        </div>
        <dl className="field-proof__meta">
          <div>
            <dt>Kind</dt>
            <dd>{data.projection.subject_kind}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{data.projection.source}</dd>
          </div>
          <div>
            <dt>Projection</dt>
            <dd>
              {data.projection.ref} · r{data.projection.revision}
            </dd>
          </div>
          <div>
            <dt>Encounter</dt>
            <dd>{data.encounter.mediation}</dd>
          </div>
        </dl>
      </header>

      <div className="field-proof__chain" aria-label="Contribution relation chain">
        {data.contributions.map((contribution, index) => (
          <article key={contribution.ref} className="field-proof__contribution">
            <div className="field-proof__step">0{index + 1}</div>
            <div>
              <div className="field-proof__label">
                {contribution.mode} · {contribution.relation}
              </div>
              <p>{contribution.text}</p>
              <div className="field-proof__trace">
                <span>{contribution.contributor}</span>
                <span>→ {contribution.target_kind}</span>
                <span>{contribution.source}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="field-proof__note">
        One Projection can receive an attributable difference; that difference can itself become the addressable target
        of another Contribution.
      </p>
    </div>
  );
}
