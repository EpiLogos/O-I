import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

export function OICube({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 420 420"
      role="img"
      aria-label="O:I cube mark"
      className={cn('block h-auto w-full', className)}
      {...props}
    >
      <path d="M210 36 360 122 210 208 60 122Z" fill="white" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
      <path d="M60 122 210 208v176L60 298Z" fill="white" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
      <path d="M210 208 360 122v176l-150 86Z" fill="currentColor" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
      <path d="M176.25 276.65 C176.25 249.92 157.78 217.66 135 204.6 112.22 191.54 93.75 202.62 93.75 229.35 93.75 256.08 112.22 288.34 135 301.4 157.78 314.46 176.25 303.38 176.25 276.65Z" fill="currentColor" />
      <g transform="translate(285, 253) skewY(-29.8) translate(-285, -253)">
        <rect x="293" y="209" width="14" height="88" fill="white" />
        <rect x="263" y="224" width="14" height="14" fill="white" />
        <rect x="263" y="268" width="14" height="14" fill="white" />
      </g>
    </svg>
  );
}
