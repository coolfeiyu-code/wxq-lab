import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('版本号只有 VERSION 这一处来源', () => {
  const version = readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const rootPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const uiPkg = JSON.parse(readFileSync(path.join(root, 'ui/package.json'), 'utf8'));
  const publicVersion = JSON.parse(readFileSync(path.join(root, 'ui/public/version.json'), 'utf8'));
  assert.equal(rootPkg.version, version);
  assert.equal(uiPkg.version, version);
  assert.equal(publicVersion.version, version);
});
