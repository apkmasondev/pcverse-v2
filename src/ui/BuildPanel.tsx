import { useEffect, useState } from 'react';
import { ArrowRight, Check, FlaskConical, Power, RotateCcw, Wrench, X } from 'lucide-react';
import { applyFix, buildSteps, connectors, evaluatePost, postStep } from '../atlas/assembly';
import type { BuildState } from '../atlas/assembly';

interface Props {
  state: BuildState;
  reduced: boolean;
  onChange: (state: BuildState) => void;
  onReset: () => void;
  onLab: () => void;
}

const bootLines = [
  'Zasilanie linii 12 V',
  'Inicjalizacja procesora',
  'Trening pamięci DDR5',
  'Szukanie karty graficznej',
];

function PostResult({ state, reduced, onChange, onReset, onLab }: Props) {
  const [booting, setBooting] = useState(!reduced);
  useEffect(() => {
    if (!booting) return;
    const timer = window.setTimeout(() => setBooting(false), 1400);
    return () => window.clearTimeout(timer);
  }, [booting]);
  const issues = evaluatePost(state);
  if (booting)
    return (
      <div className="post-screen booting" role="status" aria-label="Test po włączeniu">
        {bootLines.map((line, i) => (
          <span key={line} style={{ animationDelay: `${i * 0.28}s` }}>
            {line} <i>…</i>
          </span>
        ))}
      </div>
    );
  const issue = issues[0];
  if (!issue)
    return (
      <div className="post-screen ok" role="status">
        <span className="post-code">POST OK · BOOT</span>
        <h2>Komputer żyje.</h2>
        <p>
          Wszystkie podzespoły zgłosiły gotowość, a system uruchomił się bez ostrzeżeń.
          {state.mistakes + state.repairs === 0
            ? ' Montaż bez ani jednej pomyłki: poziom serwisanta.'
            : ` Błędne decyzje: ${state.mistakes}, naprawy po teście: ${state.repairs}.`}
        </p>
        <div className="quiz-actions">
          <button className="btn ghost" onClick={onReset}>
            <RotateCcw size={15} /> <span>Złóż jeszcze raz</span>
          </button>
          <button className="btn primary" onClick={onLab}>
            <span>Laboratorium</span> <FlaskConical size={16} />
          </button>
        </div>
      </div>
    );
  return (
    <div className={`post-screen ${issue.blocking ? 'fail' : 'warn'}`} role="status">
      <span className="post-code">
        {issue.blocking ? 'BRAK STARTU' : 'OSTRZEŻENIE'} · USTERKA{' '}
        {issues.length > 1 ? `1/${issues.length}` : ''}
      </span>
      <h2>{issue.headline}</h2>
      <p>{issue.symptom}</p>
      <aside className="note">
        <span>DIAGNOZA</span>
        <p>{issue.cause}</p>
      </aside>
      <button
        className="btn primary wide"
        onClick={() => {
          onChange({ ...applyFix(state, issue.id), repairs: state.repairs + 1 });
          setBooting(!reduced);
        }}
      >
        <span>{issue.fix} i uruchom ponownie</span>
        <Wrench size={16} />
      </button>
    </div>
  );
}

export default function BuildPanel(props: Props) {
  const { state, onChange, onReset } = props;
  const step = buildSteps[state.step];
  const [pick, setPick] = useState<{ step: number; index: number } | null>(null);
  const picked = pick?.step === state.step ? pick.index : null;
  const option = picked === null ? null : step.options?.[picked];
  const canAdvance = !step.options || option?.correct || option?.proceed;
  const advance = () => onChange({ ...state, step: state.step + 1 });
  const done = state.step === postStep;

  return (
    <div className="panel-body build-panel">
      <div className="panel-kicker">
        <span>KANAŁ 04</span> MONTAŻ
        {state.step > 0 && (
          <button className="link-button push" onClick={onReset}>
            <RotateCcw size={12} /> od nowa
          </button>
        )}
      </div>
      <ol className="build-steps" aria-label="Postęp montażu">
        {buildSteps.map((s, i) => (
          <li
            key={s.id}
            className={i < state.step ? 'done' : i === state.step ? 'current' : ''}
            aria-current={i === state.step ? 'step' : undefined}
          >
            <i />
            <span>{s.short}</span>
          </li>
        ))}
      </ol>

      {done ? (
        <PostResult {...props} key={`${state.repairs}`} />
      ) : (
        <div className="build-step" key={state.step}>
          <span className="build-count">
            KROK {String(state.step + 1).padStart(2, '0')} / {String(postStep).padStart(2, '0')}
          </span>
          <h1 className="display small">{step.title}</h1>
          <p className="lede">{step.text}</p>
          {step.tip && (
            <aside className="note">
              <span>WSKAZÓWKA MONTERA</span>
              <p>{step.tip}</p>
            </aside>
          )}

          {step.options && (
            <div className="quiz build-choice">
              <b className="quiz-question">{step.question}</b>
              <div className="quiz-options">
                {step.options.map((o, i) => {
                  const settled = option?.correct || option?.proceed;
                  return (
                    <button
                      key={o.label}
                      disabled={!!settled}
                      className={
                        picked === i
                          ? o.correct
                            ? 'right'
                            : o.proceed
                              ? 'warned'
                              : 'wrong'
                          : settled
                            ? 'dim'
                            : ''
                      }
                      onClick={() => {
                        setPick({ step: state.step, index: i });
                        if (!o.correct)
                          onChange({ ...state, ...o.patch, mistakes: state.mistakes + 1 });
                        else if (o.patch) onChange({ ...state, ...o.patch });
                      }}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      {o.label}
                      {picked === i && o.correct && <Check size={15} />}
                      {picked === i && !o.correct && !o.proceed && <X size={15} />}
                    </button>
                  );
                })}
              </div>
              {option && (
                <p
                  className={`quiz-feedback-line ${option.correct ? 'right' : option.proceed ? 'warned' : 'wrong'}`}
                  role="status"
                >
                  {option.feedback}
                </p>
              )}
            </div>
          )}

          {step.id === 'power' && (
            <div className="connector-list" role="group" aria-label="Przewody zasilające">
              {connectors.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={state.power[c.id]}
                  onClick={() =>
                    onChange({ ...state, power: { ...state.power, [c.id]: !state.power[c.id] } })
                  }
                >
                  <i className={`led ${state.power[c.id] ? 'on' : ''}`} />
                  <span>
                    <b>{c.label}</b>
                    <small>{c.detail}</small>
                  </span>
                  <em>{state.power[c.id] ? 'PODŁĄCZONY' : 'PODŁĄCZ'}</em>
                </button>
              ))}
            </div>
          )}

          {step.action && canAdvance && (
            <button
              className={`btn wide ${step.id === 'power' ? 'power on' : 'primary'}`}
              onClick={advance}
            >
              <span>{step.action}</span>
              {step.id === 'power' ? <Power size={17} /> : <ArrowRight size={17} />}
            </button>
          )}
          {step.part && !step.options && (
            <p className="panel-tip">Możesz też kliknąć świecący podzespół nad płytą.</p>
          )}
        </div>
      )}
    </div>
  );
}
