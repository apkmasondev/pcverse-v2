import { parts } from '../atlas/content';
import type { Mode, PartId, Workload } from '../atlas/content';
import type { BuildView } from '../atlas/assembly';
import PartGlyph from './PartGlyph';

const W = 960,
  H = 680;
// Top view of the exhibit, laid out after the model's footprint (1 scene unit ≈ 100 px).
const boxes: Record<PartId, [number, number, number, number]> = {
  psu: [40, 150, 260, 310],
  board: [350, 40, 490, 600],
  cooler: [505, 62, 170, 96],
  cpu: [540, 182, 100, 100],
  ram: [745, 80, 64, 270],
  gpu: [360, 398, 548, 76],
  ssd: [470, 528, 200, 54],
};
type Trace = 'ssd-ram' | 'ram-cpu' | 'cpu-gpu' | 'psu-board' | 'cpu-cooler';
const traces: Record<Trace, { d: string; kind: 'data' | 'power' | 'heat'; ends: PartId[] }> = {
  'ssd-ram': { d: 'M670 555 H725 V300 H745', kind: 'data', ends: ['ssd', 'ram'] },
  'ram-cpu': { d: 'M745 232 H640', kind: 'data', ends: ['ram', 'cpu'] },
  'cpu-gpu': { d: 'M590 282 V398', kind: 'data', ends: ['cpu', 'gpu'] },
  'psu-board': {
    d: 'M300 250 H350 M300 330 H322 V620 H430 V640',
    kind: 'power',
    ends: ['psu', 'board'],
  },
  'cpu-cooler': { d: 'M570 182 V158 M610 182 V158', kind: 'heat', ends: ['cpu', 'cooler'] },
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
            ? [
                workload === 'game' ? 'cpu-gpu' : workload === 'render' ? 'ram-cpu' : 'ssd-ram',
                'cpu-cooler',
              ]
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
            d="M380 500 H720 M380 506 H720 M770 80 V350 M780 80 V350 M390 120 H470 M390 140 H470 M390 160 H470"
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
