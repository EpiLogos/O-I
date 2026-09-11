#!/usr/bin/env python3
"""A controlled A2A v1 peer agent for the desktop walk (D/C fixture).

Speaks the same wire the portable floor's own conformance tests assert:
Agent Card at /.well-known/agent-card.json advertising the interface at
/a2a, message exchange at /a2a/message:send with application/a2a+json.
Requests are logged as JSON lines so the walk can prove exactly what
arrived (and that nothing arrived before the human sent anything).

Usage: a2a-peer.py PORT LOGFILE [mismatch]
  mismatch — the card advertises a DIFFERENT endpoint than the binding
  will carry, so the floor's interface check must refuse the exchange.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REPLY = "The peer agent's returned difference for the A2A vertical"


def main():
    port = int(sys.argv[1])
    log_path = sys.argv[2]
    mismatch = len(sys.argv) > 3 and sys.argv[3] == "mismatch"
    # The card must advertise the ACTUALLY bound port (the walk passes 0 and
    # reads the announced one), resolved once the server exists.
    bound = {"port": port}

    class Handler(BaseHTTPRequestHandler):
        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, A2A-Version")

        def _log(self, body=None):
            entry = {
                "method": self.command,
                "url": self.path,
                "content_type": self.headers.get("Content-Type"),
                "accept": self.headers.get("Accept"),
                "a2a_version": self.headers.get("A2A-Version"),
                "body": body,
            }
            with open(log_path, "a") as log:
                log.write(json.dumps(entry) + "\n")

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_GET(self):
            if self.path == "/.well-known/agent-card.json":
                advertised = "http://127.0.0.1:1/a2a" if mismatch else f"http://127.0.0.1:{bound['port']}/a2a"
                card = {
                    "name": "agent:a2a-peer-walk" if not mismatch else "agent:a2a-mismatch-walk",
                    "description": "Controlled walk fixture peer",
                    "version": "1.0.0-fixture",
                    "supportedInterfaces": [{
                        "url": advertised,
                        "protocolBinding": "HTTP+JSON",
                        "protocolVersion": "1.0",
                    }],
                }
                self._log()
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(card).encode())
                return
            self.send_response(404)
            self._cors()
            self.end_headers()

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}") if length else {}
            if not self.path.endswith("/message:send"):
                self.send_response(404)
                self._cors()
                self.end_headers()
                return
            self._log(body)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/a2a+json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "task": {
                    "id": "a2a-task:peer-1",
                    "contextId": "ctx:peer",
                    "status": {"state": "TASK_STATE_COMPLETED"},
                    "artifacts": [{"artifactId": "artifact:peer-1", "name": "result", "parts": [{"text": REPLY}]}],
                },
            }).encode())

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    bound["port"] = server.server_address[1]
    print(f"LISTENING {server.server_address[1]}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
