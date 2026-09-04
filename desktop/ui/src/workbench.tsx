import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CurrentWorldNavigator, type CurrentWorldReading } from './current-world';
import { WorldRecognitionNavigator, type WorldRecognitionAccount } from './world-recognition';
import { ProjectFieldCanvas, ProjectNavigator } from './project-field';
import {
  WorkbenchSurface as NativeWorkbenchSurface,
  type WorkbenchEvidence,
  type WorkbenchSemanticRef,
} from './workbench-native';

export * from './workbench-native';

export function WorkbenchSurface({
  selection,
  currentWorld,
  worldRecognition,
  onSelect,
  onAgentSessionChange,
  onReobserveWorld,
}: {
  selection?: WorkbenchSemanticRef;
  currentWorld?: CurrentWorldReading;
  worldRecognition?: WorldRecognitionAccount;
  onSelect: (subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) => Promise<void>;
  onAgentSessionChange?: (agentSessionRef: string | null) => void;
  onReobserveWorld?: () => void;
}) {
  const [navigatorHost, setNavigatorHost] = useState<Element | null>(null);

  useEffect(() => {
    setNavigatorHost(document.querySelector('.oi-shell__navigator'));
  }, []);

  async function select(subject: WorkbenchSemanticRef, evidence: WorkbenchEvidence) {
    await onSelect(subject, evidence);
  }

  return (
    <>
      {navigatorHost && createPortal(
        <>
          <CurrentWorldNavigator currentWorld={currentWorld} />
          <WorldRecognitionNavigator account={worldRecognition} onReobserve={onReobserveWorld} />
          <ProjectNavigator selection={selection} onSelect={select} />
        </>,
        navigatorHost,
      )}
      <ProjectFieldCanvas selection={selection} onSelect={select} />
      <NativeWorkbenchSurface onSelect={select} onAgentSessionChange={onAgentSessionChange} />
    </>
  );
}
