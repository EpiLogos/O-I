import { buildWorldRecognitionModel } from './world-recognition-model.mjs';
import type { WorldRecognitionModel } from './world-recognition-model.mjs';
import './world-recognition.css';

export type WorldRecognitionAccount = {
  schema: string;
  target: string;
  observations: Array<unknown>;
  owner_participations?: Array<unknown>;
  owner_contracts?: Array<unknown>;
  owner_capacities?: Array<unknown>;
  extension_requests?: Array<unknown>;
  providers?: Array<unknown>;
  provider_errors?: Array<unknown>;
};

function StateBadge({ degraded }: { degraded: boolean }) {
  if (!degraded) return null;
  return <span className="oi-world-state" data-state="degraded">degraded</span>;
}

function BoundOwners({ owners }: { owners: string | null }) {
  if (!owners) return <span className="oi-world-quiet">no owner participation</span>;
  return <span className="oi-world-owner">{owners}</span>;
}

function SystemRows({ model }: { model: WorldRecognitionModel }) {
  return (
    <div className="oi-world__systems">
      {model.observations.map((observation) => (
        <div key={observation.observation_ref} className="oi-world__system" data-degraded={observation.degraded || undefined}>
          <div className="oi-world__system-head">
            <strong>{observation.name}</strong>
            <StateBadge degraded={observation.degraded} />
          </div>
          <div className="oi-world__system-sub">
            <span>{observation.kind_label}{observation.version ? ` · ${observation.version}` : ''}</span>
          </div>
          <div className="oi-world__system-owner">
            <BoundOwners owners={observation.owners} />
          </div>
          {observation.owner_bindings.length > 0 && (
            <div className="oi-world__bindings">
              {observation.owner_bindings.map((binding) => (
                <span key={`${observation.observation_ref}:${binding.contract}`}>
                  <code>{binding.contract}</code> · {binding.state}
                </span>
              ))}
            </div>
          )}
          {observation.facts.length > 0 && (
            <div className="oi-world__facts">
              {observation.facts.map((fact) => (
                <span key={`${observation.observation_ref}:${fact.key}`}>
                  {fact.key}: {String(fact.value)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ParticipationRows({ model }: { model: WorldRecognitionModel }) {
  if (model.participations.length === 0) {
    return <p className="oi-world-quiet">No native-owner participation is reconciled.</p>;
  }
  return (
    <div className="oi-world__list">
      {model.participations.map((participation) => (
        <div key={`${participation.owner}:${participation.contract}:${participation.system_ref}`}>
          <strong>{participation.owner}</strong>
          <span><code>{participation.contract}</code> · {participation.state}</span>
          <span className="oi-world-quiet">over {participation.system}</span>
        </div>
      ))}
    </div>
  );
}

function ContractRows({ model }: { model: WorldRecognitionModel }) {
  if (model.contracts.length === 0) return null;
  return (
    <div className="oi-world__list">
      {model.contracts.map((contract) => (
        <div key={`${contract.owner}:${contract.contract}`}>
          <strong>{contract.owner}</strong>
          <span><code>{contract.contract}</code> · {contract.field}</span>
        </div>
      ))}
    </div>
  );
}

function CapacityRows({ model }: { model: WorldRecognitionModel }) {
  if (model.capacities.length === 0) {
    return <p className="oi-world-quiet">No material capacity is disclosed.</p>;
  }
  return (
    <div className="oi-world__list">
      {model.capacities.map((capacity) => (
        <div key={capacity.capacity_ref} data-degraded={capacity.state !== 'healthy' || undefined}>
          <strong>{capacity.owner}</strong>
          <span>{capacity.ports.join(' · ') || capacity.capacity_ref}</span>
          <span className="oi-world-state" data-state={capacity.state}>{capacity.state}</span>
        </div>
      ))}
    </div>
  );
}

function FrontierRows({ model }: { model: WorldRecognitionModel }) {
  if (model.frontier.length === 0) {
    return <p className="oi-world-quiet">Every recognised system has an installed owner participation, or no supported route.</p>;
  }
  return (
    <div className="oi-world__list">
      {model.frontier.map((request) => (
        <div key={request.request_ref}>
          <strong>{request.native_system_ref}</strong>
          <span>→ {request.owner}</span>
          <span className="oi-world-quiet"><code>{request.sdk}</code></span>
        </div>
      ))}
    </div>
  );
}

function ProviderRows({ model }: { model: WorldRecognitionModel }) {
  if (model.providers.length === 0) return null;
  return (
    <div className="oi-world__list">
      {model.providers.map((provider) => (
        <div key={provider.provider_ref}>
          <strong>{provider.provider_ref}</strong>
          <span>{provider.status}</span>
          <span className="oi-world-quiet">{provider.detail}</span>
        </div>
      ))}
    </div>
  );
}

export function WorldRecognitionNavigator({
  account,
  onReobserve,
}: {
  account?: WorldRecognitionAccount;
  onReobserve?: () => void;
}) {
  const model = account ? buildWorldRecognitionModel(account) : null;

  if (!model) {
    return (
      <section className="oi-project-nav" aria-label="Reconciled World">
        <header className="oi-project-nav__header">
          <div>
            <p className="oi-eyebrow">Reconciled World</p>
            <strong className="oi-project-nav__quiet">No World account is disclosed.</strong>
          </div>
        </header>
      </section>
    );
  }

  const { summary } = model;

  return (
    <section className="oi-project-nav oi-world" aria-label="Reconciled World">
      <header className="oi-project-nav__header">
        <div>
          <p className="oi-eyebrow">Reconciled World</p>
          <strong>{summary.systems} systems · {summary.owners_participating} owners · {summary.capacities} capacities</strong>
        </div>
        {summary.degraded > 0 && (
          <span className="oi-world-state" data-state="degraded">{summary.degraded} degraded</span>
        )}
      </header>

      <button
        type="button"
        className="oi-world__reobserve"
        onClick={onReobserve}
        title="Re-observe the live World through the same discovery the host performs at startup"
      >
        Re-observe World
      </button>

      <div className="oi-workbench__relations">
        <strong>Systems</strong>
        <SystemRows model={model} />
      </div>

      <details className="oi-world__details">
        <summary>Owner participation ({model.participations.length})</summary>
        <ParticipationRows model={model} />
      </details>

      <details className="oi-world__details">
        <summary>Material capacities ({model.capacities.length})</summary>
        <CapacityRows model={model} />
      </details>

      {model.contracts.length > 0 && (
        <details className="oi-world__details">
          <summary>Owner contracts ({model.contracts.length})</summary>
          <ContractRows model={model} />
        </details>
      )}

      {model.frontier.length > 0 && (
        <details className="oi-world__details">
          <summary>Extension frontier ({model.frontier.length})</summary>
          <FrontierRows model={model} />
        </details>
      )}

      {model.provider_errors.length > 0 && (
        <details className="oi-world__details" data-state="degraded">
          <summary>Provider errors ({model.provider_errors.length})</summary>
          <div className="oi-world__list">
            {model.provider_errors.map((error, index) => <div key={index}>{error}</div>)}
          </div>
        </details>
      )}

      <div className="oi-workbench__relations">
        <strong>Target</strong>
        <span className="oi-world-quiet"><code>{model.target}</code></span>
      </div>
    </section>
  );
}
