const DEVELOPMENTS: Array<{ term: string; gloss: string }> = [
  { term: 'Projects and continuity', gloss: 'work that persists across sessions' },
  { term: 'Knowledge and sources', gloss: 'a world that can cite itself' },
  { term: 'Skills, tools and actions', gloss: 'a disclosed capability field' },
  { term: 'Agents and agencies', gloss: 'differentiated, delegated agency' },
  { term: 'Developmental history', gloss: 'evidence, decisions, return' },
  { term: 'Material execution worlds', gloss: 'environments that really run' },
  { term: 'Formal experiment', gloss: 'propositions made testable' },
  { term: 'Shared fields', gloss: 'encounter with other worlds' },
];

/**
 * Minimal -> maximal field. The smallest O:I (persistent ground + actuated
 * capacity) drawn as a complete relation, with the wider field opening
 * outward as optional development rather than product tiers.
 */
export function PossibilityField() {
  return (
    <div className="field-map" role="img" aria-label="The minimal O:I — persistent authored ground plus actuated model capacity — can develop into projects, knowledge, capabilities, agents, developmental history, material worlds, formal experiment, and shared fields.">
      <div className="field-map__core">
        <span className="field-map__core-label">The smallest O:I — already complete</span>
        <div className="field-map__pair">
          <span>Persistent authored ground</span>
          <span className="field-map__plus" aria-hidden="true">+</span>
          <span>Actuated model capacity</span>
        </div>
        <span className="field-map__core-note">a directory and an agent that can work in it</span>
      </div>
      <div className="field-map__developments">
        <span className="field-map__developments-label">can develop into</span>
        <ul>
          {DEVELOPMENTS.map((item) => (
            <li key={item.term}>
              <strong>{item.term}</strong>
              <span>{item.gloss}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
