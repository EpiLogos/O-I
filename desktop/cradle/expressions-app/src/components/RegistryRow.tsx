/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ParamRow } from './ParamRow';
import { PointCloudConfig } from '../engine/types';
import { getParamDef } from '../engine/paramRegistry';
import { readPath, writePath } from '../engine/automation';

interface RegistryRowProps {
  path: string;
  config: PointCloudConfig;
  onChange: (partial: Partial<PointCloudConfig>) => void;
  label?: string;
  /** Live (automated) value to display next to the slider */
  live?: number;
}

/**
 * A ParamRow bound to a registered parameter path: ranges, step, unit and label
 * come from the registry so the inspector and the automation system agree.
 */
export const RegistryRow: React.FC<RegistryRowProps> = ({ path, config, onChange, label, live }) => {
  const def = getParamDef(path);
  if (!def) return null;
  const raw = readPath(config, path);
  const value = typeof raw === 'number' ? raw : 0;
  return (
    <ParamRow
      label={label ?? def.label}
      value={value}
      onChange={(v) => {
        const next = writePath(config, path, v);
        // Emit only the top-level slice that changed so callers can shallow-merge
        const top = path.split('.')[0] as keyof PointCloudConfig;
        onChange({ [top]: (next as any)[top] } as Partial<PointCloudConfig>);
      }}
      min={def.min}
      max={def.max}
      hardMin={def.hardMin}
      hardMax={def.hardMax}
      step={def.step}
      decimals={def.decimals ?? 2}
      unit={def.unit}
      scale={def.scale}
      title={live !== undefined ? `${def.label} · automated → ${live.toFixed(def.decimals ?? 2)}` : def.hint ? `${def.label}: ${def.hint}` : undefined}
    />
  );
};
