const CONTROLLED = {
  ref: "ql:controlled-focused",
  title: "Controlled Epi / Nara",
  snapshot: { schema: "ql.focused-instrument/v1", available: true,
    event: { event_ref: "event:walk", subject_ref: "subject:walk", profile_generation: 1 },
    live_cursor: { event_ref: "event:walk", subject_ref: "subject:walk", profile_generation: 1, field_generation: "1", samples_elapsed: "0" },
    presented_cursor: { event_ref: "event:walk", subject_ref: "subject:walk", profile_generation: 1, field_generation: "1", samples_elapsed: "0" },
    temporal: "live", tracking: "follow", selection: null, selection_standing: null, selected_target: null,
    focus: { focus: "m3", available: true, current: true, source_refs: ["source:walk"], payload: {}, standing: "controlled-walk" },
    clock: { presentation: { view: "assembled" }, owner_clock: null, field_ref: "#3-0", centre_ref: "#3-5-5/0", standing: "controlled-walk" },
    vak_expression: null, vak_performance: null, personal_current: false, standing: "controlled-walk" },
  bimba: { contract: "ql.focused-instrument-bimba-navigation/v1", source_revision: "walk:r1", selected_ref: null,
    items: [{ selection: { contract: "ql.focused-instrument-bimba-selection/v1", selection_ref: "bimba:walk:1", coordinate_ref: "#1", source_ref: "source:walk:1", source_revision: "walk:r1", disclosure_ref: "disclosure:walk:1", subject_ref: "subject:walk" }, label: "Controlled centre", face: "bimba", depth: 1, relation_refs: [] }],
    standing: "controlled-walk" },
};
export default async function run({page,baseUrl,check,shot,channel}) {
  await page.goto(baseUrl);
  await channel("info");
  await page.locator(".oi-point-cloud-overlay").waitFor({ timeout: 20000 });
  await channel("instrument.register", [{ ref: CONTROLLED.ref, title: CONTROLLED.title, snapshot: CONTROLLED.snapshot, bimba: CONTROLLED.bimba }]);
  await channel("instrument.requestOpen", [CONTROLLED.ref]);
  await page.locator('[data-epi-nara-region="instrument"]').waitFor({ timeout: 15000 });
  const m3 = page.locator('[data-epi-nara-region="instrument"]').getByRole("button", { name: "M3", exact: true });
  const info = await m3.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hits = document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2).slice(0, 6).map((e) =>
      e.tagName + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").join(".") : "") + (e.dataset?.epiNaraRegion ? `[${e.dataset.epiNaraRegion}]` : ""));
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, hits };
  });
  console.log(JSON.stringify(info, null, 1));
  await shot("k9debug");
}
