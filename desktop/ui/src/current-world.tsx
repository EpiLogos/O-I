export type CurrentWorldPosition = {
  position: number;
  product_id: string;
  public_name: string;
  native_owner: string;
  state: 'missing' | 'installed' | 'registered' | 'broken';
  present: boolean;
  native_location?: string;
  version?: string;
};

export type CurrentWorldReading = {
  schema: string;
  personal_ground?: string;
  current_machine?: {
    role: string;
    central_source?: string;
    workcell_ref?: string;
    health?: string;
  };
  positions: CurrentWorldPosition[];
  context_frame: {
    reading?: string;
    maximal: boolean;
    present_positions: number[];
  };
  warnings: string[];
};

export function CurrentWorldNavigator({ currentWorld }: { currentWorld?: CurrentWorldReading }) {
  const machine = currentWorld?.current_machine;
  const frame = currentWorld?.context_frame;
  const frameLabel = frame?.maximal && frame.reading === 'cf5'
    ? 'CF5 · positions 0–5 present'
    : `positions ${frame?.present_positions.join(' · ') || 'none'}`;

  return (
    <section className="oi-project-nav" aria-label="Current Central world and Machines">
      <header className="oi-project-nav__header">
        <div>
          <p className="oi-eyebrow">Current world</p>
          <strong>{currentWorld?.personal_ground ?? 'Central ground unavailable'}</strong>
        </div>
      </header>
      <div className="oi-workbench__relations">
        <strong>Constitution</strong>
        <span>{currentWorld ? frameLabel : 'No native CurrentWorld reading disclosed'}</span>
      </div>
      <div className="oi-workbench__relations">
        <strong>Machines</strong>
        {machine ? (
          <>
            <span><code>{machine.role}</code> · {machine.central_source ?? 'Central source unresolved'}</span>
            <span>
              <code>{machine.role}</code> ↔ <code>{machine.workcell_ref ?? 'Workcell unresolved'}</code>
              {machine.health ? ` · ${machine.health}` : ''}
            </span>
          </>
        ) : (
          <span className="oi-project-nav__quiet">No current Central machine relation is disclosed.</span>
        )}
      </div>
    </section>
  );
}
