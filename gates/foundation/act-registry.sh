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
# Workcell and Factory's sessions (O-I #1006): the fresh World declares its first workcell (workcell.declare), and its seat is
# joined and released by the seat instrument's own Actions with CENTRAL_ROOT naming this World — the instrument resolves the
# machine's own register unless CENTRAL_ROOT names another, so no seat Action here runs without it. Factory's session start, the
# sessions it keeps (factory.session.list), a task written, run to its end and its log read, the task's unit retried
# (factory.attempt.retry), the retry stopped (paused, then cancelled), and the session's end are Factory's own Actions. Factory
# retries only a unit that failed, and a session's task that leaves no difference in its checkout ends failed, so the task asks for
# a reading and no change: the agent is sent two prompts, the task's (answered) and its retry's (cancelled at once). The agent is
# FOUNDATION_AGENT, else the first the census lists that starts. Choosing a take (factory.attempt.choose) proposes an attempt's
# Return into the Central Flow its Run belongs to, and a session's task is commissioned from the person's words with no Flow:
# Factory refuses it in those words, its difference staying in the session's checkout for Git / landing, so it is not run here.
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
real_home="$HOME"
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

echo "act-registry: Workcell and Factory's sessions"
# --- A workcell: the World's first, declared by Workcell, for a project whose primary stands on main --------------------------------
# Factory's state stays out of the project's history (it is state, not source), so a checkout of the project carries none.
( cd "$world/Work/$project" && printf '# Field notes\n' > NOTES.md && printf '.factory/\n' > .gitignore && git init -q -b main && git add --all \
  && git -c user.name=act-registry -c user.email=act-registry@local commit -qm "Field notes begin" ) || ground "the project's repository"
register="$world/Control/machines/workcells.register.json"
checkout=""
# The seat is a linked checkout of the project's primary, as every seat of the machine is (its .git a file the primary keeps).
if declared="$(act workcell.declare "$(jq -nc --arg w "$world" --arg p "$project" '{world:$w, project:$p}')")" \
  && checkout="$(jq -r .checkout <<<"$declared")" && [ -f "$checkout/.git" ] \
  && git -C "$world/Work/$project" worktree list --porcelain | grep -qxF "worktree $checkout" \
  && [ "$(jq -r '.workcells[0].seats[0].state' "$register")" = "free" ]; then
  holds workcell.declare "env-1 holds a linked checkout of $project's primary, its seat free in this World's register"
else
  fails workcell.declare "no workcell declared in this World"
fi
seat() { CENTRAL_ROOT="$world" act "$@"; }
if [ -n "$checkout" ] && seat workcell.seat.join "$(jq -nc --arg p "$project" --arg a "$principal" \
    '{workcell:"env-1", product:$p, actor:$a, branch:"act-registry"}')" >/dev/null \
  && [ "$(jq -r '.workcells[0].seats[0].state' "$register")" != "free" ]; then
  holds workcell.seat.join "env-1's $project seat held, in this World's register"
else
  fails workcell.seat.join "the seat is not held in this World's register"
fi

# --- What a task needs: the project's world in the person's standing grant, a practice the agent carries, AIKit's NOW service ------
aikit="${OI_AIKIT_BIN:-$suite/aikit}"
setup() { "$aikit" --json "$@" >/dev/null 2>&1 || ground "aikit $*"; }
act actuation.authority.grant-world "$(jq -nc --arg h "$principal" --arg p "project:$project" '{holder:$h, world:["control:root", $p]}')" \
  >/dev/null || ground "the project's world was not granted"
mkdir -p "$home/.agents/skills/notes-keeper"
printf -- "---\nname: notes-keeper\ndescription: Keep a project's notes file short.\n---\n\nKeep NOTES.md short.\n" \
  >"$home/.agents/skills/notes-keeper/SKILL.md"
setup init
digest="$("$aikit" --json adopt "$home/.agents/skills" --namespace registry 2>/dev/null | jq -r '.data.review_digest // empty')"
[ -n "$digest" ] || ground "AIKit's adoption plan"
setup adopt "$home/.agents/skills" --namespace registry --yes --expect-digest "$digest"
skill=skill/registry/notes-keeper
setup set create registry
setup set add registry "$skill"
setup compose repertoire --set registry --scope global --apply
setup enable "$skill" --scope global --apply
setup trust record "$skill"
port="$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
setup now-context service provision --port "$port"
setup now-context service start
stop_now() { "$aikit" --json now-context service stop >/dev/null 2>&1 || true; }
# The owner processes this World's Actions started (a session's encounter server outlives its end): every process whose command
# line names this World's root, each stopped by its pid, never by a pattern.
stop_owners() {
  local pid waited
  for pid in $(ps -axww -o pid=,command= | awk -v root="$root" -v me="$$" 'index($0, root) && $1 != me {print $1}'); do
    kill -TERM "$pid" 2>/dev/null || continue
    waited=0
    while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 10 ]; do sleep 0.5; waited=$((waited + 1)); done
    if kill -0 "$pid" 2>/dev/null; then kill -KILL "$pid" 2>/dev/null || true; fi
  done
}
trap 'stop_now; stop_owners; [ "$keep" = 1 ] || rm -rf "$root"' EXIT
# The agents' own sign-in, never their state (as gates/foundation/run.sh links it): Claude Code's login keychain, Codex's and Pi's
# auth.json, linked from the person's home into this one.
for file in Library/Keychains/login.keychain-db .codex/auth.json .pi/agent/auth.json; do
  if [ -f "$real_home/$file" ] && [ ! -e "$home/$file" ]; then mkdir -p "$(dirname "$home/$file")" && ln -s "$real_home/$file" "$home/$file"; fi
done
agent="${FOUNDATION_AGENT:-}"
[ -n "$agent" ] || agent="$("$aikit" --json client status 2>/dev/null | jq -r '[.data.clients[]? | .harness // empty] | first // empty')"

# --- Session start: an agent of the census seated on a track, in the checkout the seat holds ----------------------------------------
session=""
if opened="$(act factory.session.start "$(jq -nc --arg a "$agent" --arg w "$world" --arg p "$project" '{agent:$a, world:$w, project:$p}')")" \
  && session="$(jq -r '.session // empty' <<<"$opened")" && [ -n "$session" ] && [ "$(jq -r .checkout <<<"$opened")" = "$checkout" ]; then
  holds factory.session.start "$agent seated on $(jq -r .track <<<"$opened")"
else
  fails factory.session.start "no session opened in the seat's checkout"
fi

# --- A task written and listed on its session, run to its end, its log read; its unit retried, and the retry stopped twice ----------
task_state="" task_run="" unit="" attempt=""
if [ -n "$session" ] && written="$(act factory.task.write "$(jq -nc --arg w "$world" --arg p "$project" --arg s "$session" \
    '{world:$w, project:$p, session:$s, instruction:"Read NOTES.md and say in one line what it holds. Change no file."}')")" \
  && task_state="$(jq -r .factory_state <<<"$written")" && task_run="$(jq -r .run_ref <<<"$written")" \
  && unit="$(jq -r '.unit_ref // empty' <<<"$written")" && [ "$(jq -r .state <<<"$written")" = "written" ]; then
  holds factory.task.write "$task_run written on $session"
else
  fails factory.task.write "no task written"
fi
if [ -n "$task_run" ] && listed="$(act factory.session.list "$(jq -nc --arg st "$task_state" '{state:$st}')")" \
  && jq -e --arg s "$session" --arg r "$task_run" \
    'any(.sessions[]; .session == $s and .state == "open" and any(.tasks[]?; .run_ref == $r))' <<<"$listed" >/dev/null; then
  holds factory.session.list "$session open, its task $task_run among $(jq -r '.sessions | length' <<<"$listed") session(s)"
else
  fails factory.session.list "the session is not listed open with its task"
fi
task() { jq -nc --arg st "$task_state" --arg r "$task_run" --arg a "$attempt" '{state:$st, run_ref:$r, attempt_ref:$a}'; }
if [ -n "$task_run" ] && ran="$(keyed factory.task.run "$(jq -nc --arg st "$task_state" --arg r "$task_run" --arg s "$session" \
    '{state:$st, run_ref:$r, session:$s}')")" && attempt="$(jq -r '.attempt_ref // empty' <<<"$ran")" && [ -n "$attempt" ]; then
  holds factory.task.run "$attempt running, its log at $(jq -r .log <<<"$ran")"
else
  fails factory.task.run "the task did not run"
fi
# Its end, as Factory settles it: the agent's turn answered and the checkout holds no difference, so Factory reads the attempt failed.
ended="" log=""
if [ -n "$attempt" ]; then
  for _ in $(seq 1 200); do
    log="$(act factory.task.log "$(task)")" || break
    case "$(jq -r '.attempt.status // empty' <<<"$log")" in *Fail*|*Return*) ended="$(jq -r .attempt.status <<<"$log")"; break ;; esac
    sleep 3
  done
fi
if [ -n "$ended" ] && jq -e '(.lines | length) > 0' <<<"$log" >/dev/null; then
  holds factory.task.log "$(jq -r '.lines | length' <<<"$log") lines; Factory reads $attempt $ended"
else
  fails factory.task.log "no log, or the attempt not seen to end within 10 minutes"
fi
prior="$attempt"
attempt=""
if [ "${ended#*Fail}" != "$ended" ] && [ -n "$unit" ] \
  && retried="$(keyed factory.attempt.retry "$(jq -nc --arg st "$task_state" --arg r "$task_run" --arg u "$unit" '{state:$st, run_ref:$r, unit_ref:$u}')")" \
  && [ "$(jq -r '.prior_attempt_ref // empty' <<<"$retried")" = "$prior" ] && attempt="$(jq -r '.attempt_ref // empty' <<<"$retried")" \
  && [ -n "$attempt" ] && [ "$attempt" != "$prior" ]; then
  holds factory.attempt.retry "$prior failed; $attempt $(jq -r .state <<<"$retried") under the unit's grant"
else
  attempt=""
  fails factory.attempt.retry "the failed attempt's unit was not retried"
fi
if [ -n "$attempt" ] && [ "$(keyed factory.task.stop "$(task)" | jq -r .state)" = "paused" ] \
  && [ "$(keyed factory.task.stop "$(task)" | jq -r .state)" = "cancelled" ] && log="$(act factory.task.log "$(task)")" \
  && jq -e '.attempt.status | test("Cancel")' <<<"$log" >/dev/null; then
  holds factory.task.stop "$attempt paused, then cancelled; Factory reads it $(jq -r .attempt.status <<<"$log")"
else
  fails factory.task.stop "the retry was not paused and then cancelled"
fi

# --- Session end, then the seat released ----------------------------------------------------------------------------------------
if [ -n "$session" ] && ended="$(act factory.session.end "$(jq -nc --arg w "$world" --arg p "$project" --arg s "$session" \
    '{world:$w, project:$p, session:$s}')")" && [ "$(jq -r .state <<<"$ended")" = "ended" ]; then
  holds factory.session.end "$session ended, its body released: $(jq -c .released <<<"$ended")"
else
  fails factory.session.end "the session did not end"
fi
if [ -n "$checkout" ] && seat workcell.seat.release "$(jq -nc --arg p "$project" --arg a "$principal" '{workcell:"env-1", product:$p, actor:$a}')" >/dev/null \
  && [ "$(jq -r '.workcells[0].seats[0].state' "$register")" = "free" ]; then
  holds workcell.seat.release "env-1's $project seat free again"
else
  fails workcell.seat.release "the seat is not free again"
fi

echo "act-registry: $held held, $failed did not"
exit "$failed"
