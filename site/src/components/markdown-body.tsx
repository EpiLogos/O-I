import type { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const tokenPattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(tokenPattern).filter(Boolean);

  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2];
      const external = href.startsWith('http');
      return (
        <a key={`${index}-${part}`} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
          {link[1]}
        </a>
      );
    }

    const strong = part.match(/^\*\*(.+)\*\*$/);
    if (strong) {
      return <strong key={`${index}-${part}`}>{strong[1]}</strong>;
    }

    const code = part.match(/^`(.+)`$/);
    if (code) {
      return <code key={`${index}-${part}`}>{code[1]}</code>;
    }

    return part;
  });
}

export function MarkdownBody({ source, className = '' }: { source: string; className?: string }) {
  const blocks = source
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const lines = block.split(/\r?\n/).map((line) => line.trim());
        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={`list-${index}`}>
              {lines.map((line) => (
                <li key={line}>{renderInline(line.slice(2))}</li>
              ))}
            </ul>
          );
        }

        return <p key={`paragraph-${index}`}>{renderInline(lines.join(' '))}</p>;
      })}
    </div>
  );
}
