import { SPARSE_REPRESENTATION_SCHEMA, validateProjection } from "../shared-field/index.mjs";

function requireSparseRepresentation(projection) {
  const payload = projection.representation?.payload;
  if (projection.representation?.kind !== SPARSE_REPRESENTATION_SCHEMA || payload?.schema !== SPARSE_REPRESENTATION_SCHEMA) {
    throw new TypeError(`Unsupported browser representation: ${projection.representation?.kind ?? "missing"}`);
  }
  return payload;
}

export function projectionViewModel(input) {
  const projection = validateProjection(input);
  const representation = requireSparseRepresentation(projection);
  return {
    mark: "{O:I}",
    projection_ref: projection.projection_ref,
    projection_revision: projection.projection_revision,
    subject_ref: projection.subject.ref,
    subject_kind: projection.subject.kind,
    source_system: projection.source.system,
    source_revision: projection.source.revision,
    publisher_participant_ref: projection.publisher_participant_ref,
    state: projection.state,
    title: representation.title ?? projection.subject.ref,
    description: representation.description ?? "",
    groups: Array.isArray(representation.groups) ? representation.groups : [],
    meta: Array.isArray(representation.meta) ? representation.meta : [],
    provenance: projection.provenance,
  };
}

function appendTextElement(doc, parent, tag, text, className) {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

export function renderProjectionInto(root, input, doc = document) {
  const view = projectionViewModel(input);
  root.replaceChildren();
  root.dataset.oiState = "projection";
  root.dataset.oiSubject = view.subject_kind;
  root.dataset.oiProjectionRef = view.projection_ref;

  const shell = doc.createElement("article");
  shell.className = "projection";

  const top = doc.createElement("header");
  top.className = "projection__header";
  appendTextElement(doc, top, "div", view.mark, "projection__mark");
  appendTextElement(doc, top, "div", view.subject_kind, "projection__kind");
  shell.append(top);

  appendTextElement(doc, shell, "h1", view.title, "projection__title");
  if (view.description) appendTextElement(doc, shell, "p", view.description, "projection__description");

  for (const group of view.groups) {
    const section = doc.createElement("section");
    section.className = "projection__group";
    appendTextElement(doc, section, "h2", group.label ?? "Selection", "projection__group-title");
    const list = doc.createElement("ul");
    list.className = "projection__list";
    for (const item of group.items ?? []) {
      const li = doc.createElement("li");
      const line = doc.createElement(item.href ? "a" : "span");
      line.textContent = item.label ?? item.ref;
      if (item.href) line.href = item.href;
      li.append(line);
      if (item.description) appendTextElement(doc, li, "p", item.description, "projection__item-description");
      list.append(li);
    }
    section.append(list);
    shell.append(section);
  }

  const provenance = doc.createElement("footer");
  provenance.className = "projection__provenance";
  const source = `${view.source_system} · ${view.source_revision}`;
  appendTextElement(doc, provenance, "span", source);
  appendTextElement(doc, provenance, "span", `projection ${view.projection_revision}`);
  shell.append(provenance);

  root.append(shell);
  return view;
}

export async function loadProjectionInto(root, source, fetchImpl = fetch, doc = document) {
  const [locator, member] = String(source).split("#", 2);
  const response = await fetchImpl(locator);
  if (!response.ok) throw new Error(`Unable to load Projection (${response.status})`);
  const documentValue = await response.json();
  const projection = member ? documentValue?.[member] : documentValue;
  if (member && !projection) throw new Error(`Projection member not found: ${member}`);
  return renderProjectionInto(root, projection, doc);
}
