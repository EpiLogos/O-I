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
      <path d="M210 36 360 122 210 208 60 122Z" fill="white" stroke="currentColor" strokeWidth="8" />
      <path d="M60 122 210 208v176L60 298Z" fill="white" stroke="currentColor" strokeWidth="8" />
      <path d="M210 208 360 122v176l-150 86Z" fill="currentColor" stroke="currentColor" strokeWidth="8" />
      <ellipse cx="135" cy="251" rx="42" ry="61" fill="currentColor" />
      <rect x="291" y="198" width="22" height="112" fill="white" />
      <rect x="252" y="211" width="22" height="22" fill="white" />
      <rect x="252" y="275" width="22" height="22" fill="white" />
    </svg>
  );
}
