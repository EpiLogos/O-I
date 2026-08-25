import React from 'react';

import {
  ProjectFieldCanvas as ProjectFieldBaseCanvas,
  ProjectNavigator as ProjectBaseNavigator,
} from './project-field-base';
import { AuthoredRelationsWorkbench } from './authored-relations';
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

/// The existing Project Canvas remains the linguistic/source surface. Authored
/// relation disclosure consumes AIKit's owner read model beside it, preserving
/// the same stable P1 selection through relation navigation, Living Knowledge and
/// explicit Contemplate. O:I owns no parser, resolver, backlink store or graph.
export function ProjectFieldCanvas(props: ProjectFieldProps) {
  return <>
    <FlowWorkbench {...props} />
    <ProjectFieldBaseCanvas {...props} />
    <AuthoredRelationsWorkbench selection={props.selection} onSelect={props.onSelect} />
    <LivingWikiWorkbench selection={props.selection} />
  </>;
}
