import { useEffect, useRef, useState } from 'react';
import { useCountUp } from '../hooks/useCountUp';

const checks: [string, string, string][] = [
  ['Procesor', 'U1', 'WYKRYTO'],
  ['Pamięć operacyjna', '16384 MB', 'OK'],
  ['Karta graficzna', 'PCIE1 ×16', 'OK'],
  ['Dysk NVMe', 'M2_1', 'OK'],
  ['Zasilacz', '650 W', 'OK'],
  ['Chłodzenie', 'FAN1', 'OK'],
];

interface Props {
  progress: number;
  ready: boolean;
  flat: boolean;
  reduced: boolean;
  onDone: () => void;
}

/** POST-style start screen. The progress bar reports the real download of the model and HDR. */
export default function BootScreen({ progress, ready, flat, reduced, onDone }: Props) {
  const [shown, setShown] = useState(reduced ? checks.length : 0);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const memory = useCountUp(shown > 1 ? 16384 : 0, reduced, 700);

  useEffect(() => {
    if (shown >= checks.length) return;
    const timer = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 260 : 150);
    return () => window.clearTimeout(timer);
  }, [shown]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => done.current(), reduced ? 0 : 480);
    return () => window.clearTimeout(timer);
  }, [leaving, reduced]);

  useEffect(() => {
    if (!ready || shown < checks.length) return;
    const timer = window.setTimeout(() => setLeaving(true), reduced ? 0 : 420);
    return () => window.clearTimeout(timer);
  }, [ready, shown, reduced]);

  useEffect(() => {
    const skip = () => setLeaving(true);
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, []);

  const percent = flat ? 100 : Math.round(progress);
  const bar = Math.round(percent / 5);
  return (
    <div
      className={`boot ${leaving ? 'leaving' : ''}`}
      onPointerDown={() => setLeaving(true)}
      role="status"
      aria-live="polite"
      aria-label={`Uruchamianie atlasu, ${percent}%`}
    >
      <div className="boot-crt" aria-hidden="true">
        <div className="boot-head">
          <span className="boot-logo">
            PC<b>VERSE</b>
          </span>
          <span>
            ATLAS BIOS v3.0
            <br />© 2026 PRACOWNIA PCVERSE
          </span>
        </div>
        <ol className="boot-lines">
          {checks.slice(0, shown).map(([name, value, status], i) => (
            <li key={name}>
              <span className="boot-name">{name}</span>
              <span className="boot-dots" />
              <span className="boot-value">{i === 1 ? `${memory} MB` : value}</span>
              <span className="boot-ok">{status}</span>
            </li>
          ))}
        </ol>
        <div className={`boot-load ${shown >= checks.length ? 'visible' : ''}`}>
          <span>{flat ? 'Schemat 2D — scena 3D pominięta' : 'Wczytywanie eksponatu 3D'}</span>
          <span className="boot-bar">
            [{'■'.repeat(bar)}
            <i>{'·'.repeat(20 - bar)}</i>]
          </span>
          <b>{String(percent).padStart(3, ' ')}%</b>
        </div>
        <div className="boot-foot">
          <span>{ready && shown >= checks.length ? 'START ATLASU…' : 'TEST POST'}</span>
          <span className="blink">Dowolny klawisz lub kliknięcie — pomiń</span>
        </div>
      </div>
    </div>
  );
}
