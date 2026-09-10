type Piece = 'all' | 'braces' | 'ring' | 'colon' | 'bar';

/**
 * The O:I mark drawn as pure outline — black edges, transparent body —
 * so a moving field behind it shows through the interior.
 */
export function ShellMark({ piece = 'all', className }: { piece?: Piece; className?: string }) {
  const on = (p: Piece) => piece === 'all' || piece === p;

  return (
    <svg viewBox="0 0 720 280" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      {on('braces') ? (
        <g strokeWidth="28" strokeLinecap="square">
          <path d="M161 22c-35 28-28 69-47 91-8 9-17 14-31 17 14 3 23 8 31 17 19 22 12 63 47 91" />
          <path d="M559 22c35 28 28 69 47 91 8 9 17 14 31 17-14 3-23 8-31 17-19 22-12 63-47 91" />
        </g>
      ) : null}

      {on('ring') ? <circle cx="296" cy="140" r="82" strokeWidth="28" /> : null}

      {on('colon') ? (
        <g strokeWidth="12">
          <circle cx="435" cy="98" r="16" />
          <circle cx="435" cy="182" r="16" />
        </g>
      ) : null}

      {on('bar') ? <rect x="476" y="58" width="24" height="164" strokeWidth="12" /> : null}
    </svg>
  );
}
