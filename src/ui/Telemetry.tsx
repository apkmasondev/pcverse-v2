import { Trash2 } from 'lucide-react';
import type { Workload } from '../atlas/content';
import type { simulate } from '../atlas/simulation';
import { useCountUp } from '../hooks/useCountUp';

type Result = ReturnType<typeof simulate>;
export interface Measurement {
  id: number;
  workload: Workload;
  resolution: number;
  memory: number;
  airflow: number;
  score: number;
  temperature: number;
  watts: number;
  throttling: boolean;
  bottleneck: string;
}

const T_MIN = 20,
  T_MAX = 110,
  SWEEP = 240;
function polar(angle: number, r: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [60 + r * Math.cos(rad), 62 + r * Math.sin(rad)];
}
function arc(from: number, to: number, r: number) {
  const [x1, y1] = polar(from, r),
    [x2, y2] = polar(to, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
const angleOf = (t: number) =>
  -SWEEP / 2 + ((Math.min(T_MAX, Math.max(T_MIN, t)) - T_MIN) / (T_MAX - T_MIN)) * SWEEP;

function Gauge({ value, hot }: { value: number; hot: boolean }) {
  const end = angleOf(value);
  const limit = angleOf(90);
  const [lx1, ly1] = polar(limit, 40),
    [lx2, ly2] = polar(limit, 55);
  return (
    <svg className={`gauge ${hot ? 'hot' : ''}`} viewBox="0 0 120 104" aria-hidden="true">
      <path d={arc(-SWEEP / 2, SWEEP / 2, 48)} className="gauge-track" />
      <path d={arc(limit, SWEEP / 2, 48)} className="gauge-danger" />
      {end > -SWEEP / 2 + 0.5 && <path d={arc(-SWEEP / 2, end, 48)} className="gauge-value" />}
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} className="gauge-limit" />
      <text x="60" y="66" className="gauge-number">
        {value}
      </text>
      <text x="60" y="82" className="gauge-unit">
        °C CPU
      </text>
      <text x={polar(limit, 60)[0] + 4} y={polar(limit, 60)[1] - 2} className="gauge-tick">
        90
      </text>
    </svg>
  );
}

function Bar({ name, value }: { name: string; value: number }) {
  const lit = Math.round(value / 5);
  return (
    <div className="led-bar">
      <span>{name}</span>
      <div aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => (
          <i key={i} className={i < lit ? (i >= 17 ? 'on hot' : i >= 13 ? 'on warm' : 'on') : ''} />
        ))}
      </div>
      <b>{value}%</b>
    </div>
  );
}

const shortWorkload: Record<Workload, string> = { game: 'GRA', render: 'RENDER', tabs: 'APLIK.' };

export default function Telemetry({
  result,
  workload,
  running,
  reduced,
  log,
  onClearLog,
}: {
  result: Result;
  workload: Workload;
  running: boolean;
  reduced: boolean;
  log: Measurement[];
  onClearLog: () => void;
}) {
  const score = useCountUp(result.score, reduced);
  const temperature = useCountUp(result.temperature, reduced);
  const watts = useCountUp(result.watts, reduced);
  return (
    <div className="telemetry">
      <div className="telemetry-head">
        <span className={`led ${running ? 'on' : ''}`} />
        {running ? 'ZADANIE W TOKU' : 'STAN SPOCZYNKU'}
        <span className="tag">SYMULACJA</span>
      </div>
      <div className="telemetry-main">
        <div className="score">
          <small>{workload === 'game' ? 'PŁYNNOŚĆ (PRZYKŁAD)' : 'INDEKS WYDAJNOŚCI'}</small>
          <b>{score}</b>
          <span>{workload === 'game' ? 'FPS' : 'PKT'}</span>
        </div>
        <Gauge value={temperature} hot={result.throttling} />
      </div>
      <Bar name="CPU" value={result.cpu} />
      <Bar name="GPU" value={result.gpu} />
      <div className="readout-row">
        <span>MOC PODZESPOŁÓW</span>
        <b>
          {watts}
          <small> W</small>
        </b>
        <span>ZAPAS PSU</span>
        <b>
          {650 - result.watts}
          <small> W</small>
        </b>
      </div>
      <div className={`diagnosis ${result.throttling ? 'hot' : ''}`} aria-live="polite">
        <span>{result.throttling ? '↓ OCHRONA TERMICZNA' : 'DIAGNOZA'}</span>
        <h3>{result.bottleneck}</h3>
        <p>{result.explanation}</p>
      </div>
      <div className="log">
        <div className="log-head">
          <span>DZIENNIK POMIARÓW</span>
          {log.length > 0 && (
            <button
              className="link-button"
              onClick={onClearLog}
              aria-label="Wyczyść dziennik pomiarów"
            >
              <Trash2 size={12} /> wyczyść
            </button>
          )}
        </div>
        {log.length === 0 ? (
          <p className="log-empty">
            Uruchom zadanie i zmieniaj ustawienia. Każda nowa konfiguracja zapisze się tutaj do
            porównania.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>USTAWIENIA</th>
                <th>WYNIK</th>
                <th>Δ</th>
                <th>°C</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m, i) => {
                const before = log[i + 1];
                const delta = before && before.workload === m.workload ? m.score - before.score : 0;
                return (
                  <tr key={m.id} className={m.throttling ? 'hot' : ''}>
                    <td>
                      {shortWorkload[m.workload]}
                      {m.workload === 'game' && ` ${['1080p', '1440p', '4K'][m.resolution]}`} ·{' '}
                      {m.memory}GB · {m.airflow}%
                    </td>
                    <td>{m.score}</td>
                    <td>
                      {delta !== 0 && (
                        <em className={delta > 0 ? 'up' : 'down'}>
                          {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                        </em>
                      )}
                    </td>
                    <td>{m.temperature}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
