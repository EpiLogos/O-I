import 'react';

// The adopted native time-window editor uses the browser's Popover API.
// React 18's installed declarations predate that HTML attribute.
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    popover?: '' | 'auto' | 'manual';
  }
}
