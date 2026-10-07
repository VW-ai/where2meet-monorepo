import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, mkdir, readFile, rm, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, cleanupOwned, cleanupSaved } from './staging-browser.mjs';

const origin = 'https://where2meet-server-staging.up.railway.app';
function args(dir) { return ['--backend-origin', origin, '--client-origin', 'http://127.0.0.1:4317', '--backend-sha', 'a'.repeat(40), '--frontend-sha', 'b'.repeat(40), '--deployment-id', '12345678-1234-1234-1234-123456789abc', '--run-dir', dir, '--run-id', 'unique-run-123']; }
test('CLI accepts private runs and rejects a production target or public directory', async () => {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'staging-browser-test-')));
  try {
    await chmod(dir, 0o700);
    const input = args(dir);
    assert.equal((await parseArgs(input))['run-id'], 'unique-run-123');
    const wrong = [...input]; wrong[1] = 'https://where2meet-server.up.railway.app';
    await assert.rejects(parseArgs(wrong), /Invalid backend origin/);
    await assert.rejects(parseArgs([...input, '--run-id', 'duplicate']), /Invalid arguments/);
    await chmod(dir, 0o755);
    await assert.rejects(parseArgs(input), /private and owned/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('cleanup proves absence even when authenticated deletion loses its response', async () => {
  let live = true;
  const receipt = { event_id: 'evt_test_owned', participant_token: 'pt_' + 'c'.repeat(64) };
  const result = await cleanupOwned(receipt, async (url, options = {}) => {
    assert.equal(url, origin + '/api/events/evt_test_owned');
    if (options.method === 'DELETE') {
      if (options.headers.authorization === 'Bearer pt_' + 'c'.repeat(64)) live = false;
      throw new Error('Connection lost after mutation');
    }
    return { status: live ? 200 : 404 };
  });
  assert.deepEqual(result, { status: 'PASS', owned_event: true, delete_status: null, get_status: 404, absent: true });
  const failed = await cleanupOwned(receipt, async () => ({ status: 503 }));
  assert.deepEqual(failed, { status: 'FAIL', owned_event: true, delete_status: 503, get_status: 503, absent: false });
});
test('interrupted-run cleanup writes only sanitized evidence under evidence/', async () => {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'staging-browser-test-')));
  try {
    await chmod(dir, 0o700);
    await mkdir(path.join(dir, 'evidence'), { mode: 0o700 });
    const receipt = { event_id: 'evt_test_owned', participant_token: 'pt_' + 'c'.repeat(64) };
    await writeFile(path.join(dir, 'receipt.json'), JSON.stringify(receipt), { mode: 0o600 });
    const config = await parseArgs(args(dir));
    const cleanup = await cleanupSaved(config, async (_url, options = {}) => ({ status: options.method === 'DELETE' ? 200 : 404 }));
    assert.equal(cleanup.status, 'PASS');
    assert.equal(cleanup.absent, true);
    const evidence = JSON.parse(await readFile(path.join(dir, 'evidence', 'cleanup.json'), 'utf8'));
    assert.equal(evidence.identity.deployment_id, config['deployment-id']);
    assert.equal(evidence.participant_token, undefined);
    await assert.rejects(readFile(path.join(dir, 'cleanup.json'), 'utf8'), { code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
