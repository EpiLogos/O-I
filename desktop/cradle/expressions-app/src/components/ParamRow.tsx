/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CurvedSlider } from './CurvedSlider';

interface ParamRowProps {
  id?: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  decimals?: number;
  curved?: boolean;
  breakpoint?: number;
  curvePower?: number;
  title?: string;
  hardMin?: number;
  hardMax?: number;
  scale?: 'linear' | 'log';
}

export const ParamRow: React.FC<ParamRowProps> = ({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  unit = '',
  decimals = 2,
  curved = false,
  breakpoint,
  curvePower = 2.0,
  title,
  hardMin,
  hardMax,
  scale = 'linear',
}) => {
  const [inputText, setInputText] = useState(value.toFixed(decimals));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputText(value.toFixed(decimals));
    }
  }, [value, decimals, isFocused]);

  const commitValue = (valStr: string) => {
    let parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      const lower = hardMin !== undefined ? hardMin : min;
      const upper = hardMax !== undefined ? hardMax : max;
      if (lower !== undefined) parsed = Math.max(lower, parsed);
      if (upper !== undefined) parsed = Math.min(upper, parsed);
      onChange(parsed);
      setInputText(parsed.toFixed(decimals));
    } else {
      setInputText(value.toFixed(decimals));
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    commitValue(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setInputText(value.toFixed(decimals));
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-2 py-1 min-h-[26px] group"
      title={title || `${label}: ${value}`}
    >
      {/* Parameter Name on Left */}
      <span className="text-[10px] font-mono uppercase tracking-wider text-inherit opacity-70 group-hover:opacity-100 transition-opacity w-24 sm:w-28 shrink-0 truncate select-none">
        {label}
      </span>

      {/* Slider in the Middle */}
      <div className="flex-1 min-w-0 flex items-center">
        {curved && breakpoint !== undefined ? (
          <CurvedSlider
            id={id}
            value={value}
            onChange={onChange}
            minVal={min}
            maxVal={max}
            breakpoint={breakpoint}
            curvePower={curvePower}
            className="w-full h-4 cursor-pointer"
          />
        ) : scale === 'log' && min > 0 && max > min ? (
          <input
            id={id}
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round((Math.log(Math.min(max, Math.max(min, value)) / min) / Math.log(max / min)) * 1000)}
            onChange={(e) => {
              const t = parseFloat(e.target.value) / 1000;
              const v = min * Math.pow(max / min, t);
              const q = step > 0 ? Math.round(v / step) * step : v;
              onChange(parseFloat(q.toFixed(decimals)));
            }}
            className="w-full h-4 cursor-pointer"
            title="Logarithmic slider: fine control at the low end"
          />
        ) : (
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={Math.min(max, Math.max(min, value))}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-4 cursor-pointer"
          />
        )}
      </div>

      {/* Direct Numeric Input with Bounds Protection on Right */}
      <div className="w-14 shrink-0 flex items-center justify-end">
        <div className="relative flex items-center w-full">
          <input
            type="text"
            inputMode="decimal"
            value={inputText}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => setInputText(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            title={`Direct numeric entry (${hardMin ?? min} to ${hardMax ?? max})`}
            className={`w-full text-right text-[10px] font-mono py-0.5 px-1 rounded tabular-nums transition-colors outline-none ${
              isFocused
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/60 shadow-sm'
                : 'bg-transparent text-inherit opacity-85 hover:opacity-100 hover:bg-stone-500/10 border border-transparent'
            }`}
          />
          {unit && (
            <span className="pointer-events-none text-[8px] font-mono opacity-50 ml-0.5 shrink-0">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
