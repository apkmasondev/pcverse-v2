import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/atlas/simulation.ts';
const base = { workload: 'game', resolution: 1, memory: 16, airflow: 65, running: true };
test('higher resolution increases GPU load and reduces FPS', () => {
  const low = simulate({ ...base, resolution: 0 }),
    high = simulate({ ...base, resolution: 2 });
  assert.ok(high.gpu > low.gpu);
  assert.ok(high.score < low.score);
  assert.equal(high.cpu, low.cpu);
});
test('insufficient RAM slows applications; surplus RAM does not improve them', () => {
  const low = simulate({ ...base, workload: 'tabs', memory: 8 }),
    enough = simulate({ ...base, workload: 'tabs', memory: 32 });
  assert.ok(low.pressure > 0);
  assert.equal(enough.pressure, 0);
  assert.ok(enough.score > low.score);
  assert.equal(simulate({ ...base, memory: 16 }).score, simulate({ ...base, memory: 32 }).score);
});
test('airflow removes the thermal limit under CPU rendering', () => {
  const hot = simulate({ ...base, workload: 'render', airflow: 0 }),
    cool = simulate({ ...base, workload: 'render', airflow: 100 });
  assert.ok(hot.throttling);
  assert.ok(!cool.throttling);
  assert.ok(hot.temperature > cool.temperature);
  assert.ok(hot.score < cool.score);
  assert.ok(hot.watts < cool.watts, 'CPU throttling must also reduce estimated CPU power');
});
test('resolution has no effect on CPU rendering or application workloads', () => {
  for (const workload of ['tabs', 'render'])
    assert.deepEqual(
      simulate({ ...base, workload, resolution: 0 }),
      simulate({ ...base, workload, resolution: 2 }),
    );
});
test('stopped workloads report idle state and no RAM pressure', () => {
  const idle = simulate({ ...base, workload: 'render', airflow: 0, memory: 8, running: false });
  assert.equal(idle.score, 0);
  assert.equal(idle.pressure, 0);
  assert.equal(idle.throttling, false);
  assert.equal(idle.temperature, 29);
});
test('all offered configurations are finite, bounded and below PSU rating', () => {
  for (const workload of ['game', 'render', 'tabs'])
    for (const resolution of [0, 1, 2])
      for (const memory of [8, 16, 32])
        for (const airflow of Array.from({ length: 21 }, (_, i) => i * 5)) {
          const result = simulate({ ...base, workload, resolution, memory, airflow });
          for (const key of ['cpu', 'gpu', 'watts', 'temperature', 'score'])
            assert.ok(Number.isFinite(result[key]));
          assert.ok(
            result.cpu <= 100 && result.gpu <= 100 && result.score >= 0 && result.watts < 650,
          );
        }
});
