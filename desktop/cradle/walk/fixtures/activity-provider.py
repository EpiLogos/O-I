#!/usr/bin/env python3
"""Controlled protocol fixture for the agency-planes (6C) walk.

Derived from the select-send fixture (itself copied from the bound ai-kit
candidate revision's own test provider, behaviour unchanged there). This
variant scripts ADDITIONAL protocol behaviours so the desktop's Activity plane
can be walked against real ACP wire events: agent thought chunks, tool calls,
a real session/request_permission round-trip answered by the client, a
cancellable long turn, and a controlled disconnect. Every behaviour is a
scripted protocol transport (D/C evidence), never a model or harness response.
"""
import json, os, sys, threading, time

mode, log = sys.argv[1:3]
write_lock = threading.Lock()
state_lock = threading.Lock()
pending_prompt = {}      # request id -> prompt message (turn in flight)
consent_responses = {}   # request id -> client's permission response
cancel_requested = set() # request ids the client cancelled


def emit(value):
    with write_lock:
        print(json.dumps(value), flush=True)


def reply(message, result=None, error=None):
    if mode == 'pi':
        emit(dict(type='response', id=message['id'], command=message['type'], success=error is None, **({'error': str(error)} if error else {'data': result or {}})))
    else:
        emit(dict(jsonrpc='2.0', id=message['id'], **({'error': {'code': -32000, 'message': str(error)}} if error else {'result': result})))


def update(session_id, payload):
    emit({'jsonrpc': '2.0', 'method': 'session/update', 'params': {'sessionId': session_id, 'update': payload}})


def chunk(session_id, text):
    update(session_id, {'sessionUpdate': 'agent_message_chunk', 'content': {'type': 'text', 'text': text}})


def turn(message, text):
    if 'CONTROLLED_DISCONNECT' in text:
        os._exit(7)
    native = message['params']['sessionId']
    request_id = message.get('id')
    with state_lock:
        if request_id is not None:
            pending_prompt[request_id] = text
    if 'ACTIVITY_HOLD' in text:
        # A long turn the walk will Stop: wait for the client's session/cancel.
        deadline = time.time() + 30
        while time.time() < deadline:
            with state_lock:
                if request_id in cancel_requested:
                    reply(message, {'stopReason': 'cancelled'})
                    return
            time.sleep(0.1)
        reply(message, {'stopReason': 'end_turn'})
        return
    if 'ACTIVITY_CONSENT' in text:
        # A real provider-consent round-trip: the agent asks, the client
        # (here, the human through the desktop) answers, then the turn ends.
        consent_id = emit_consent_request(native)
        answer = wait_for_consent(consent_id, 30)
        outcome = answer.get('outcome') if isinstance(answer, dict) else None
        if isinstance(outcome, dict):
            choice = str(outcome.get('optionId', outcome))
        else:
            choice = str(outcome or answer)
        chunk(native, 'CONSENT_ANSWERED:' + choice)
        reply(message, {'stopReason': 'end_turn'})
        return
    if 'ACTIVITY_THINK_TOOL' in text:
        time.sleep(1.2)  # long enough for the walk to observe the in-flight wait
        update(native, {'sessionUpdate': 'agent_thought_chunk', 'content': {'type': 'text', 'text': 'FIXTURE_THOUGHT'}})
        update(native, {'sessionUpdate': 'tool_call', 'toolCallId': 'fixture-tool-1', 'kind': 'read', 'title': 'Fixture read', 'status': 'in_progress'})
        update(native, {'sessionUpdate': 'tool_call_update', 'toolCallId': 'fixture-tool-1', 'status': 'completed'})
        chunk(native, 'FIXTURE_REPLY')
        reply(message, {'stopReason': 'end_turn'})
        return
    chunk(native, 'FIXTURE_REPLY')
    reply(message, {'stopReason': 'end_turn'})


def emit_consent_request(session_id):
    with state_lock:
        consent_id = max([0] + list(consent_responses)) + 7
    emit({'jsonrpc': '2.0', 'id': consent_id, 'method': 'session/request_permission',
          'params': {'sessionId': session_id,
                     'toolCall': {'toolCallId': 'fixture-tool-consent', 'title': 'Fixture write', 'kind': 'edit'},
                     'options': [{'optionId': 'allow-once', 'name': 'Allow once', 'kind': 'allow_once'},
                                 {'optionId': 'reject-once', 'name': 'Reject once', 'kind': 'reject_once'}]}})
    return consent_id


def wait_for_consent(consent_id, seconds):
    deadline = time.time() + seconds
    while time.time() < deadline:
        with state_lock:
            if consent_id in consent_responses:
                return consent_responses[consent_id]
        time.sleep(0.1)
    return {'outcome': {'optionId': 'timeout'}}


for line in sys.stdin:
    try:
        m = json.loads(line)
    except Exception:
        continue
    with open(log, 'a', encoding='utf-8') as f:
        f.write(json.dumps(m) + '\n')
    method = m.get('method', m.get('type'))
    if method == 'initialize':
        reply(m, {'protocolVersion': 1, 'agentCapabilities': {'loadSession': True}})
    elif method == 'session/new':
        reply(m, {'sessionId': 'fixture-native-stable'})
    elif method == 'session/load':
        emit({'jsonrpc': '2.0', 'method': 'session/update', 'params': {'sessionId': m['params']['sessionId'], 'update': {'sessionUpdate': 'agent_message_chunk', 'content': {'type': 'text', 'text': 'FIXTURE_REPLAY_BEFORE_LOAD'}}}})
        reply(m, None)
    elif method in ('session/prompt', 'prompt'):
        text = m['message'] if mode == 'pi' else ''.join(p.get('text', '') for p in m['params']['prompt'])
        threading.Thread(target=turn, args=(m, text), daemon=True).start()
    elif method == 'session/cancel':
        # The client's interrupt: settle the cancel request, then end the held
        # prompt with a cancelled stop so the host journals the cancellation.
        if m.get('id') is not None:
            reply(m, None)
        with state_lock:
            cancel_requested.update(pending_prompt)
    elif 'id' in m and m.get('id') is not None and 'method' not in m:
        # A response to one of our requests — the consent answer.
        with state_lock:
            consent_responses[m['id']] = m.get('result', m)
