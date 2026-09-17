import type { CSSProperties } from 'react';
import { Power, RotateCcw, Thermometer } from 'lucide-react';
import { workloadHints, workloads } from '../atlas/content';
import type { Workload } from '../atlas/content';

interface Props {
  workload: Workload;
  resolution: number;
  memory: number;
  airflow: number;
  running: boolean;
  onWorkload: (w: Workload) => void;
  onResolution: (n: number) => void;
  onMemory: (n: number) => void;
  onAirflow: (n: number) => void;
  onRun: () => void;
  onReset: () => void;
  thermal: boolean;
  onThermal: () => void;
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function LabPanel(props: Props) {
  const { workload, resolution, memory, airflow, running } = props;
  return (
    <div className="panel-body lab-panel">
      <div className="panel-kicker">
        <span>KANAŁ 03</span> LABORATORIUM
      </div>
      <h1 className="display small">
        Co spowalnia <em>maszynę?</em>
      </h1>
      <p className="lede">
        Jedna zmiana, widoczna konsekwencja. Znajdź miejsce, w którym kończy się zapas mocy.
      </p>

      <div className="field">
        <span className="field-label">
          <b>A</b> Zadanie
        </span>
        <div className="workloads" role="group" aria-label="Rodzaj zadania">
          {workloads.map((w) => (
            <button
              key={w.id}
              aria-pressed={workload === w.id}
              onClick={() => props.onWorkload(w.id)}
            >
              <small>{w.short}</small>
              {w.name}
            </button>
          ))}
        </div>
        <p className="panel-tip accent">Spróbuj: {workloadHints[workload]}</p>
      </div>

      <div className="field">
        <span className="field-label">
          <b>B</b> Rozdzielczość gry
          {workload !== 'game' && <em>nie dotyczy</em>}
        </span>
        <Segmented
          label="Rozdzielczość gry"
          value={resolution}
          disabled={workload !== 'game'}
          onChange={props.onResolution}
          options={[
            { value: 0, label: '1080p' },
            { value: 1, label: '1440p' },
            { value: 2, label: '4K' },
          ]}
        />
      </div>

      <div className="field">
        <span className="field-label">
          <b>C</b> Pojemność RAM
        </span>
        <Segmented
          label="Pojemność RAM"
          value={memory}
          onChange={props.onMemory}
          options={[8, 16, 32].map((n) => ({ value: n, label: `${n} GB` }))}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="airflow">
          <b>D</b> Przepływ powietrza <output htmlFor="airflow">{airflow}%</output>
        </label>
        <input
          id="airflow"
          className="fader"
          type="range"
          min="0"
          max="100"
          step="5"
          value={airflow}
          style={{ '--fill': `${airflow}%` } as CSSProperties}
          onChange={(e) => props.onAirflow(+e.target.value)}
        />
        <div className="fader-scale" aria-hidden="true">
          <span>STOP</span>
          <span>CICHO</span>
          <span>MAX</span>
        </div>
      </div>

      <button
        className="btn ghost wide thermal-toggle"
        aria-pressed={props.thermal}
        onClick={props.onThermal}
      >
        <Thermometer size={16} />
        <span>{props.thermal ? 'Wyłącz termowizję' : 'Termowizja'}</span>
        <kbd>T</kbd>
      </button>

      <div className="lab-actions">
        <button
          className={`btn power ${running ? 'on' : ''}`}
          aria-pressed={running}
          onClick={props.onRun}
        >
          <Power size={18} />
          <span>{running ? 'Zatrzymaj zadanie' : 'Uruchom zadanie'}</span>
          <kbd>Spacja</kbd>
        </button>
        <button
          className="icon-button"
          aria-label="Resetuj eksperyment"
          title="Resetuj eksperyment"
          onClick={props.onReset}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <small className="disclaimer">
        Model edukacyjny, niezależny od oznaczeń na eksponacie. Temperatura pokazuje umowny stan po
        rozgrzaniu, nie przebieg w czasie. Wartości nie są benchmarkiem sprzętu.
      </small>
    </div>
  );
}
