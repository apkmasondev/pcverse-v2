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
test('thermal view follows the lab model', async () => {
  const { heatMap } = await import('../src/atlas/simulation.ts');
  const view = (setup) => heatMap(setup, simulate(setup));
  const running = view(base),
    idle = view({ ...base, running: false });
  assert.ok(running.cpu.high > idle.cpu.high, 'a running task heats the CPU');
  assert.ok(running.gpu.high > idle.gpu.high, 'a running game heats the GPU');
  const stillAir = view({ ...base, airflow: 0 }),
    strongAir = view({ ...base, airflow: 100 });
  assert.ok(stillAir.cooler.high > strongAir.cooler.high, 'airflow cools the fin stack');
  assert.ok(running.cooler.low > running.cooler.high, 'the base is hotter than the fins');
  const swapping = view({ ...base, workload: 'tabs', memory: 8 });
  assert.ok(swapping.ssd.high > running.ssd.high, 'RAM shortage keeps the SSD busy');
  assert.ok(running.ram.high > idle.ram.high + 8, 'working memory warms up');
  assert.ok(running.ssd.high > idle.ssd.high + 5, 'the SSD warms under I/O');
  assert.ok(running.psu.low > idle.psu.low + 5, 'the PSU warms with the power it delivers');
  assert.ok(swapping.ram.high > running.ram.high, 'a full RAM runs hotter');
  for (const part of Object.values(stillAir))
    assert.ok(part.low >= 20 && part.high <= 100, 'within the thermal scale');
});
