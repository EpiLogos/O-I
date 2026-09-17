/** K9: the privileged Epi / Nara focused instrument.
 *
 * Asserts the desktop keeps its own law while hosting a foreign owner:
 * one Global Expression Stage presents the focused medium; a registered
 * QL source receives a retained lease (checkpointed, recovery-observed,
 * paused and resumed through availability) and the composition's
 * commands; the shell's left region and the canonical right AgentLayer
 * remain the ordinary native surfaces; a binding survives relaunch
 * carrying only its source ref; an absent source is stated honestly,
 * never simulated; and leaving the binding removes the portals and
 * restores the ordinary desktop exactly.
 *
 * The QL side here is a controlled double (walk channel `instrument.*`)
 * standing in for QL-MEF's focused-instrument adapter — producer law and
 * owner-machine sensory validation live in their own receipts. */

const CONTROLLED = {
  ref: "ql:controlled-focused",
  title: "Controlled Epi / Nara",
  snapshot: {
    schema: "ql.focused-instrument/v1",
    available: true,
    event: { event_ref: "event:walk", subject_ref: "subject:walk", profile_generation: 1 },
    live_cursor: { event_ref: "event:walk", subject_ref: "subject:walk", profile_generation: 1, field_generation: "1", samples_elapsed: "0" },
    presented_cursor: { event_ref: "event:walk", subject_ref: "subject:walk", profile_generation: 1, field_generation: "1", samples_elapsed: "0" },
    temporal: "live",
    tracking: "follow",
    selection: null,
    selection_standing: null,
    selected_target: null,
    focus: { focus: "m3", available: true, current: true, source_refs: ["source:walk"], payload: {}, standing: "controlled-walk" },
    clock: { presentation: { view: "assembled" }, owner_clock: null, field_ref: "#3-0", centre_ref: "#3-5-5/0", standing: "controlled-walk" },
    vak_expression: null,
    vak_performance: null,
    personal_current: false,
    standing: "controlled-walk",
  },
  bimba: {
    contract: "ql.focused-instrument-bimba-navigation/v1",
    source_revision: "walk:r1",
    selected_ref: null,
    items: [
      {
        selection: {
          contract: "ql.focused-instrument-bimba-selection/v1",
          selection_ref: "bimba:walk:1",
          coordinate_ref: "#1",
          source_ref: "source:walk:1",
          source_revision: "walk:r1",
          disclosure_ref: "disclosure:walk:1",
          subject_ref: "subject:walk",
        },
        label: "Controlled centre",
        face: "bimba",
        depth: 1,
        relation_refs: [],
      },
    ],
    standing: "controlled-walk",
  },
};

const register = (channel) =>
  channel("instrument.register", [
    { ref: CONTROLLED.ref, title: CONTROLLED.title, snapshot: CONTROLLED.snapshot, bimba: CONTROLLED.bimba },
  ]);

export default async function run({page,baseUrl,check,shot,channel}) {
  await page.goto(baseUrl);
  await channel("info");
  // The stage's engine surface is created lazily behind the visuals master
  // and sleeps dormant (hidden) until a presentation claims it; the focused
  // medium hosted below is what wakes it.
  await page.locator(".oi-expression-surface").waitFor({ state: "attached", timeout: 20000 });
  // The workspace frame is requested only after the stage exists, so the
  // shell hosts a composition portals into may still be loading.
  await page.locator('[data-region="left"]').waitFor({ timeout: 30000 });

  // Honest refusal before anything is registered.
  const absent = await channel("instrument.requestOpen", [CONTROLLED.ref], { soft: true });
  check(absent.ok === false && /not registered/.test(absent.error ?? ""),
    "Opening with no registered source refuses, naming the absence");

  // Registration is the adapter's own act; then the workspace owner opens
  // the privileged composition through its own open-request path.
  await register(channel);
  await channel("instrument.requestOpen", [CONTROLLED.ref]);
  const bimbaRegion = page.locator('[data-epi-nara-region="bimba"]');
  const instrumentRegion = page.locator('[data-epi-nara-region="instrument"]');
  await instrumentRegion.waitFor({ timeout: 15000 });
  check(true, "The privileged composition portals into the shell's centre host");
  check((await page.evaluate(() => document.body.dataset.epiNaraMode)) === "focused",
    "The focused mode is announced once on the body");
  check((await page.locator('[data-region="right"]').count()) === 1,
    "The canonical right AgentLayer region stays mounted");
  const liveStage = page.locator('canvas[data-oi-stage="engine"][data-oi-stage-live="true"]');
  await liveStage.waitFor({ timeout: 15000 });
  check((await liveStage.count()) === 1,
    "The hosted composition wakes the one production stage");
  // The Bimba navigator is the source aperture and rests closed; opening it
  // is a person's act on the instrument surface.
  await instrumentRegion.getByRole("button", { name: "Open sources" }).click();
  await bimbaRegion.waitFor({ timeout: 15000 });
  check(true, "Opening the source aperture portals the navigator into the left host");

  // The retained lease crossed to the source: attached, checkpointed,
  // recovery-observed — the real engine lease, observed by the double.
  let read = (await channel("instrument.read", [CONTROLLED.ref])).data;
  check(read.attached && read.lease_events.includes("attach") && read.lease_events.includes("checkpoint")
      && read.lease_events.includes("recovery-observed"),
    "The composition hands the source a retained lease with checkpoint and recovery observation",
    read.lease_events);

  // Commands travel through the real controls to the registered owner.
  await instrumentRegion.getByRole("button", { name: "M3", exact: true }).click();
  await instrumentRegion.getByRole("button", { name: "Freeze view" }).click();
  await instrumentRegion.getByRole("button", { name: "Explode clock" }).click();
  await bimbaRegion.getByRole("button").first().click();
  await page.waitForTimeout(200);
  read = (await channel("instrument.read", [CONTROLLED.ref])).data;
  const kinds = read.commands.map((command) => command.kind);
  check(kinds.includes("set-focus") && kinds.includes("freeze") && kinds.includes("explode-clock") && kinds.includes("select-bimba"),
    "Focus, freeze, clock and Bimba commands reach the registered owner", kinds);
  check((await instrumentRegion.getByRole("button", { name: "Resume live" }).count()) === 1,
    "The composition mirrors the owner's temporal state");

  // Source absence on a live binding is stated, never simulated — and a
  // returning source is picked up through the same subscription.
  await channel("instrument.unregister", [CONTROLLED.ref]);
  await instrumentRegion.getByRole("alert").first().waitFor({ timeout: 5000 });
  check(true, "Deregistering the source surfaces an honest alert in the composition");
  await register(channel);
  await page.waitForFunction(
    () => document.querySelectorAll('[data-epi-nara-region="instrument"] [role="alert"]').length === 0,
    null,
    { timeout: 5000 },
  );
  check(true, "Re-registering the source clears the absence");

  // An unavailable owner holds the window surface's clock through the same
  // lease; a returned owner releases it.
  await channel("instrument.drive", [CONTROLLED.ref, { available: false }]);
  await page.waitForTimeout(200);
  let stage = (await channel("read.stage")).data;
  check(stage.paused === true, "An unavailable owner pauses the retained field through the lease", stage);
  await channel("instrument.drive", [CONTROLLED.ref, { available: true }]);
  await page.waitForTimeout(200);
  stage = (await channel("read.stage")).data;
  check(stage.paused === false, "A returned owner resumes the retained field");

  await shot("instrument-focused");

  // The binding persists only its ref and title: after relaunch the
  // composition re-enters and names the (page-memory) absent source.
  await page.reload();
  await channel("info");
  await page.locator('[data-epi-nara-region="instrument"]').waitFor({ timeout: 15000 });
  check((await page.evaluate(() => document.body.dataset.epiNaraMode)) === "focused",
    "The instrument binding survives relaunch and re-enters privileged mode");
  const alertText = await page.locator('[data-epi-nara-region="instrument"] [role="alert"]').first().textContent();
  check(/not registered/.test(alertText ?? ""),
    "After relaunch the absent source is named honestly", alertText);

  // Leaving the binding removes the portals and restores the ordinary desktop.
  await register(channel);
  await page.locator(".tab-close").first().waitFor({ timeout: 15000 });
  await page.locator(".tab-close").first().click();
  await page.waitForTimeout(400);
  check((await page.locator('[data-epi-nara-region="bimba"]').count()) === 0
      && (await page.locator('[data-epi-nara-region="instrument"]').count()) === 0,
    "Leaving the binding removes both portals");
  check((await page.evaluate(() => document.body.dataset.epiNaraMode)) === undefined,
    "The focused mode announcement is cleared");
  read = (await channel("instrument.read", [CONTROLLED.ref])).data;
  check(read.lease_events.includes("detach"), "The source observed the lease detach");
}
