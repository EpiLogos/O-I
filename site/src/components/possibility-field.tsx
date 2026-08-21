import { getChild, getList, getSection } from '@/lib/public-content';

function parseDevelopment(item: string) {
  const match = item.match(/^\*\*(.+?)\*\*\s+—\s+(.+)$/);
  if (!match) return { term: item, gloss: '' };
  return { term: match[1], gloss: match[2] };
}

/**
 * Minimal -> developed field. Public wording comes from the home/field section
 * of site/content/public-site.md; this component owns only the visual relation.
 */
export function PossibilityField() {
  const field = getSection('home', 'field');
  const ground = getChild(field, 'ground').title;
  const capacity = getChild(field, 'capacity').title;
  const coreNote = getChild(field, 'core-note').title;
  const developments = getList(getChild(field, 'developments')).map(parseDevelopment);

  return (
    <div
      className="field-map"
      role="img"
      aria-label={`${ground} plus ${capacity}. ${coreNote} It can develop into ${developments.map((item) => item.term).join(', ')}.`}
    >
      <div className="field-map__core">
        <span className="field-map__core-label">The smallest O:I — already complete</span>
        <div className="field-map__pair">
          <span>{ground}</span>
          <span className="field-map__plus" aria-hidden="true">+</span>
          <span>{capacity}</span>
        </div>
        <span className="field-map__core-note">{coreNote}</span>
      </div>
      <div className="field-map__developments">
        <span className="field-map__developments-label">{getChild(field, 'developments').title}</span>
        <ul>
          {developments.map((item) => (
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
