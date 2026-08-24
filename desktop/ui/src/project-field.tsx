import React from 'react';

import {
  ProjectFieldCanvas as ProjectFieldBaseCanvas,
  ProjectNavigator as ProjectBaseNavigator,
} from './project-field-base';
import { LivingWikiWorkbench } from './living-wiki';
import { type WorkbenchEvidence, type WorkbenchSemanticRef } from './workbench-native';

export type ProjectFieldProps = {
  selection?: WorkbenchSemanticRef;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
};

/// Preserve the accepted P2 Project Navigator exactly. Living Knowledge is a
/// relation around the current workbench/selection, not a replacement navigator.
export function ProjectNavigator(props: ProjectFieldProps) {
  return <ProjectBaseNavigator {...props} />;
}

/// Add Living Knowledge to the existing Project/document workbench while
/// retaining P2 source/Ground/Knowledge/ProjectMap/NOW semantics unchanged.
/// Both layers receive the same stable semantic selection.
export function ProjectFieldCanvas(props: ProjectFieldProps) {
  return <>
    <ProjectFieldBaseCanvas {...props} />
    <LivingWikiWorkbench selection={props.selection} />
  </>;
}
