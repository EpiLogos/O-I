#!/usr/bin/env bash
# The one Action registry, proven from outside (O-I #1002: "An agent can run each of those Actions by the same id through
# `oi act invoke`, proven by a script"). A fresh World is made in its own isolated home. Each Action of Central's and Factory's
# cores (docs/architecture/world-shell.md §9.3) is then run by its id through `oi act invoke`, as an agent runs it. Each effect is
# read back from the owner that holds it. A refusal is never a pass. Nothing of the person's is reached: no ~/.aikit, ~/.central or
# Control/ of theirs.
#
# Authority. The fresh World's own key, which Setup's Ground step makes, is the only authority any act carries. Central's
# authenticated Actions (the Day, Receiving) run with it in CENTRAL_NATIVE_TOKEN, as the shell's host supplies it; an agent's
# proposal is carried the same way and names the agent as its declared producer. A page an agent saves names the agent.
#
#   gates/foundation/act-registry.sh           every core Action, then a line per Action and the count
#   gates/foundation/act-registry.sh --keep    the same, keeping the fresh World (its path is printed)
#
# Owners come from OI_BIN, OI_CENTRAL_CTRL_BIN, OI_AIKIT_BIN, OI_FACTORY_BIN, … (else the installed suite). The exit status is the
# number of Actions that did not hold.
#
# Not here yet: Factory's session start and stop and its approve are composed in the kernel (`factory_owner`), and seat join and
# release need a Workcell the fresh World declares. They become Factory's and Workcell's own Actions under O-I #1006, which adds
# them to this script. The seat instrument resolves the machine's own register unless CENTRAL_ROOT names another, so this script
# never runs it.
set -uo pipefail

keep=0
[ "${1:-}" = "--keep" ] && keep=1
suite="$HOME/Library/Application Support/OI/bin"
oi="${OI_BIN:-$suite/oi}"
ctrl="${OI_CENTRAL_CTRL_BIN:-$suite/ctrl}"
for owner in "$oi" "$ctrl"; do
  [ -x "$owner" ] || { echo "act-registry: no owner executable at $owner" >&2; exit 2; }
done
command -v jq >/dev/null || { echo "act-registry: jq is needed to read the owners' answers" >&2; exit 2; }

# A short root, as a person's home is: the owners' Unix sockets live under it, and a socket path is bounded.
root="$(mktemp -d /tmp/oi-ar.XXXXXX)"
home="$root/home"
mkdir -p "$home" "$root/t"
home="$(cd "$home" && pwd -P)"
if [ "$keep" = 1 ]; then echo "act-registry: the fresh World stays at $home"; else trap 'rm -rf "$root"' EXIT; fi
export HOME="$home" TMPDIR="$root/t" HISTFILE=/dev/null OI_WORLD_FOLDER="$home"
unset CENTRAL_NATIVE_TOKEN OI_CENTRAL_ROOT CENTRAL_ROOT AIKIT_HOME OI_HOME XDG_CONFIG_HOME OI_EXPRESSION_HOME OI_CENTRAL_PROJECT_QUERY
# A GIT_* exported around a run aims its git at the wrong repository.
for name in $(env | sed -n 's/^\(GIT_[A-Z_]*\)=.*/\1/p'); do unset "$name"; done
cd "$home"
"$ctrl" init >/dev/null || { echo "act-registry: ctrl init refused a fresh home" >&2; exit 2; }
world="$home/Central"
cd "$world"

held=0
failed=0
# One Action by its id, its input on stdin, as an agent runs it: the owner's own answer (unwrapped from its envelope) on stdout,
# else its refusal on stderr and a non-zero status. A third argument is the key the host supplies for an authenticated Action.
# An owner's receipt of the invocation comes on stderr and is not its answer, so the two are read apart.
act() {
  local answer status errors words
  errors="$(mktemp)"
  if [ -n "${3:-}" ]; then
    answer="$(printf '%s' "$2" | CENTRAL_NATIVE_TOKEN="$3" "$oi" act invoke "$1" --input - --json 2>"$errors")"
  else
    answer="$(printf '%s' "$2" | "$oi" act invoke "$1" --input - --json 2>"$errors")"
  fi
  status=$?
  if [ "$status" -ne 0 ] || [ "$(jq -sr 'first | if type == "object" then (.ok // true) else true end' <<<"$answer" 2>/dev/null)" = "false" ]; then
    words="$(jq -sr 'first | .error.message // empty' <<<"$answer" 2>/dev/null)"
    [ -n "$words" ] || words="$(jq -sr 'first | .error.message // empty' <"$errors" 2>/dev/null)"
    [ -n "$words" ] || words="$(cat "$errors") $answer"
    echo "$1 refused: $words" >&2
    rm -f "$errors"
    return 1
  fi
  rm -f "$errors"
  jq -c 'if type == "object" and .ok == true and has("data") then .data else . end' <<<"$answer"
}
# An authenticated Action, carried by this World's key as the shell's host carries the person's.
keyed() { act "$1" "$2" "$(cat "$home/.central/native-token")"; }
# One line per Action: what it did, read back.
holds() { held=$((held + 1)); printf '  held  %-38s %s\n' "$1" "$2"; }
fails() { failed=$((failed + 1)); printf '  FAIL  %-38s %s\n' "$1" "$2"; }
ground() { echo "act-registry: Setup's Ground step: $1" >&2; exit 2; }

echo "act-registry: a fresh World at $world"

# --- Setup's Ground step, by Central's own Actions: civil time, placement, this World's key, and a project ------------------------
principal="human:$(basename "$home")"
accept() { jq -nc --arg digest "$1" --arg ref "act-registry:$$" \
  '{actor_kind:"human", acceptance:"human-accepted", acceptance_ref:$ref, expected_digest:$digest}'; }
for step in "central.time.policy.preview central.time.policy.adopt recognised" \
            "central.ground.placement.preview central.ground.placement.adopt present"; do
  set -- $step
  shown="$(act "$1" '{}')" || ground "$1 refused"
  [ "$(jq -r .state <<<"$shown")" = "$3" ] && continue
  act "$2" "$(accept "$(jq -r .digest <<<"$shown")")" >/dev/null || ground "$2 refused"
done
mkdir -p "$home/.central" && chmod 700 "$home/.central"
(umask 077 && openssl rand -hex 32 | tr -d '\n' >"$home/.central/native-token")
key="$(shasum -a 256 "$home/.central/native-token" | cut -d' ' -f1)"
shown="$(act central.ground.authority.preview "$(jq -nc --arg p "$principal" '{principal_ref:$p}')")" || ground "the key's preview refused"
act central.ground.authority.adopt "$(accept "$(jq -r .digest <<<"$shown")" \
  | jq -c --arg p "$principal" --arg k "$key" '. + {principal_ref:$p, token_sha256:$k}')" >/dev/null || ground "the key's adopt refused"
project=field-notes
mkdir -p "$world/Work/$project"
act projectcentral.init "$(jq -nc --arg p "$project" '{project:$p, project_id:$p}')" >/dev/null || ground "the project was not made"
shown="$(act central.ground.project.preview "$(jq -nc --arg p "$project" '{project:$p, project_id:$p}')")" \
  || ground "the project's preview refused"
act central.ground.project.adopt "$(accept "$(jq -r .digest <<<"$shown")" | jq -c --arg p "$project" '. + {project:$p, project_id:$p}')" \
  >/dev/null || ground "the project's adopt refused"

# An Agent for what is sent to wait for: the person names it in their World by Central's own profile Action. A Position is authored
# ground no Action writes (Control/relations is protected), and no Position names this Agent, so a send is held for its address.
act agent-profile.save '{"scope":"personal","profile":{"schema":"central.agent-profile/v1","ref":"agent-profile:act-registry",
  "agent_ref":"agent:act-registry","revision":"r1","name":"act-registry","scope":"personal","world_ref":"control:root",
  "ratified_world_refs":["control:root"],"role":"The act registry'"'"'s correspondent"}}' >/dev/null || ground "the Agent's profile was not saved"
at() { jq -nc --arg root "$world" --arg path "$1" \
  '{schema:"central.path-ref/v1", ref:("central:path:" + $root + ":" + $path), root:$root, path:$path}'; }

echo "act-registry: Central's core"
# --- Day open --------------------------------------------------------------------------------------------------------------
day=""
policy="$(act central.time.policy '{}' | jq -r '.revision // .policy.revision // empty')"
if keyed central.day.ensure "$(jq -nc --arg r "$policy" '{expected_time_policy_revision:$r}')" >/dev/null \
  && day="$(act central.day.read '{}')" && [ "$(jq -r .temporal.lifecycle <<<"$day")" = "open" ]; then
  holds central.day.ensure "today's Day $(jq -r .day_ref <<<"$day") reads open"
else
  fails central.day.ensure "no open Day read back"
fi
day_ref="$( [ -n "$day" ] && jq -r '.day_ref // empty' <<<"$day")"

# --- Page save and open, by an agent --------------------------------------------------------------------------------------------
path="Control/user/flows/act-registry.html"
page="<!doctype html><title>act-registry</title><p>Saved by its id through oi act invoke.</p>"
if saved="$(act central.files.write "$(jq -nc --argjson l "$(at "$path")" --arg c "$page" \
    '{location:$l, expected_revision:"", content:$c, actor:"agent:act-registry", actor_kind:"agent"}')")" \
  && [ "$(jq -r .outcome <<<"$saved")" = "created" ] && [ "$(jq -r .change.actor <<<"$saved")" = "agent:act-registry" ]; then
  holds central.files.write "a page created at $path, saved by agent:act-registry"
else
  fails central.files.write "no page created at $path"
fi
if opened="$(act central.files.read "$(jq -nc --argjson l "$(at "$path")" '{location:$l}')")" \
  && [ "$(jq -r .content <<<"$opened")" = "$page" ]; then
  holds central.files.read "the page opens with the words saved"
else
  fails central.files.read "the page does not open with the words saved"
fi

# --- Approve and reject: two proposals of an agent's, one accepted and one rejected, read back from Receiving ------------------
review() { # disposition
  local submitted ref revision read
  submitted="$(keyed central.receiving.submit "$(jq -nc --arg k "act-registry:$1:$$" --argjson t "$(date +%s)" \
    '{producer_key:$k, occurred_at_unix_seconds:$t, request:{kind:"proposal", subject:("A proposal to be " + $k)},
      declared_producer:{ref:"agent:act-registry", actor_kind:"agent", attribution:"claimed"}}')")" || return 1
  ref="$(jq -r '.return_ref // .return.return_ref // empty' <<<"$submitted")"
  revision="$(act central.receiving.read "$(jq -nc --arg r "$ref" '{return_ref:$r}')" | jq -r '.revision // .return.revision // empty')"
  keyed central.receiving.review "$(jq -nc --arg r "$ref" --arg v "$revision" --arg d "$1" \
    '{return_ref:$r, expected_return_revision:$v, disposition:$d}')" >/dev/null || return 1
  read="$(act central.receiving.read "$(jq -nc --arg r "$ref" '{return_ref:$r}')")" || return 1
  jq -e --arg d "$1" '[.. | strings] | index($d) != null' <<<"$read" >/dev/null && echo "$ref"
}
if ref="$(review accepted)"; then holds central.receiving.review "approved: $ref reads accepted"; else fails central.receiving.review "approve: not read back accepted"; fi
if ref="$(review rejected)"; then holds central.receiving.review "rejected: $ref reads rejected"; else fails central.receiving.review "reject: not read back rejected"; fi

# --- Send: a Communique to the Agent, which no Position seats yet, so it is held for its address --------------------------------
if sent="$(act aikit.gateway.send '{"to":"@act-registry","body":"Sent by its id through oi act invoke."}')" \
  && communique="$(jq -r '.communique.communique_ref // .communique_ref // empty' <<<"$sent")" && [ -n "$communique" ] \
  && heard="$(act aikit.gateway.heard "$(jq -nc --arg r "$communique" '{communique_ref:$r}')")"; then
  holds aikit.gateway.send "$communique reads $(jq -r '.state' <<<"$heard") for agent:act-registry"
else
  fails aikit.gateway.send "no Communique kept and read back"
fi

# --- Day close -----------------------------------------------------------------------------------------------------------------
if [ -n "$day_ref" ] && day="$(act central.day.read "$(jq -nc --arg d "$day_ref" '{day_ref:$d}')")" \
  && keyed central.day.lifecycle "$(jq -nc --arg d "$day_ref" --arg r "$(jq -r .revision.revision <<<"$day")" \
    --arg rel "$(jq -r .relations_revision <<<"$day")" \
    '{day_ref:$d, expected_revision:$r, expected_relations_revision:$rel, lifecycle:"closed"}')" >/dev/null \
  && [ "$(act central.day.read "$(jq -nc --arg d "$day_ref" '{day_ref:$d}')" | jq -r .temporal.lifecycle)" = "closed" ]; then
  holds central.day.lifecycle "$day_ref reads closed"
else
  fails central.day.lifecycle "the Day does not read closed"
fi

echo "act-registry: Factory's core"
# --- Commission: a draft composed into the exact request, commissioned in the project's Factory state, read back ----------------
state="$world/Work/$project/.factory/development-state.json"
draft="$(jq -nc --arg p "$project" '{contract:"factory.commission-draft/v1", projectKey:$p, purpose:"Prove the act registry",
  frontier:"Commissioned; nothing executed", runDestination:($p + "/act-registry"),
  rootAct:{agentRef:"agent:act-registry", purpose:"Run only what the registry names", scopeRefs:[("project:" + $p)]},
  participantRequirements:[{ref:"agent:act-registry", description:"Runs what the registry names", sourceOwner:"central",
    sourceRef:"agent-profile:act-registry", sourceRevision:"r1"}]}')"
request=""
if composed="$(act factory.development.commission-compose "$(jq -nc --argjson d "$draft" '{draft:$d}')")" \
  && request="$(jq -c .request <<<"$composed")" \
  && act factory.development.commission "$(jq -nc --arg s "$state" --argjson r "$request" '{state:$s, request:$r}')" >/dev/null \
  && reading="$(act factory.development.commission-read "$(jq -nc --arg s "$state" --arg r "$(jq -r .requestRef <<<"$request")" \
    '{state:$s, request_ref:$r}')")" \
  && [ "$(jq -r '.commission.runRef // .runRef // empty' <<<"$reading")" = "$(jq -r .runRef <<<"$composed")" ]; then
  holds factory.development.commission "$(jq -r .requestRef <<<"$request") commissions $(jq -r .runRef <<<"$composed")"
else
  fails factory.development.commission "no Commission read back"
fi

# --- Attempt read: the commissioned Run's attempts, read from the project's Factory state ----------------------------------------
# `factory.attempt.read` reads a state's one attempt field, which a Run has once a session starts on it (O-I #1006); a Run just
# commissioned is read by its ref.
run_ref="$( [ -n "$request" ] && jq -r .runRef <<<"$composed")"
if [ -n "$run_ref" ] && attempts="$(act factory.attempt.list "$(jq -nc --arg s "$state" --arg r "$run_ref" '{state:$s, run_ref:$r}')")" \
  && [ "$(jq -r '.runRef // empty' <<<"$attempts")" = "$run_ref" ]; then
  holds factory.attempt.list "$run_ref has $(jq -r '.totalTasks // 0' <<<"$attempts") attempt task(s), nothing executed"
else
  fails factory.attempt.list "no attempt reading for the commissioned Run"
fi

echo "act-registry: $held held, $failed did not"
exit "$failed"
