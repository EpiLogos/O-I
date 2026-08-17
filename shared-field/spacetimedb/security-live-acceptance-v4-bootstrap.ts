(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

await import('./security-live-acceptance-v4.ts');
