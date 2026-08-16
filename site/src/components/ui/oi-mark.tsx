import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

type MarkPiece = 'all' | 'braces' | 'ring' | 'colon' | 'bar';

type OIMarkProps = SVGProps<SVGSVGElement> & {
  piece?: MarkPiece;
  braces?: boolean;
};

export function OIMark({
  piece = 'all',
  braces = true,
  className,
  ...props
}: OIMarkProps) {
  const show = (name: Exclude<MarkPiece, 'all'>) => piece === 'all' || piece === name;

  return (
    <svg
      viewBox="0 0 720 280"
      role="img"
      aria-label="O:I"
      className={cn('block h-auto w-full', className)}
      {...props}
    >
      {braces && show('braces') ? (
        <g fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="28">
          <path d="M161 22c-35 28-28 69-47 91-8 9-17 14-31 17 14 3 23 8 31 17 19 22 12 63 47 91" />
          <path d="M559 22c35 28 28 69 47 91 8 9 17 14 31 17-14 3-23 8-31 17-19 22-12 63-47 91" />
        </g>
      ) : null}

      {show('ring') ? (
        <circle cx="296" cy="140" r="82" fill="none" stroke="currentColor" strokeWidth="28" />
      ) : null}

      {show('colon') ? (
        <g fill="currentColor">
          <circle cx="435" cy="98" r="16" />
          <circle cx="435" cy="182" r="16" />
        </g>
      ) : null}

      {show('bar') ? <rect x="508" y="58" width="30" height="164" fill="currentColor" /> : null}
    </svg>
  );
}

export function OIGlyph(props: Omit<OIMarkProps, 'braces'>) {
  return <OIMark braces={false} {...props} />;
}
