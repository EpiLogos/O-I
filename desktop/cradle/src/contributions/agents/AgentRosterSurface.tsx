import { useEffect, useState } from "react";
import { useKernel } from "../../kernel/KernelProvider";
import { EncounterList, type EncounterRow } from "../../encounter/EncounterList";
import "./agents.css";
import {
  expressAgentProfile,
  readAgentRoster,
  readAgentWorlds,
  type AgentProfileExpression,
  type AgentRoster,
  type AgentWorld,
} from "./client";
import { SessionSpaceControls } from "./SessionSpaceControls";

export interface AgentRosterSurfaceProps {
  project: string;
  projectRef: string;
  onOpenEncounter?: (row: EncounterRow) => Promise<void>;
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function AgentRosterSurface({
  project,
  projectRef,
  onOpenEncounter,
}: AgentRosterSurfaceProps) {
  const kernel = useKernel();
  const [roster, setRoster] = useState<AgentRoster>();
  const [worlds, setWorlds] = useState<AgentWorld[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<AgentProfileExpression>({
    world_ref: "",
    ratified_world_refs: [],
    intent_expression: "",
  });
  const [proposal, setProposal] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(undefined);
    setRoster(undefined);
    setWorlds([]);
    void Promise.allSettled([
      readAgentRoster(kernel.transport, project, projectRef),
      readAgentWorlds(kernel.transport, project, projectRef),
    ]).then(([rosterResult, worldsResult]) => {
      if (!live) return;
      if (rosterResult.status === "fulfilled") {
        setRoster(rosterResult.value);
      } else {
        setError(message(rosterResult.reason));
      }
      if (worldsResult.status === "fulfilled") {
        setWorlds(worldsResult.value);
        setForm((current) => ({
          ...current,
          world_ref: worldsResult.value.some((world) => world.ref === current.world_ref)
            ? current.world_ref
            : "",
          ratified_world_refs: current.ratified_world_refs.filter((ref) =>
            worldsResult.value.some((world) => world.ref === ref),
          ),
        }));
      } else if (rosterResult.status === "fulfilled") {
        setError(message(worldsResult.reason));
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [kernel.transport, project, projectRef, tick]);

  const incomplete =
    !form.world_ref.trim() ||
    form.ratified_world_refs.length === 0 ||
    !form.intent_expression.trim();

  const express = async () => {
    if (incomplete || busy) return;
    setBusy(true);
    setError(undefined);
    setProposal(undefined);
    try {
      const result = await expressAgentProfile(
        kernel.transport,
        project,
        projectRef,
        form,
      );
      setProposal(result);
      setForm((value) => ({ ...value, intent_expression: "" }));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };

  const setWorld = (worldRef: string) => {
    // Owning World and ratified World scope are separate owner declarations;
    // choosing one must never silently add it to the other.
    setForm((value) => ({ ...value, world_ref: worldRef }));
    setProposal(undefined);
  };

  const toggleRatifiedWorld = (worldRef: string) => {
    setForm((value) => ({
      ...value,
      ratified_world_refs: value.ratified_world_refs.includes(worldRef)
        ? value.ratified_world_refs.filter((ref) => ref !== worldRef)
        : [...value.ratified_world_refs, worldRef],
    }));
    setProposal(undefined);
  };

  return (
    <section className="agents-roster" aria-label="Project Agents">
      <header>
        <div>
          <h2>Agents</h2>
          <p>Durable project profiles and teams</p>
        </div>
        <button onClick={() => setTick((value) => value + 1)} disabled={loading}>
          Refresh
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Reading Central Agents and Worlds…</p>}

      <section>
        <h3>Profiles</h3>
        {roster?.profiles.length ? (
          <ul>
            {roster.profiles.map((profile, index) => (
              <li key={String(profile.profile_ref ?? profile.agent_ref ?? index)}>
                <strong>{String(profile.agent_ref ?? profile.profile_ref ?? "Unnamed Agent")}</strong>
                <span>{String(profile.purpose ?? "Profile source")}</span>
                <small>{String(profile.revision ?? "revision unavailable")}</small>
              </li>
            ))}
          </ul>
        ) : (
          roster && <p>No project AgentProfiles are authored.</p>
        )}
      </section>

      <section>
        <h3>AgentSets</h3>
        {roster?.sets.length ? (
          <ul>
            {roster.sets.map((set, index) => (
              <li key={String(set.ref ?? index)}>
                <strong>{String(set.ref ?? "Unnamed AgentSet")}</strong>
                <span>
                  {Array.isArray(set.members)
                    ? `${set.members.length} declared members`
                    : "Declared membership unavailable"}
                </span>
                <small>
                  {set.orchestrator_agent_ref
                    ? `orchestrated by ${set.orchestrator_agent_ref}`
                    : String(set.revision ?? "revision unavailable")}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          roster && <p>No project AgentSets are authored.</p>
        )}
      </section>

      <section>
        <h3>Current sessions</h3>
        {onOpenEncounter ? (
          <EncounterList project={project} onOpen={onOpenEncounter} />
        ) : (
          <p>Session controls are supplied by the canonical AIKit encounter Surface.</p>
        )}
      </section>

      <SessionSpaceControls project={project} projectRef={projectRef} />

      <details>
        <summary>Express an AgentProfile intent</summary>
        <p>
          Central allocates the profile and Agent refs. The result remains a generated,
          unrecognised proposal until the owner recognises it.
        </p>
        <label>
          World
          <select
            value={form.world_ref}
            onChange={(event) => setWorld(event.target.value)}
            disabled={busy || loading}
          >
            <option value="">Select the owning World</option>
            {worlds.map((world) => (
              <option key={world.ref} value={world.ref}>
                {world.ref}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Ratified Worlds</legend>
          {worlds.length ? (
            worlds.map((world) => (
              <label key={world.ref}>
                <input
                  type="checkbox"
                  checked={form.ratified_world_refs.includes(world.ref)}
                  onChange={() => toggleRatifiedWorld(world.ref)}
                  disabled={busy}
                />
                {world.ref}
              </label>
            ))
          ) : (
            <p>No ratified Worlds were returned for this Project.</p>
          )}
        </fieldset>
        <label>
          Intent
          <textarea
            value={form.intent_expression}
            onChange={(event) => {
              setForm((value) => ({ ...value, intent_expression: event.target.value }));
              setProposal(undefined);
            }}
            disabled={busy}
            rows={4}
          />
        </label>
        <label>
          Purpose (optional)
          <input
            value={form.purpose ?? ""}
            onChange={(event) =>
              setForm((value) => ({ ...value, purpose: event.target.value }))
            }
            disabled={busy}
          />
        </label>
        <label>
          Role (optional)
          <input
            value={form.role ?? ""}
            onChange={(event) =>
              setForm((value) => ({ ...value, role: event.target.value }))
            }
            disabled={busy}
          />
        </label>
        <button onClick={() => void express()} disabled={busy || incomplete}>
          {busy ? "Expressing…" : "Express AgentProfile intent"}
        </button>
        {proposal !== undefined && (
          <details open>
            <summary>Generated proposal · unrecognised</summary>
            <pre data-proposal-standing="generated-proposal-unrecognised">
              {JSON.stringify(proposal, null, 2)}
            </pre>
          </details>
        )}
      </details>
    </section>
  );
}
