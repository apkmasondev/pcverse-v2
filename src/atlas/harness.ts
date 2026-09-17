import { CatmullRomCurve3, Vector3 } from 'three';

/** Cable centres in Blender's Z-up frame. The GPU corridor clears both the
 * rear bracket and the entire fin stack before turning above the power sockets. */
export function harnessPoints(index: number, spread: number): number[][] {
  const bank = Math.floor(index / 8);
  const pin = index % 8;
  const d = ((pin % 4) - 1.5) * 0.045;
  const row = pin < 4 ? -0.035 : 0.035;
  const rise = spread * 1.4;
  const socketX = 1.46 + bank * 0.42 + ((pin % 4) - 1.5) * 0.065;
  return index < 16
    ? [
        // Climb through the gap between the PSU and the GPU tip, then enter
        // each plug vertically. The board and its headers stay clear below.
        [-3.41, 0.03 + bank * 0.41 + d, 0.4 + row],
        [-3.43 - bank * 0.06, 0.16 + bank * 0.41 + d, 0.72],
        [-3.45 - bank * 0.06, 0.35 + bank * 0.35 + d, 1.7 + rise * 0.4],
        [-3.42 - bank * 0.06, 0.76 - row, 2.85 + rise],
        [-3.1 - bank * 0.06, 0.76 - row, 3.27 + rise],
        [-socketX - 0.22, 0.76 - row, 3.39 + rise],
        [-socketX, 0.76 - row, 3.2 + rise],
        [-socketX, 0.76 - row, 2.91 + rise],
      ]
    : [
        [-0.72 - (index - 17.5) * 0.055, -2.43, 0.38],
        [-0.98, -2.3, 0.58],
        [-1.02, -2.08, 0.82 + spread * 1.3],
        [-0.72, -1.95, 0.96 + spread * 2.65],
        [-0.5 - (index - 17.5) * 0.02, -1.9, 0.98 + spread * 2.65],
      ];
}

export function harnessCurve(index: number, spread: number) {
  return new CatmullRomCurve3(
    harnessPoints(index, spread).map(([x, y, z]) => new Vector3(x, z, -y)),
    false,
    'centripetal',
  );
}
