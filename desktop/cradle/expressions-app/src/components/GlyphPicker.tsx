/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GLYPH_CATEGORIES } from '../engine/glyphLibrary';

export interface GlyphPickerProps {
  onPick: (char: string) => void;
  isLight: boolean;
  /** Smaller grid, fewer rows visible — used inline inside sequence link rows. */
  compact?: boolean;
}

/**
 * Symbol category picker harvested from ChainingPanel's glyph library. Pure picker: clicking
 * a glyph calls onPick(char) and the caller decides whether that commits a shape or appends
 * a sequence link.
 */
export const GlyphPicker: React.FC<GlyphPickerProps> = ({ onPick, isLight, compact }) => {
  const [categoryId, setCategoryId] = useState<string>(GLYPH_CATEGORIES[0].id);
  const category = GLYPH_CATEGORIES.find((c) => c.id === categoryId) ?? GLYPH_CATEGORIES[0];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
        {GLYPH_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`px-2 py-0.5 text-[8.5px] font-mono whitespace-nowrap rounded-full border transition-all ${
              categoryId === c.id
                ? isLight
                  ? 'bg-stone-900 text-white font-bold border-stone-900'
                  : 'bg-white text-zinc-950 font-bold border-white'
                : isLight
                ? 'border-stone-200 text-stone-600 hover:bg-stone-100'
                : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            {c.name.split(' ')[0]}
          </button>
        ))}
      </div>
      <div
        className={`grid grid-cols-6 gap-1 overflow-y-auto pr-1 ${compact ? 'max-h-[96px]' : 'max-h-[160px]'}`}
      >
        {category.items.map((item) => (
          <button
            key={item.char}
            type="button"
            onClick={() => onPick(item.char)}
            title={`${item.name} (${item.char})`}
            className={`flex flex-col items-center justify-center h-9 rounded border transition-all ${
              isLight
                ? 'bg-white hover:bg-stone-100 border-stone-200 text-stone-900 hover:scale-105'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-100 hover:scale-105'
            }`}
          >
            <span className="text-sm font-bold leading-none">{item.char}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
