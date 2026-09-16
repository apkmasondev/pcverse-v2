import { buildSteps, connectors, evaluatePost, postStep } from '../atlas/assembly';
import type { BuildState } from '../atlas/assembly';

const partRows = [
  { id: 'cpu', label: 'Procesor', detail: 'U1 · gniazdo LGA' },
  { id: 'paste', label: 'Pasta termoprzewodząca', detail: 'cienka warstwa' },
  { id: 'cooler', label: 'Chłodzenie wieżowe', detail: 'FAN1 · wydmuch do tyłu' },
  { id: 'ram', label: 'Pamięć 2 × DIMM', detail: 'A2 + B2 · dwa kanały' },
  { id: 'ssd', label: 'Dysk M.2 NVMe', detail: 'M2_1 · linie PCIe' },
  { id: 'gpu', label: 'Karta graficzna', detail: 'PCIE1 · x16 z procesora' },
] as const;

export default function BuildChecklist({ state }: { state: BuildState }) {
  const stepIndex = (id: string) => buildSteps.findIndex((s) => s.id === id);
  const finished = state.step === postStep;
  const issues = evaluatePost(state);
  const status = !finished
    ? 'MONTAŻ W TOKU'
    : issues.length === 0
      ? 'POST OK'
      : issues[0].blocking
        ? 'BRAK STARTU'
        : 'OSTRZEŻENIE';
  const done =
    partRows.filter((r) => stepIndex(r.id) < state.step).length +
    connectors.filter((c) => state.power[c.id]).length;
  return (
    <div className="telemetry checklist">
      <div className="telemetry-head">
        <span className={`led ${finished && issues.length === 0 ? 'on' : ''}`} />
        LISTA KONTROLNA
        <span className={`tag ${finished ? (issues.length ? 'bad' : 'good') : ''}`}>{status}</span>
      </div>
      <div className="checklist-progress" aria-label={`Ukończono ${done} z 10 czynności`}>
        <b>
          {String(done).padStart(2, '0')}
          <i>/10</i>
        </b>
        <div>
          <i style={{ width: `${done * 10}%` }} />
        </div>
      </div>
      <section>
        <h3>PODZESPOŁY</h3>
        <ul>
          {partRows.map((row) => {
            const passed = stepIndex(row.id) < state.step;
            const skipped = row.id === 'paste' && passed && !state.paste;
            const current = stepIndex(row.id) === state.step;
            return (
              <li
                key={row.id}
                className={skipped ? 'warn' : passed ? 'done' : current ? 'current' : ''}
              >
                <i className="led" />
                <span>
                  {row.label}
                  <small>{skipped ? 'pominięta' : row.detail}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3>ZASILANIE</h3>
        <ul>
          {connectors.map((c) => (
            <li key={c.id} className={state.power[c.id] ? 'done' : ''}>
              <i className="led" />
              <span>
                {c.label}
                <small>{c.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="readout-row">
        <span>BŁĘDNE DECYZJE</span>
        <b>{state.mistakes}</b>
        <span>NAPRAWY PO TEŚCIE</span>
        <b>{state.repairs}</b>
      </div>
    </div>
  );
}
