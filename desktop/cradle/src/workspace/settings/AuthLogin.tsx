/**
 * The login option beside the API-key input (12-SETTINGS §3.3/§3.4; docs/
 * experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md §2a). A harness's
 * profile declares, per provider, both ways in: an env-var key (the key
 * field's business) and its own login — either a runnable one-shot command
 * (`codex login`) or a note-only fact. The face is read live from
 * `aikit harness auth <slug> --json`; nothing here invents an option.
 *
 * The honesty rule: a runnable entry becomes a Log in button that hands the
 * declared argv to a real terminal surface (the same PTY the shell surface
 * owns — the login process keeps the terminal, exactly as in front of the
 * person). A note-only entry renders its note as visible instruction and
 * NEVER a button; a command that cannot run is never offered silently.
 */
import {useEffect, useState} from "react";
import {ensureAuthFaces, useSettings, type AuthLoginOption} from "./settingsData";
import {harnessName, providerId, readyHarnesses} from "./sectionModel";

/** The declared login command, as text: a public command, not a secret. */
const commandText = (entry: AuthLoginOption): string => (entry.argv ?? []).join(" ");

function CopyCommand({text}: {text: string}) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="settings-link" data-auth-copy
    onClick={() => {
      void navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
    }}>
    {copied ? "Copied" : "Copy command"}
  </button>;
}

/** One runnable login: the button hands the declared argv to a terminal
 * surface; the exact command and a copy affordance sit beside it, so the
 * person can equally run it in their own terminal. */
function LoginAction({harness, entry, via}: {harness: string; entry: AuthLoginOption; via?: string}) {
  const text = commandText(entry);
  const program = entry.argv?.[0] ?? harnessName(harness);
  return <span className="settings-auth-login" data-auth-login={harness} data-auth-provider={entry.provider_ref}>
    <button type="button" className="settings-button" data-auth-login-button onClick={() => {
      window.dispatchEvent(new CustomEvent("oi:open-terminal", {detail: {command: entry.argv ?? [], title: `Log in · ${harnessName(harness)}`}}));
    }}>Log in with {program}{via ? ` · ${via}` : ""}</button>
    {text && <code className="settings-auth-command" data-auth-command>{text}</code>}
    {text && <CopyCommand text={text}/>}
  </span>;
}

/** One note-only login: the note is the instruction, visibly — there is no
 * command to run, so there is no button. */
function LoginNote({harness, entry}: {harness: string; entry: AuthLoginOption}) {
  return <p className="settings-muted settings-auth-note" data-auth-note={harness} data-auth-provider={entry.provider_ref}>{entry.note}</p>;
}

/** The auth options of one harness, beside its setup controls. */
export function HarnessAuth({harness}: {harness: string}) {
  const data = useSettings();
  const face = data.authFaces[harness];
  useEffect(() => { ensureAuthFaces([harness]); }, [harness]);
  if (!face || face.state === "reading") return <p className="settings-muted" data-auth-reading={harness} role="status">Reading {harnessName(harness)}’s sign-in options…</p>;
  if (face.state === "failed") return <p className="settings-inline-error" role="alert" data-auth-failed={harness}>Couldn’t read the sign-in options: {face.error}</p>;
  if (face.value.own_login.length === 0) return null;
  return <div className="settings-auth" data-harness-auth={harness}>
    {face.value.own_login.map((entry) => entry.runnable && entry.argv?.length
      ? <div key={entry.provider_ref} className="settings-auth-option">
          <LoginAction harness={harness} entry={entry}/>
          {entry.note && <p className="settings-muted">{entry.note}</p>}
        </div>
      : <div key={entry.provider_ref} className="settings-auth-option"><LoginNote harness={harness} entry={entry}/></div>)}
  </div>;
}

/** The logins one provider's Credentials card gains: every ready harness
 * whose own profile declares a runnable login serving that provider. Cards
 * render runnable logins only — a note-only harness's note lives on its own
 * setup card, where it is attributable. */
export function ProviderLogins({provider}: {provider: string}) {
  const data = useSettings();
  const ready = data.suite.state === "ok" ? readyHarnesses(data.suite.value) : [];
  const slugs = ready.map((row) => row.client).join(",");
  useEffect(() => { ensureAuthFaces(slugs ? slugs.split(",") : []); }, [slugs]);
  const matches: {harness: string; entry: AuthLoginOption}[] = [];
  for (const row of ready) {
    const face = data.authFaces[row.client];
    if (face?.state !== "ok") continue;
    for (const entry of face.value.own_login) {
      if (entry.runnable && providerId(entry.provider_ref) === provider) matches.push({harness: row.client, entry});
    }
  }
  if (matches.length === 0) return null;
  return <div className="settings-auth" data-provider-logins={provider}>
    <p className="settings-muted">Or sign in through the harness’s own store:</p>
    {matches.map(({harness, entry}) => <div key={`${harness}:${entry.provider_ref}`} className="settings-auth-option">
      <LoginAction harness={harness} entry={entry} via={harnessName(harness)}/>
    </div>)}
  </div>;
}
