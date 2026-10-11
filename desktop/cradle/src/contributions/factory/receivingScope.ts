/** Factory's current read clients bind local Central. A retained hosted
 * conversation cannot select that owner by omitting its World address. */
export interface FactoryReceivingScope {
  project?: string;
  sourceWorldRef?: string;
  unavailable?: string;
  current?: () => boolean;
}
export function factoryScopeRefusal(scope: FactoryReceivingScope): string | undefined {
  if (scope.unavailable) return scope.unavailable;
  if (scope.sourceWorldRef !== undefined) return 'This native World has not disclosed a qualified Factory work-reading operation. Its conversation remains available.';
  if (scope.current && !scope.current()) return 'The originating Factory presentation is concealed or retired.';
  return undefined;
}
export function captureFactoryReceiver(read: () => FactoryReceivingScope, presented: () => boolean): () => boolean {
  const before = read();
  const key = JSON.stringify([before.project ?? null, before.sourceWorldRef ?? null, before.unavailable ?? null]);
  return () => {
    const now = read();
    return presented() && (!before.current || before.current()) && !factoryScopeRefusal(now)
      && JSON.stringify([now.project ?? null, now.sourceWorldRef ?? null, now.unavailable ?? null]) === key;
  };
}
