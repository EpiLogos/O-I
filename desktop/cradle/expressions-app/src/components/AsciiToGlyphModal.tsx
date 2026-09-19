/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, X, Sparkles, RefreshCw, Copy } from 'lucide-react';
import { AsciiGlyphConfig } from '../engine/types';

export interface AsciiToGlyphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBakeAscii: (text: string, options: Partial<AsciiGlyphConfig>) => void;
  isLight: boolean;
}

const SAMPLE_ASCII: Record<string, string> = {
  torus: `
      .---.
    .'     '.
   /         \\
  |     _     |
  |    (_)    |
  |           |
   \\         /
    '.     .'
      '---'
  `.trim(),
  yantra: `
      /\\
     /  \\
    /    \\
   /______\\
   \\      /
    \\    /
     \\  /
      \\/
  `.trim(),
  sigil: `
    .:::.   .:::.
   :::::::.:::::::
   :::::::::::::::
   ':::::::::::::'
     ':::::::::'
       ':::::'
         ':'
  `.trim(),
  omega: `
     .-----.
   .'       '.
  /           \\
  |   .---.   |
  \\   |   |   /
   '--'   '--'
  `.trim(),
};

export const AsciiToGlyphModal: React.FC<AsciiToGlyphModalProps> = ({
  isOpen,
  onClose,
  onBakeAscii,
  isLight,
}) => {
  const [text, setText] = useState<string>(SAMPLE_ASCII.torus);
  const [fontFamily, setFontFamily] = useState<string>('monospace');
  const [fontSize, setFontSize] = useState<number>(24);
  const [invert, setInvert] = useState<boolean>(false);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const updatePreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 240;
    const h = 240;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    if (!text.trim()) return;

    ctx.fillStyle = '#00f0ff';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const lines = text.split('\n');
    const lineHeight = fontSize * 1.15;
    const totalHeight = lines.length * lineHeight;
    const startY = (h - totalHeight) / 2 + lineHeight / 2;

    lines.forEach((line, idx) => {
      ctx.fillText(line, w / 2, startY + idx * lineHeight);
    });
  }, [text, fontFamily, fontSize, invert]);

  useEffect(() => {
    if (isOpen) {
      updatePreview();
    }
  }, [isOpen, updatePreview]);

  const handleApply = () => {
    if (!text.trim()) return;
    onBakeAscii(text, {
      fontFamily,
      fontSize,
      invert,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="ascii-glyph-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="ascii-glyph-modal-window"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl rounded-2xl border shadow-2xl p-5 flex flex-col font-mono text-xs ${
          isLight
            ? 'bg-white border-stone-200 text-stone-900 shadow-stone-400/30'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-inherit">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <h2 className="font-bold uppercase tracking-wider text-sm">
              ASCII Art to Point-Cloud Rasterizer
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-stone-500/10 transition-colors"
          >
            <X className="w-4 h-4 opacity-70" />
          </button>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-1.5 my-3 overflow-x-auto pb-1">
          <span className="opacity-50 text-[10px] uppercase shrink-0 font-semibold">
            Presets:
          </span>
          {Object.keys(SAMPLE_ASCII).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setText(SAMPLE_ASCII[key])}
              className="px-2 py-0.5 rounded border border-inherit text-[10px] uppercase opacity-75 hover:opacity-100 hover:bg-stone-500/10 transition-all shrink-0"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Left: Textarea */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase opacity-60 font-semibold">
              ASCII Input Canvas:
            </span>
            <textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type ASCII art here..."
              className={`w-full p-2.5 rounded-xl border font-mono text-[11px] leading-tight outline-none resize-none shadow-inner ${
                isLight
                  ? 'bg-stone-50 border-stone-300 text-stone-900'
                  : 'bg-black border-zinc-700 text-cyan-300'
              }`}
            />
          </div>

          {/* Right: Preview & Controls */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase opacity-60 font-semibold self-start mb-2">
              Rasterized Target Preview:
            </span>
            <div className="relative rounded-xl overflow-hidden border border-inherit bg-black flex items-center justify-center w-full h-40 shadow-inner">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Font size slider */}
            <div className="w-full mt-3">
              <div className="flex justify-between text-[10px] opacity-70 mb-0.5">
                <span>Font Size</span>
                <span className="font-bold">{fontSize}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={56}
                step={2}
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                className="w-full accent-purple-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-inherit mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-inherit opacity-70 hover:opacity-100 uppercase tracking-wider text-[10px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!text.trim()}
            className={`px-5 py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 transition-all shadow-md ${
              isLight
                ? 'bg-stone-900 text-white hover:bg-black'
                : 'bg-white text-zinc-950 hover:bg-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Bake ASCII to Simulation Targets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
