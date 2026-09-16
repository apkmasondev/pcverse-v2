import test from 'node:test';
import assert from 'node:assert/strict';
import { harnessCurve } from '../src/atlas/harness.ts';

test('GPU power wires clear the cooler, fans and rear bracket throughout disassembly', () => {
  for (let s = 0; s <= 20; s++) {
    const spread = s / 20;
    for (let i = 0; i < 16; i++) {
      const curve = harnessCurve(i, spread);
      const points = curve.getPoints(600);
      const end = curve.getPoint(1);
      // TubeGeometry connects arc-length samples with straight triangles;
      // test those chords in both quality modes as well as the smooth curve.
      for (const segments of [28, 48]) {
        const centres = curve.getSpacedPoints(segments);
        for (let j = 1; j < centres.length; j++) {
          for (let k = 1; k < 8; k++) points.push(centres[j - 1].clone().lerp(centres[j], k / 8));
        }
      }
      // Include wire radius plus a visible air gap around the entire GPU envelope.
      for (const p of points) {
        const x = p.x,
          y = -p.z,
          z = p.y - spread * 1.4;
        const inside = x > -2.62 && x < 3.24 && y > -1.39 && y < -0.4 && z > 0.12 && z < 2.65;
        assert.ok(!inside, `wire ${i}, spread ${spread}, point ${[x, y, z]}`);
        const boardCollision =
          x > -2.5 && x < 2.5 && y > -3.13 && y < 3.13 && p.y > -0.1 && p.y < 0.8;
        assert.ok(
          !boardCollision,
          `GPU wire enters motherboard/headers: wire ${i}, spread ${spread}, ${[x, y, p.y]}`,
        );
      }
      assert.ok(
        Math.abs(end.y - (2.91 + spread * 1.4)) < 0.00001,
        'wire must meet the plug outlet',
      );
    }
  }
});

test('CPU fan lead remains connected to its moving outlet', () => {
  for (const spread of [0, 0.5, 1]) {
    for (let i = 16; i < 20; i++) {
      const curve = harnessCurve(i, spread);
      assert.ok(Math.abs(curve.getPoint(0).y - 0.38) < 0.00001);
      assert.ok(Math.abs(curve.getPoint(1).y - (0.98 + spread * 2.65)) < 0.00001);
    }
  }
});
