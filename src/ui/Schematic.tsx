import { activeStep, parts } from '../atlas/content';
import type { Mode, PartId, Workload } from '../atlas/content';
import type { BuildView } from '../atlas/assembly';
import PartGlyph from './PartGlyph';

const W = 960,
  H = 680;
// Top view of the exhibit, laid out after the model's footprint (1 scene unit ≈ 100 px).
// The board faces its rear I/O away from the PSU, so the socket sits low and the GPU tip
// reaches towards the PSU, as in the 3D model.
const boxes: Record<PartId, [number, number, number, number]> = {
  psu: [14, 150, 240, 310],
  board: [350, 40, 490, 600],
  cooler: [515, 522, 170, 96],
  cpu: [550, 398, 100, 100],
  ram: [381, 330, 64, 270],
  gpu: [282, 206, 548, 76],
  ssd: [520, 98, 200, 54],
};
type Trace = 'ssd-ram' | 'ram-cpu' | 'cpu-gpu' | 'psu-board' | 'cpu-cooler';
const traces: Record<Trace, { d: string; kind: 'data' | 'power' | 'heat'; ends: PartId[] }> = {
  'ssd-ram': { d: 'M520 125 H465 V380 H445', kind: 'data', ends: ['ssd', 'ram'] },
  'ram-cpu': { d: 'M445 448 H550', kind: 'data', ends: ['ram', 'cpu'] },
  'cpu-gpu': { d: 'M600 398 V282', kind: 'data', ends: ['cpu', 'gpu'] },
  'psu-board': {
    d: 'M254 300 H300 V405 H368 M254 400 H290 V652 H690 V623',
    kind: 'power',
    ends: ['psu', 'board'],
  },
  'cpu-cooler': { d: 'M580 498 V522 M620 498 V522', kind: 'heat', ends: ['cpu', 'cooler'] },
};
const stepTraces: Trace[][] = [['ssd-ram'], ['ram-cpu'], ['cpu-gpu'], ['psu-board', 'cpu-cooler']];

interface Props {
  selected: PartId | null;
  hovered: PartId | null;
  onSelect: (id: PartId) => void;
  onHover: (id: PartId | null) => void;
  mode: Mode;
  step: number;
  running: boolean;
  workload: Workload;
  build: BuildView | null;
}

export default function Schematic({
  selected,
  hovered,
  onSelect,
  onHover,
  mode,
  step,
  running,
  workload,
  build,
}: Props) {
  const lit = new Set<Trace>(
    build
      ? [
          ...(build.power.atx ? (['psu-board'] as const) : []),
          ...(build.paste && build.installed.includes('cooler') ? (['cpu-cooler'] as const) : []),
        ]
      : mode === 'signal'
        ? stepTraces[step]
        : mode === 'lab'
          ? running
            ? [...stepTraces[activeStep(mode, step, workload)], 'cpu-cooler']
            : []
          : (Object.keys(traces) as Trace[]).filter((t) =>
              traces[t].ends.some((e) => e === (hovered ?? selected)),
            ),
  );
  const litParts = new Set<PartId>([...lit].flatMap((t) => traces[t].ends));
  return (
    <div className="schematic">
      <div className="schematic-board" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" className="sch-dot" />
            </pattern>
          </defs>
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="14" className="sch-plinth" />
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="14" fill="url(#dots)" />
          <rect x="350" y="40" width="490" height="600" rx="6" className="sch-pcb" />
          {[
            [366, 56],
            [824, 56],
            [366, 624],
            [824, 624],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" className="sch-hole" />
          ))}
          <path
            d="M810 180 H470 M810 174 H470 M420 600 V330 M410 600 V330 M800 560 H720 M800 540 H720 M800 520 H720"
            className="sch-silk"
          />
          <text x="386" y="62" className="sch-text">
            MB1 · ATX
          </text>
          {(Object.keys(traces) as Trace[]).map((t) => (
            <path
              key={t}
              d={traces[t].d}
              className={`sch-trace ${traces[t].kind} ${lit.has(t) ? 'lit' : ''}`}
            />
          ))}
        </svg>
        {parts
          .filter((p) => p.id !== 'board')
          .map((p) => {
            const [x, y, w, h] = boxes[p.id];
            return (
              <button
                key={p.id}
                className={`sch-part sch-${p.id} ${selected === p.id ? 'selected' : ''} ${hovered === p.id ? 'hover' : ''} ${build ? (build.pending === p.id ? 'lit' : build.installed.includes(p.id) || p.id === 'psu' ? '' : 'dim') : mode !== 'anatomy' && litParts.has(p.id) ? 'lit' : ''}`}
                style={{
                  left: `${(x / W) * 100}%`,
                  top: `${(y / H) * 100}%`,
                  width: `${(w / W) * 100}%`,
                  height: `${(h / H) * 100}%`,
                }}
                onClick={() => onSelect(p.id)}
                onPointerEnter={() => onHover(p.id)}
                onPointerLeave={() => onHover(null)}
                aria-pressed={selected === p.id}
                aria-label={`${p.name} (${p.ref})`}
              >
                <PartGlyph id={p.id} size={18} />
                <span>{p.label}</span>
                <small>{p.ref}</small>
              </button>
            );
          })}
        <button
          className={`sch-board-tag ${selected === 'board' ? 'selected' : ''}`}
          style={{ left: `${(700 / W) * 100}%`, top: `${(592 / H) * 100}%` }}
          onClick={() => onSelect('board')}
          onPointerEnter={() => onHover('board')}
          onPointerLeave={() => onHover(null)}
          aria-pressed={selected === 'board'}
          aria-label="Płyta główna (MB1)"
        >
          <PartGlyph id="board" size={16} /> MB
        </button>
      </div>
      <p className="schematic-legend">
        <span className="lg data" /> dane <span className="lg power" /> zasilanie{' '}
        <span className="lg heat" /> ciepło <em>Widok z góry, skala umowna</em>
      </p>
    </div>
  );
}
