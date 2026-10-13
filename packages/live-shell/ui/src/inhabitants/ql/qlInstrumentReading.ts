// The QL instrument reading now lives in the boundary package (packages/expressions-boundary/src/qlInstrumentReading.ts): the
// boundary validates the owner's announced reading with it, and the live-shell reads the same module. This path stays valid for
// existing imports and pins; nothing here is a second copy.
export * from '../../../../../expressions-boundary/src/qlInstrumentReading.ts'
