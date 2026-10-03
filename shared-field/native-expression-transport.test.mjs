import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:net';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {nativeExpressionRequest} from './scripts/native-expression-transport.mjs';

test('partial bytes on an actual socket cannot extend the native request deadline', {skip: process.platform === 'win32', timeout: 25000}, async () => {
  const directory = await mkdtemp('/tmp/oi-expression-deadline-');
  const path = join(directory, 'native.sock');
  const sockets = new Set();
  const intervals = new Set();
  const ownerDeadline = setTimeout(() => {for (const socket of sockets) socket.destroy();}, 18000);
  // This is a real transport fault producer, with no invented owner reply.
  // Its partial bytes keep the socket active while withholding a receipt.
  const server = createServer({allowHalfOpen: true}, socket => {
    sockets.add(socket);
    socket.on('data', () => {});
    socket.on('error', () => {});
    socket.write(' ');
    const interval = setInterval(() => socket.write(' '), 250);
    intervals.add(interval);
    socket.once('close', () => {clearInterval(interval); intervals.delete(interval); sockets.delete(socket);});
  });
  try {
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(path, resolve);});
    const started = performance.now();
    await assert.rejects(nativeExpressionRequest(path, {operation: 'inspect', expression_ref: 'expression:deadline'}), /acceptance must be inspected before repeating an effect/);
    const elapsed = performance.now() - started;
    assert.ok(elapsed >= 14500 && elapsed < 20000, `Actual request deadline was ${elapsed}ms`);
  } finally {
    clearTimeout(ownerDeadline);
    for (const interval of intervals) clearInterval(interval);
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, {recursive: true, force: true});
  }
});
