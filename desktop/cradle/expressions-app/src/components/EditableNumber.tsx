/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';

interface EditableNumberProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  unit?: string;
  className?: string;
  isLight?: boolean;
}

export const EditableNumber: React.FC<EditableNumberProps> = ({
  value,
  onChange,
  min,
  max,
  precision = 2,
  unit = '',
  className = '',
  isLight = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      setInputValue(String(value));
      setTimeout(() => inputRef.current?.select(), 20);
    }
  }, [isEditing, value]);

  const commitValue = () => {
    let parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      // Bounds protection: typed values are clamped to the declared limits
      if (typeof min === 'number') parsed = Math.max(min, parsed);
      if (typeof max === 'number') parsed = Math.min(max, parsed);
      onChange(parsed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="any"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={commitValue}
        onKeyDown={handleKeyDown}
        className={`w-20 px-1 py-0.5 text-right text-xs font-mono rounded border outline-none ${
          isLight
            ? 'bg-white border-stone-400 text-stone-900 shadow-xs'
            : 'bg-zinc-800 border-zinc-500 text-white shadow-xs'
        }`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title={`Click to type exact value${typeof min === "number" || typeof max === "number" ? ` (${min ?? "-∞"} to ${max ?? "∞"})` : ""}`}
      className={`font-mono text-xs cursor-text hover:underline transition-all ${className}`}
    >
      {value.toFixed(precision)}
      {unit}
    </button>
  );
};
