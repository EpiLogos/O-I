import React from 'react';
import {createRoot} from 'react-dom/client';
import {TextEditor} from '../src/editor/TextEditor';
import '@epilogos/oi-design-system/tokens.css';

// A real editable source surface; the browser owns only the document input
// and observations, with no kernel or owner-operation substitutes.
const root = createRoot(document.getElementById('root')!);
window.editorAppearance = {
  changes: [],
  render(text: string, filename: string) {
    root.render(<TextEditor
      value={text}
      filename={filename}
      aria-label="Source text"
      binding={{id: 'appearance-source', kind: 'source', title: filename}}
      onChange={next => window.editorAppearance.changes.push(next)}
    />);
  },
};
