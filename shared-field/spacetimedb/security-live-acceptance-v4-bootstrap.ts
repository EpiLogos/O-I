(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

await import('./security-live-acceptance-v4.ts');
await import('./security-live-acceptance-v5.ts');
await import('./security-live-acceptance-v6.ts');
