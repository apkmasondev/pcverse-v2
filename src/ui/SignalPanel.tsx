import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FlaskConical, RotateCcw, X } from 'lucide-react';
import { quiz, steps } from '../atlas/content';

const nodes = [
  { id: 'ssd', label: 'SSD', x: 24 },
  { id: 'ram', label: 'RAM', x: 92 },
  { id: 'cpu', label: 'CPU', x: 160 },
  { id: 'gpu', label: 'GPU', x: 228 },
  { id: 'out', label: 'EKRAN', x: 296 },
];
const litNodes = [['ssd', 'ram'], ['ram', 'cpu'], ['cpu', 'gpu', 'out'], ['cpu']];

function Bus({ step }: { step: number }) {
  const lit = litNodes[step];
  return (
    <svg className="bus" viewBox="0 0 320 112" aria-hidden="true">
      <path d="M24 38 H296" className="bus-rail" />
      {step < 3 && (
        <path
          d={`M${nodes[step].x} 38 H${nodes[step + 1].x + (step === 2 ? 68 : 0)}`}
          className="bus-flow"
        />
      )}
      <path d="M92 92 H160 V58" className={`bus-power ${step === 3 ? 'lit' : ''}`} />
      <path d="M160 18 V6 H228" className={`bus-heat ${step === 3 ? 'lit' : ''}`} />
      {nodes.map((n) => (
        <g key={n.id} className={`bus-node ${lit.includes(n.id) ? 'lit' : ''}`}>
          <rect x={n.x - 22} y={24} width={44} height={28} rx={3} />
          <text x={n.x} y={42}>
            {n.label}
          </text>
        </g>
      ))}
      <g className={`bus-node small ${step === 3 ? 'lit power' : ''}`}>
        <rect x={62} y={80} width={40} height={24} rx={3} />
        <text x={82} y={96}>
          PSU
        </text>
      </g>
      <text x="234" y="10" className={`bus-caption ${step === 3 ? 'lit' : ''}`}>
        CIEPŁO → FAN1
      </text>
    </svg>
  );
}

function Quiz({ onLab }: { onLab: () => void }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (picked !== null) feedback.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked]);
  const finished = index >= quiz.length;
  if (finished)
    return (
      <div className="quiz done" role="status">
        <span className="quiz-kicker">WYNIK TESTU</span>
        <b className="quiz-score">
          {score}
          <i>/{quiz.length}</i>
        </b>
        <p>
          {score === quiz.length
            ? 'Komplet. Czas sprawdzić tę wiedzę w laboratorium.'
            : 'Niezły początek. Wróć do etapów i spróbuj jeszcze raz.'}
        </p>
        <div className="quiz-actions">
          <button
            className="btn ghost"
            onClick={() => {
              setIndex(0);
              setPicked(null);
              setScore(0);
            }}
          >
            <RotateCcw size={15} /> <span>Powtórz</span>
          </button>
          <button className="btn primary" onClick={onLab}>
            <span>Laboratorium</span> <FlaskConical size={16} />
          </button>
        </div>
      </div>
    );
  const q = quiz[index];
  return (
    <div className="quiz">
      <span className="quiz-kicker">
        SPRAWDŹ SIĘ · {index + 1}/{quiz.length}
      </span>
      <b className="quiz-question">{q.question}</b>
      <div className="quiz-options">
        {q.options.map((label, i) => (
          <button
            key={label}
            disabled={picked !== null}
            className={
              picked === null ? '' : i === q.answer ? 'right' : picked === i ? 'wrong' : 'dim'
            }
            onClick={() => {
              setPicked(i);
              if (i === q.answer) setScore((s) => s + 1);
            }}
          >
            <span>{String.fromCharCode(65 + i)}</span>
            {label}
            {picked !== null && i === q.answer && <Check size={15} />}
            {picked === i && i !== q.answer && <X size={15} />}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="quiz-feedback" role="status" ref={feedback}>
          <p>
            <b>{picked === q.answer ? 'Dobrze.' : 'Nie tym razem.'}</b> {q.why}
          </p>
          <button
            className="btn ghost small"
            onClick={() => {
              setIndex((n) => n + 1);
              setPicked(null);
            }}
          >
            <span>{index + 1 < quiz.length ? 'Następne pytanie' : 'Pokaż wynik'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SignalPanel({
  step,
  onStep,
  onLab,
}: {
  step: number;
  onStep: (step: number) => void;
  onLab: () => void;
}) {
  const current = steps[step];
  return (
    <div className="panel-body signal-panel">
      <div className="panel-kicker">
        <span>KANAŁ 02</span> DROGA DANYCH
      </div>
      <div className="stepper" role="tablist" aria-label="Etapy drogi danych">
        {steps.map((s, i) => (
          <button
            key={s.tag}
            role="tab"
            aria-selected={i === step}
            className={i < step ? 'past' : ''}
            onClick={() => onStep(i)}
          >
            <b>0{i + 1}</b>
            <span>{s.tag.split('/ ')[1]}</span>
          </button>
        ))}
      </div>
      <Bus step={step} />
      <h1 className="display small" key={step}>
        {current.title}
      </h1>
      <p className="lede">{current.text}</p>
      <p className="panel-tip">
        {step === 3
          ? 'Linia przerywana: zasilanie PSU → płyta. Linia ciągła: ciepło CPU → chłodzenie.'
          : 'Linia pokazuje uproszczony kierunek przepływu danych.'}{' '}
        To schemat relacji, nie fizyczny przewód.
      </p>
      <div className="step-controls">
        <button
          className="icon-button"
          aria-label="Poprzedni etap"
          disabled={step === 0}
          onClick={() => onStep(step - 1)}
        >
          <ArrowLeft size={17} />
        </button>
        <div className="step-progress" aria-hidden="true">
          <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <button
          className="icon-button accent"
          aria-label={step === 3 ? 'Wróć do pierwszego etapu' : 'Następny etap'}
          onClick={() => onStep((step + 1) % steps.length)}
        >
          {step === 3 ? <RotateCcw size={17} /> : <ArrowRight size={17} />}
        </button>
      </div>
      {step === 3 && <Quiz onLab={onLab} />}
    </div>
  );
}
