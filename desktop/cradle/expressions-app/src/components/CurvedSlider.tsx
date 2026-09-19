/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';

interface CurvedSliderProps {
  id?: string;
  value: number;
  onChange: (val: number) => void;
  minVal?: number;       // Lowest allowed value (e.g. 0.1)
  breakpoint?: number;   // Value where fine range ends and curve begins (e.g. 3.0)
  maxVal?: number;       // Upper bound value (e.g. 25.0)
  splitPercent?: number; // Percentage of slider travel allocated to minVal..breakpoint (e.g. 65%)
  curvePower?: number;   // Exponent for the upward curve after breakpoint (e.g. 2.2)
  className?: string;
}

/**
 * CurvedSlider maps the 0-100 linear slider track non-linearly:
 * - 0% to splitPercent (default 65%) gives high-precision linear control over the critical range [minVal, breakpoint] (e.g. 0.1px to 3.0px)
 * - splitPercent to 100% smoothly curves up to maxVal using an exponential power curve
 */
export const CurvedSlider: React.FC<CurvedSliderProps> = ({
  id,
  value,
  onChange,
  minVal = 0.1,
  breakpoint = 3.0,
  maxVal = 25.0,
  splitPercent = 65,
  curvePower = 2.2,
  className = 'w-full accent-current cursor-pointer',
}) => {
  // Convert real value to slider position (0 - 100)
  const sliderPosition = useMemo(() => {
    const clamped = Math.max(minVal, Math.min(maxVal, value));
    if (clamped <= breakpoint) {
      const ratio = (clamped - minVal) / Math.max(0.001, breakpoint - minVal);
      return Math.max(0, Math.min(splitPercent, ratio * splitPercent));
    } else {
      const ratio = (clamped - breakpoint) / Math.max(0.001, maxVal - breakpoint);
      const curvedRatio = Math.pow(Math.max(0, ratio), 1 / curvePower);
      return Math.max(splitPercent, Math.min(100, splitPercent + curvedRatio * (100 - splitPercent)));
    }
  }, [value, minVal, breakpoint, maxVal, splitPercent, curvePower]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = parseFloat(e.target.value);
    let computedVal: number;

    if (pos <= splitPercent) {
      const ratio = pos / splitPercent;
      computedVal = minVal + ratio * (breakpoint - minVal);
      // High precision in the 0..3 range (round to 2 decimals)
      computedVal = Math.round(computedVal * 100) / 100;
    } else {
      const ratio = (pos - splitPercent) / (100 - splitPercent);
      computedVal = breakpoint + Math.pow(Math.max(0, ratio), curvePower) * (maxVal - breakpoint);
      // 1-2 decimals for higher range
      computedVal = Math.round(computedVal * 50) / 50;
    }

    onChange(Math.max(minVal, Math.min(maxVal, computedVal)));
  };

  return (
    <input
      id={id}
      type="range"
      min={0}
      max={100}
      step={0.1}
      value={sliderPosition}
      onChange={handleSliderChange}
      className={className}
      title={`Current: ${value.toFixed(2)}px (0–65% covers fine ${minVal}–${breakpoint}px range)`}
    />
  );
};
