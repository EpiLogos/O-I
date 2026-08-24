import React from 'react';

import {
  ProjectFieldCanvas as ProjectFieldBaseCanvas,
  ProjectNavigator as ProjectBaseNavigator,
} from './project-field-base';
import { FlowNavigator, FlowWorkbench } from './flow-workbench';
import { LivingWikiWorkbench } from './living-wiki';
import { type WorkbenchEvidence, type WorkbenchSemanticRef } from './workbench-native';

export type ProjectFieldProps = {
  selection?: WorkbenchSemanticRef;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
};

/// Preserve the accepted P2 Project Navigator and add Flow as the ordinary-file
/// live-thinking source role beside it. FlowRef comes from the native owner;
/// navigation never derives identity from a timestamp/path.
export function ProjectNavigator(props: ProjectFieldProps) {
  return <>
    <FlowNavigator {...props} />
    <ProjectBaseNavigator {...props} />
  </>;
}

/// Flow uses the existing Project Canvas as its situated live document surface;
/// ordinary source/Ground/Knowledge/ProjectMap/NOW and Living Knowledge remain
/// unchanged parallel relations around the same stable semantic selection.
export function ProjectFieldCanvas(props: ProjectFieldProps) {
  return <>
    <FlowWorkbench {...props} />
    <ProjectFieldBaseCanvas {...props} />
    <LivingWikiWorkbench selection={props.selection} />
  </>;
}
