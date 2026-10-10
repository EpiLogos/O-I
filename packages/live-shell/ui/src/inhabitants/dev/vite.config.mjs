// Vite config for the inhabitant-rack harness (dev/ only, L2). It serves the
// InhabitantRack + the six families' composed manifests, and its middleware
// plays the kernel bridge's /op route with fixture readings shaped exactly
// like the native contracts: the retained document forms are read from disk
// (the owners' own bytes); the day/flow/nara op responses are scripted so
// the save router's named outcomes can be driven honestly in capture.
//
// Harness config, not the shell build (the ui package's own
// `tsc --noEmit && vite build` remains the shell build, untouched). Same
// pattern as the projection-seam harness.
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {readFile} from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/inhabitants/dev
const inhabitantsDir = dirname(here);
const uiRoot = join(inhabitantsDir, '..', '..');
const cradleSrc = join(uiRoot, '..', '..', '..', 'desktop', 'cradle', 'src');
const documentsDir = join(uiRoot, '..', '..', '..', 'desktop', 'cradle', 'documents');

// ---------------------------------------------------------------------------
// the fixture day: the island payload is the retained template's own, so the
// projected form renders its real data. The native field mapping names two
// mapped fields; everything else the form changes is disclosed as unmapped.
/** The fixture day: revision + payload (plain JS, harness config). */

const dieHtml = await readFile(join(documentsDir, 'ql-daily-die.html'), 'utf8');
const islandText = dieHtml.match(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/)?.[1];
if (!islandText) throw new Error('The retained die template carries no payload island');
const basePayload = JSON.parse(islandText);

const DAY = {
  sourceRef: 'central:path-ref:day-2026-10-09',
  documentId: 'day-2026-10-09',
};
const MAPPED_FIELDS = [
  {id: 'p0_quick_thoughts', label: 'Quick thoughts', template_pointer: '/fields/p0_quick_thoughts'},
  {id: 'p1_intentions', label: 'Intentions', template_pointer: '/fields/p1_intentions'},
];

const day = {revision: 'r1', payload: JSON.parse(JSON.stringify(basePayload))};
const flowState = {revision: 'r1'};
const scenarios = {
  mutate: 'ok',     // 'ok' | 'conflict' | 'error'
  document: 'ok',   // 'ok' | 'moved'
  flowWrite: 'written', // 'written' | 'conflict' | 'unchanged'
};

function location(path, ref) {
  return {schema: 'central.path-ref/v1', ref, root: 'central', path};
}

function dayReading() {
  return {
    schema: 'central.document-reading/v1',
    source: {ref: DAY.sourceRef},
    document_id: DAY.documentId,
    revision: {revision: day.revision},
    document: {
      document_id: DAY.documentId,
      kind: 'day',
      fields: MAPPED_FIELDS,
      template_payload: day.payload,
    },
    automatic_agent_or_model_invocation: false,
  };
}

/** Apply one field edit to the payload at its JSON pointer (the owner's
 * CAS semantics, at fixture scale). */
function applyPointer(payload, pointer, value) {
  const parts = pointer.replace(/^\//, '').split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = payload;
  for (const part of parts.slice(0, -1)) node = node[part];
  node[parts[parts.length - 1]] = value;
}

function nextRevision(revision) {
  return `r${Number(revision.slice(1)) + 1}`;
}

async function handleOp(op) {
  if (op.op === 'receiving') {
    const request = op.request;
    if (request.Document) {
      if (scenarios.document === 'moved') {
        // The source moved while a draft stood: the face's session guard
        // must block, and the strip discloses the stale standing.
        day.revision = nextRevision(day.revision);
      }
      return {ok: true, outcome: {result: 'receiving_reading', data: dayReading(), receipts: []}};
    }
    if (request.MutateField) {
      const mutation = request.MutateField;
      if (scenarios.mutate === 'error') {
        return {ok: false, error: 'Central receiving is unavailable (fixture scenario)'};
      }
      const advanced = nextRevision(day.revision);
      // The writer sends field_id; the mapping (id → template pointer) lives
      // in the reading. Apply it the way the owner would, then name the
      // advanced revision in a committed receipt.
      const mapping = MAPPED_FIELDS.find(field => field.id === mutation.field_id);
      if (!mapping) {
        return {ok: false, error: `Fixture day maps these fields only: ${MAPPED_FIELDS.map(field => field.id).join(', ')} (got ${String(mutation.field_id)})`};
      }
      if (scenarios.mutate === 'conflict') {
        // A receipt that contradicts the write: previous_revision names a
        // revision the writer never held.
        return {ok: true, outcome: {result: 'receiving_reading', receipts: [], data: {
          ...dayReading(),
          revision: {revision: advanced},
          operation_receipt: {status: 'committed', previous_revision: 'r999', revision: advanced},
        }}};
      }
      applyPointer(day.payload, mapping.template_pointer, mutation.value);
      return {ok: true, outcome: {result: 'receiving_reading', receipts: [], data: {
        ...dayReading(),
        revision: {revision: advanced},
        operation_receipt: {status: 'committed', previous_revision: day.revision, revision: advanced},
      }}};
    }
    return {ok: false, error: 'Fixture receiving knows the Document and MutateField requests only'};
  }
  if (op.op === 'files_list') {
    if (String(op.path).includes('documents')) {
      return {ok: true, outcome: {result: 'directory_read', receipts: [], directory: {
        schema: 'central.directory-reading/v1',
        location: location(op.path, 'central:path-ref:documents'),
        entries: [
          {name: 'ql-daily-die.html', location: location(`${op.path}/ql-daily-die.html`, 'central:path-ref:documents:die'), kind: 'file', byte_len: dieHtml.length, retrieval_allowed: true},
        ],
        automatic_agent_or_model_invocation: false,
      }}};
    }
    return {ok: false, error: `Fixture listing knows the documents directory only (got ${String(op.path)})`};
  }
  if (op.op === 'file_read') {
    const path = String(op.location?.path ?? '');
    if (path.endsWith('ql-daily-die.html')) {
      return {ok: true, outcome: {result: 'file_read', receipts: [], reading: {
        schema: 'central.file-reading/v1',
        location: op.location,
        revision: 'form-r3',
        byte_len: dieHtml.length,
        content_encoding: 'utf-8',
        content: dieHtml,
        project: null,
        source: null,
        automatic_agent_or_model_invocation: false,
      }}};
    }
    if (path.endsWith('.html')) {
      // The flow instance fixture: the retained template's own bytes, served
      // as the instance (labelled in the capture as the fixture instance).
      const html = await readFile(join(documentsDir, 'ql-flow.html'), 'utf8');
      return {ok: true, outcome: {result: 'file_read', receipts: [], reading: {
        schema: 'central.file-reading/v1',
        location: op.location,
        revision: flowState.revision,
        byte_len: html.length,
        content_encoding: 'utf-8',
        content: html,
        project: null,
        source: null,
        automatic_agent_or_model_invocation: false,
      }}};
    }
    return {ok: false, error: `Fixture file read knows the document forms only (got ${path})`};
  }
  if (op.op === 'file_operation') {
    if (scenarios.flowWrite === 'conflict') {
      return {ok: true, outcome: {result: 'file_operation', receipts: [], data: {
        outcome: 'conflict',
        current: {schema: 'central.file-reading/v1', location: op.location, revision: 'r9', byte_len: 0, content_encoding: 'utf-8', content: '', project: null, source: null, automatic_agent_or_model_invocation: false},
      }}};
    }
    if (scenarios.flowWrite === 'unchanged') return {ok: true, outcome: {result: 'file_operation', receipts: [], data: {outcome: 'unchanged'}}};
    flowState.revision = nextRevision(flowState.revision);
    return {ok: true, outcome: {result: 'file_operation', receipts: [], data: {outcome: 'written', revision: flowState.revision}}};
  }
  if (op.op === 'nara_dialogue') {
    const request = op.request ?? {};
    return {ok: true, outcome: {result: 'nara_dialogue', receipts: [], data: {
      schema: 'oi.nara-dialogue-binding/v1',
      binding: {
        operation: 'lookup',
        source_ref: request.source_ref,
        expected_revision: request.expected_revision,
        person_ref: request.person_ref,
        nara_ref: request.nara_ref,
        expression_ref: request.expression_ref,
        role: request.role,
      },
      provisioning: {
        project: op.project ?? 'o-i',
        space: 'fixture:space-1',
        agent_session: 'fixture:agent-session-1',
        provider: 'fixture',
        resume_required: false,
      },
    }}};
  }
  return {ok: false, error: `Fixture kernel knows these ops only: receiving, files_list, file_read, file_operation, nara_dialogue (got ${String(op.op)})`};
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

export default defineConfig({
  root: here,
  server: {
    port: 5203,
    strictPort: true,
    host: '127.0.0.1',
    fs: {
      allow: [inhabitantsDir, uiRoot, cradleSrc],
    },
  },
  build: {target: 'es2022'},
  plugins: [{
    name: 'inhabitant-rack-fixture-kernel',
    configureServer(server) {
      server.middlewares.use('/scenario', (request, response) => {
        void (async () => {
          const body = JSON.parse((await readBody(request)) || '{}');
          if (body.mutate) scenarios.mutate = body.mutate;
          if (body.document) scenarios.document = body.document;
          if (body.flowWrite) scenarios.flowWrite = body.flowWrite;
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ok: true, scenarios}));
        })();
      });
      server.middlewares.use('/op', (request, response) => {
        void (async () => {
          try {
            const op = JSON.parse((await readBody(request)) || '{}');
            const result = await handleOp(op);
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify(result));
          } catch (error) {
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ok: false, error: String(error)}));
          }
        })();
      });
    },
  }],
});
