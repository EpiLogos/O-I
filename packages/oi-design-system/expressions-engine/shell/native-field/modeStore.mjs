import { parseModeCatalogue } from "./modeCatalogue.mjs";
const NOT_HOSTED = "This Expressions body is not hosted, so there is no kernel to read the mode catalogue from";
const READING = "The mode catalogue is being read from the kernel";
let reader = null;
let state = { catalogue: null, why: NOT_HOSTED, started: false };
const listeners = /* @__PURE__ */ new Set();
const publish = (next) => {
  state = next;
  for (const listener of [...listeners]) listener();
};
function setModeCatalogueReader(read) {
  reader = read;
  state = { catalogue: null, why: read ? null : NOT_HOSTED, started: false };
}
function modeCatalogueReading() {
  if (reader && !state.started) {
    const read = reader;
    publish({ catalogue: null, why: READING, started: true });
    void read().then((document) => {
      if (reader !== read) return;
      const parsed = parseModeCatalogue(document);
      publish(parsed.ok ? { catalogue: parsed.catalogue, why: null, started: true } : { catalogue: null, why: parsed.refusal, started: true });
    }, (error) => {
      if (reader !== read) return;
      publish({ catalogue: null, why: `The kernel could not be asked for the mode catalogue: ${error instanceof Error ? error.message : String(error)}`, started: true });
    });
  }
  return { catalogue: state.catalogue, why: state.why };
}
function refreshModeCatalogue() {
  state = { catalogue: null, why: reader ? null : NOT_HOSTED, started: false };
  for (const listener of [...listeners]) listener();
}
function onModeCatalogue(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export {
  NOT_HOSTED,
  modeCatalogueReading,
  onModeCatalogue,
  refreshModeCatalogue,
  setModeCatalogueReader
};
