/**
 * Credentials: enter and check API keys (12-SETTINGS §3.4, decision S2).
 *
 * One card per provider that matters. Configured: where the key is kept,
 * when it was last checked, and Verify / Rotate / Revoke — the owner's own
 * `aikit credential` verbs. Not configured: Add key reveals ONE write-only
 * field; Save hands the key to the kernel (which passes it to AIKit on
 * STDIN) and the field empties at once. A stored secret is named by its
 * location. You see THAT a key is present and whether it works — never the
 * key: no value is ever rendered, held in state, placed in an attribute or
 * copied (S12).
 */
import {useRef, useState} from "react";
import {credentialCards, providerName, storedIn, type CredentialCard} from "../sectionModel";
import {expect, loadCredentials, loadSuite, plain, recordVerification, refreshAll, type SettingsSnapshot, type VerifyResult} from "../settingsData";
import {Missing, Reading, Unreadable} from "../rows";
import {formatRelativeTime} from "../../../shared/relativeTime";

const VERDICT_WORD: Record<VerifyResult["verdict"], string> = {working: "working", refused: "refused", unreachable: "unreachable"};

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
}

type Form = "key" | "reference" | null;

function KeyEntry({card, verb, materialMissing, onDone}: {card: CredentialCard; verb: "setup" | "rotate"; materialMissing: string | null; onDone: (message: string, ok: boolean) => void}) {
  const field = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const input = field.current;
    if (!input) return;
    // The key leaves the field before anything else happens: it is read
    // once, the field is emptied, and nothing in the page keeps it.
    const material = input.value;
    input.value = "";
    if (!material.trim()) return;
    setBusy(true);
    try {
      await expect({op: verb === "setup" ? "credential_setup" : "credential_rotate", credential: card.credential, material}, "credential_changed");
      await Promise.all([loadCredentials(), loadSuite()]);
      onDone(`Saved. The key is never shown again.`, true);
    } catch (cause) {
      const reason = plain(cause);
      onDone(`This key wasn't saved. ${materialMissing && reason.includes("--stdin") ? "AIKit can't take a pasted key from the app yet (see above)." : reason}`, false);
    } finally {
      setBusy(false);
    }
  };
  return <div className="settings-keyentry">
    <form className="settings-keyentry-row" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {/* Write-only: a password field with no value binding, no autocomplete
        * and no spellcheck; its contents never enter React state. */}
      <input ref={field} className="settings-input settings-secret" type="password" autoComplete="off" spellCheck={false}
        aria-label={`${card.label} API key`} placeholder={`Paste your ${card.label} API key`} data-credential-field={card.provider}/>
      <button type="submit" className="settings-button is-primary" disabled={busy} data-credential-save>{busy ? "Saving…" : "Save"}</button>
    </form>
    <p className="settings-muted">Saved through AIKit to the keychain. The field empties and the key is never shown again.</p>
    {materialMissing && <Missing>This AIKit can't take a pasted key from the app yet: `aikit credential setup` reads a key only from a terminal, and the app needs its `--stdin` form. A stored secret works today.</Missing>}
  </div>;
}

function ReferenceEntry({card, verb, onDone}: {card: CredentialCard; verb: "setup" | "rotate"; onDone: (message: string, ok: boolean) => void}) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!reference.trim()) return;
    setBusy(true);
    try {
      await expect({op: verb === "setup" ? "credential_setup" : "credential_rotate", credential: card.credential, reference: reference.trim()}, "credential_changed");
      setReference("");
      await Promise.all([loadCredentials(), loadSuite()]);
      onDone("Saved. AIKit reads the key from that store when it's used.", true);
    } catch (cause) {
      onDone(`This wasn't saved. ${plain(cause)}`, false);
    } finally {
      setBusy(false);
    }
  };
  return <form className="settings-keyentry-row" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <input className="settings-input" type="text" autoComplete="off" spellCheck={false} aria-label={`Where the ${card.label} key is stored`}
      placeholder="keychain:// · op:// · varlock:// · pass://" value={reference} onChange={(event) => setReference(event.target.value)} data-credential-reference={card.provider}/>
    <button type="submit" className="settings-button is-primary" disabled={busy} data-credential-reference-save>{busy ? "Saving…" : "Save"}</button>
  </form>;
}

function ProviderCard({card, data, suggestion}: {card: CredentialCard; data: SettingsSnapshot; suggestion?: {name: string; location: string} | null}) {
  const [form, setForm] = useState<Form>(null);
  const [rotating, setRotating] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{text: string; ok: boolean} | null>(null);
  const binding = card.binding;
  const configured = !!binding && !binding.revoked;
  const verification = data.verifications[card.credential];
  const materialMissing = data.credentials.state === "ok" && !data.credentials.value.materialEntry.available ? data.credentials.value.materialEntry.missing : null;
  const done = (text: string, ok: boolean) => { setMessage({text, ok}); if (ok) { setForm(null); setRotating(false); } };
  const verify = async () => {
    setBusy("verify"); setMessage(null);
    try {
      const outcome = await expect<{data: {verdict: VerifyResult["verdict"]; http_status_class?: string | null; checked_at_unix_seconds?: number; recorded?: boolean}}>({op: "credential_verify", credential: card.credential}, "credential_verified");
      recordVerification(card.credential, {verdict: outcome.data.verdict, at: (outcome.data.checked_at_unix_seconds ?? Date.now() / 1000) * 1000, http: outcome.data.http_status_class ?? null, recorded: outcome.data.recorded === true});
      await loadCredentials();
    } catch (cause) {
      setMessage({text: `Couldn't check this key: ${plain(cause)}`, ok: false});
    } finally {
      setBusy(null);
    }
  };
  const revoke = async () => {
    setBusy("revoke"); setMessage(null); setConfirmRevoke(false);
    try {
      await expect({op: "credential_revoke", credential: card.credential}, "credential_changed");
      await Promise.all([loadCredentials(), loadSuite()]);
      setMessage({text: "Revoked. AIKit won't use this key; nothing was deleted from where it's stored.", ok: true});
    } catch (cause) {
      setMessage({text: `This key wasn't revoked. ${plain(cause)}`, ok: false});
    } finally {
      setBusy(null);
    }
  };
  const importEnv = async (name: string) => {
    setBusy("import"); setMessage(null);
    try {
      await expect({op: "credential_setup", credential: card.credential, reference: `env://${name}`}, "credential_changed");
      await Promise.all([loadCredentials(), loadSuite()]);
      setMessage({text: `Imported ${name} into the keychain.`, ok: true});
    } catch (cause) {
      setMessage({text: `${name} wasn't imported. ${plain(cause)}`, ok: false});
    } finally {
      setBusy(null);
    }
  };
  const status = configured
    ? `Configured · ${storedIn(binding!)}`
    : binding?.revoked ? `Revoked · ${storedIn(binding)}` : "Not configured";
  const checked = verification
    ? `${verification.verdict === "working" ? "Verified" : "Checked"} ${formatRelativeTime(verification.at)} · ${VERDICT_WORD[verification.verdict]} (${clock(verification.at)})`
    : binding?.last_verified_at_unix_seconds ? `Last checked ${formatRelativeTime(binding.last_verified_at_unix_seconds * 1000)}` : configured ? "Not checked yet" : null;
  return <section className={`settings-card settings-credential${form || rotating ? " is-wide" : ""}`} data-settings-row={`credential:${card.provider}`} data-credential-card={card.provider} data-configured={configured ? "true" : "false"}>
    <h3>{card.label}</h3>
    <p data-credential-status>{status}{!configured && card.modelsNeeding > 0 ? ` · ${card.modelsNeeding} catalogued ${card.modelsNeeding===1?"model uses":"models use"} this key` : ""}</p>
    {checked && <p data-credential-checked data-verdict={verification?.verdict}>{checked}</p>}
    {suggestion && !configured && <p className="settings-card-note" data-credential-suggestion>Found {suggestion.name} in {suggestion.location}.{suggestion.location === "process environment"
      ? <> <button type="button" className="settings-link" disabled={busy !== null} onClick={() => void importEnv(suggestion.name)}>Import it</button></> : " AIKit can't import from there yet."}</p>}
    {configured && !rotating && <div className="settings-card-actions">
      <button type="button" className="settings-button" disabled={busy !== null} data-credential-verify onClick={() => void verify()}>{busy === "verify" ? "Checking…" : "Verify"}</button>
      <button type="button" className="settings-button" disabled={busy !== null} onClick={() => { setRotating(true); setMessage(null); }}>Rotate</button>
      {confirmRevoke
        ? <span className="settings-confirm">Revoke? AIKit stops using it. <button type="button" className="settings-button is-danger" data-credential-revoke-confirm onClick={() => void revoke()}>Revoke</button><button type="button" className="settings-button" onClick={() => setConfirmRevoke(false)}>Cancel</button></span>
        : <button type="button" className="settings-button" disabled={busy !== null} data-credential-revoke onClick={() => setConfirmRevoke(true)}>Revoke</button>}
    </div>}
    {rotating && <>
      <p className="settings-muted">Replace the key or where it's stored; the credential keeps its name.</p>
      <KeyEntry card={card} verb="rotate" materialMissing={materialMissing} onDone={done}/>
      <ReferenceEntry card={card} verb="rotate" onDone={done}/>
      <button type="button" className="settings-button" onClick={() => setRotating(false)}>Cancel</button>
    </>}
    {!configured && form === null && <div className="settings-card-actions">
      <button type="button" className="settings-button is-primary" data-credential-add onClick={() => { setForm("key"); setMessage(null); }}>Add key</button>
      <button type="button" className="settings-button" data-credential-use-reference onClick={() => { setForm("reference"); setMessage(null); }}>Use a stored secret</button>
    </div>}
    {!configured && form === "key" && <>
      <KeyEntry card={card} verb={binding ? "rotate" : "setup"} materialMissing={materialMissing} onDone={done}/>
      <p className="settings-muted">Or use a stored secret: <button type="button" className="settings-link" onClick={() => setForm("reference")}>keychain:// · op:// · varlock:// · pass://</button></p>
    </>}
    {!configured && form === "reference" && <>
      <ReferenceEntry card={card} verb={binding ? "rotate" : "setup"} onDone={done}/>
      <button type="button" className="settings-button" onClick={() => setForm(null)}>Cancel</button>
    </>}
    {message && <p className={message.ok ? "settings-card-note" : "settings-inline-error"} role={message.ok ? "status" : "alert"} data-credential-message>{message.text}</p>}
  </section>;
}

export interface Discovery {
  state: "idle" | "reading" | "ok" | "failed";
  findings: {name: string; location: string; provider: string | null; bound: boolean}[];
  error?: string;
}

export async function discoverKeys(): Promise<Discovery> {
  try {
    const outcome = await expect<{data: {findings?: unknown[]}}>({op: "credential_discover"}, "credential_reading");
    const findings = (outcome.data.findings ?? []).map((row) => {
      const record = (row ?? {}) as Record<string, unknown>;
      const proposed = typeof record.proposed_credential_ref === "string" ? record.proposed_credential_ref : null;
      return {
        name: String(record.name ?? ""), location: String(record.location ?? ""),
        provider: proposed ? proposed.replace(/^credential:/, "") : null, bound: record.already_bound === true,
      };
    });
    return {state: "ok", findings};
  } catch (cause) {
    return {state: "failed", findings: [], error: plain(cause)};
  }
}

export function CredentialsSection({data, discovery}: {data: SettingsSnapshot; discovery: Discovery}) {
  if (data.credentials.state === "reading") return <Reading/>;
  if (data.credentials.state === "failed") return <Unreadable error={data.credentials.error} onRetry={() => void refreshAll()}/>;
  const cards = credentialCards(data);
  const facts = data.suite.state === "ok" && data.suite.value.disclosure.state === "ok" ? data.suite.value.disclosure.rows : null;
  const stores = facts?.secretStores.filter((store) => store.availability === "available").map((store) => store.store === "OS secure store" ? "Keychain" : store.store) ?? [];
  const suggestions = discovery.findings.filter((finding) => finding.provider && !finding.bound);
  return <div className="settings-credentials" data-credentials-panel>
    {discovery.state === "reading" && <p className="settings-muted" role="status">Looking for keys on this machine…</p>}
    {discovery.state === "failed" && <p className="settings-inline-error" role="alert">Couldn't look for keys: {discovery.error}</p>}
    {discovery.state === "ok" && <p className="settings-card-note" role="status" data-credential-discovery>{suggestions.length === 0 ? "No new keys found on this machine." : `Found ${suggestions.length} ${suggestions.length === 1 ? "key" : "keys"} on this machine — confirm each on its card.`}</p>}
    <div className="settings-cards">
      {cards.map((card) => {
        const found = suggestions.find((finding) => finding.provider === card.provider);
        return <ProviderCard key={card.provider} card={card} data={data} suggestion={found ? {name: found.name, location: found.location} : null}/>;
      })}
    </div>
    <h3 className="settings-eyebrow">Stored in</h3>
    <p className="settings-muted" data-credential-stores>{facts
      ? `${stores.length ? `${stores.slice(0, -1).join(", ")}${stores.length > 1 ? " and " : ""}${stores[stores.length - 1]} ${stores.length === 1 ? "is" : "are"} available.` : "No secret store is available."} Importing keys from the environment is ${facts.posture.environmentImport === "closed" ? "closed unless you choose a key above" : facts.posture.environmentImport ?? "not disclosed"}.`
      : `Where keys can be stored isn't disclosed here${data.suite.state === "ok" && data.suite.value.disclosure.state === "absent" ? `: ${data.suite.value.disclosure.reason}` : "."}`}</p>
    {cards.some((card) => card.binding && !card.binding.revoked) && <p className="settings-muted settings-foot">Keys for {cards.filter((card) => card.binding && !card.binding.revoked).map((card) => providerName(card.provider)).join(", ")} are in use.</p>}
  </div>;
}
