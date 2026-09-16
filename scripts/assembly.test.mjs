import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFix,
  buildSteps,
  evaluatePost,
  initialBuild,
  installedParts,
  pendingPart,
  postStep,
} from '../src/atlas/assembly.ts';

const allPower = { atx: true, eps: true, pcie: true, fan: true };

test('steps follow a real build order and end with the power-on test', () => {
  assert.deepEqual(
    buildSteps.map((s) => s.id),
    ['cpu', 'paste', 'cooler', 'ram', 'ssd', 'gpu', 'power', 'post'],
  );
  assert.equal(postStep, buildSteps.length - 1);
});

test('every decision point has exactly one correct answer', () => {
  for (const step of buildSteps.filter((s) => s.options)) {
    assert.equal(step.options.filter((o) => o.correct).length, 1, step.id);
    assert.ok(step.question, step.id);
  }
});

test('parts are lowered in order and nothing is pending during power steps', () => {
  assert.equal(pendingPart(initialBuild), 'cpu');
  assert.deepEqual(installedParts(initialBuild), []);
  const beforeRam = { ...initialBuild, step: 3 };
  assert.deepEqual(installedParts(beforeRam), ['cpu', 'cooler']);
  assert.equal(pendingPart(beforeRam), 'ram');
  const power = { ...initialBuild, step: 6 };
  assert.deepEqual(installedParts(power), ['cpu', 'cooler', 'ram', 'ssd', 'gpu']);
  assert.equal(pendingPart(power), null);
});

test('a complete build passes the power-on test', () => {
  assert.deepEqual(evaluatePost({ paste: true, power: allPower }), []);
});

test('faults are reported in the order a real machine reveals them', () => {
  const issues = evaluatePost({ paste: false, power: { ...allPower, eps: false, fan: false } });
  assert.deepEqual(
    issues.map((i) => i.id),
    ['eps', 'fan', 'paste'],
  );
  assert.equal(issues.at(-1).blocking, false, 'missing paste still boots');
  assert.equal(evaluatePost({ paste: true, power: { ...allPower, atx: false } })[0].id, 'atx');
});

test('each suggested fix resolves exactly its fault', () => {
  let state = { ...initialBuild, step: postStep };
  for (const issue of evaluatePost(state)) {
    const before = evaluatePost(state).length;
    state = applyFix(state, issue.id);
    assert.equal(evaluatePost(state).length, before - 1, issue.id);
  }
  assert.deepEqual(evaluatePost(state), []);
});
