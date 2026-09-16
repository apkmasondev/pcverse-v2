import { Component, lazy, Suspense, useCallback, useEffect, useEffectEvent, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Box,
  Gauge,
  Layers3,
  Pause,
  Play,
  RotateCcw,
  UnfoldVertical,
  FoldVertical,
  X,
  ArrowRight,
} from 'lucide-react';
import { parts, steps } from './atlas/content';
import type { Mode, PartId, Workload } from './atlas/content';
import { simulate } from './atlas/simulation';
import HelpDialog from './atlas/HelpDialog';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useMediaQuery } from './hooks/useMediaQuery';
import AnatomyPanel from './ui/AnatomyPanel';
import SignalPanel from './ui/SignalPanel';
import LabPanel from './ui/LabPanel';
import Telemetry from './ui/Telemetry';
import type { Measurement } from './ui/Telemetry';
import Schematic from './ui/Schematic';
import PartGlyph from './ui/PartGlyph';
import BootScreen from './ui/BootScreen';

const AtlasScene = lazy(() => import('./atlas/AtlasScene'));

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const channels = [
  { id: 'anatomy', name: 'Anatomia', key: 'A' },
  { id: 'signal', name: 'Droga danych', key: 'D' },
  { id: 'lab', name: 'Laboratorium', key: 'L' },
] as const;
const BOOT_KEY = 'pcverse-booted';
const IDLE_AFTER_MS = 45_000;

function readBootFlag() {
  try {
    return window.sessionStorage.getItem(BOOT_KEY) === '1';
  } catch {
    return false;
  }
}

function useWidth() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, node ? width : 0] as const;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('anatomy');
  const [selected, setSelected] = useState<PartId | null>(null);
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [isolated, setIsolated] = useState(false);
  const [spread, setSpread] = useState(1);
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState<PartId[]>([]);
  const [running, setRunning] = useState(false);
  const [workload, setWorkload] = useState<Workload>('game');
  const [resolution, setResolution] = useState(1);
  const [memory, setMemory] = useState(16);
  const [airflow, setAirflow] = useState(65);
  const [log, setLog] = useState<Measurement[]>([]);
  const [reset, setReset] = useState(0);
  const [flat, setFlat] = useState(() => new URLSearchParams(window.location.search).has('2d'));
  const [sceneKey, setSceneKey] = useState(0);
  const [low, setLow] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [autoLow, setAutoLow] = useState(false);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [stats, setStats] = useState('RENDEROWANIE NA ŻĄDANIE');
  const [progress, setProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [booting, setBooting] = useState(() => !readBootFlag());
  const [toast, setToast] = useState(false);
  const [idle, setIdle] = useState(false);
  const [sceneNode, setSceneNode] = useState<HTMLDivElement | null>(null);
  const [onscreen, setOnscreen] = useState(true);
  const reduced = useReducedMotion();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [leftDock, leftWidth] = useWidth();
  const [rightDock, rightWidth] = useWidth();
  const result = simulate({ workload, resolution, memory, airflow, running });
  const motionOff = reduced || paused;
  const insets = desktop
    ? {
        left: leftWidth ? leftWidth + 20 : 0,
        right: mode === 'lab' && rightWidth ? rightWidth + 20 : 0,
      }
    : { left: 0, right: 0 };

  const revealPanel = useCallback(() => {
    if (desktop) return;
    requestAnimationFrame(() => {
      const panel = document.getElementById('panel');
      if (!panel) return;
      const top = panel.getBoundingClientRect().top;
      if (top > window.innerHeight - 120 || top < 0)
        panel.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    });
  }, [desktop, reduced]);

  const select = useCallback(
    (id: PartId) => {
      setSelected(id);
      if (visited.includes(id)) return;
      if (visited.length === parts.length - 1) setToast(true);
      setVisited([...visited, id]);
    },
    [visited],
  );

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setSelected(null);
      setHovered(null);
      setIsolated(false);
      setRunning(false);
      if (next === 'signal') {
        setSpread(0.7);
        setStep(0);
      }
      if (next === 'lab') setSpread(0);
      revealPanel();
    },
    [revealPanel],
  );

  const inspect = useCallback(
    (id: PartId) => {
      if (mode !== 'anatomy') switchMode('anatomy');
      select(id);
      revealPanel();
    },
    [mode, switchMode, select, revealPanel],
  );

  const fallback = useCallback(() => setFlat(true), []);
  const onSlow = useCallback(() => {
    setLow(true);
    setAutoLow(true);
  }, []);
  const onReady = useCallback(() => setSceneReady(true), []);
  const finishBoot = useCallback(() => {
    setBooting(false);
    try {
      window.sessionStorage.setItem(BOOT_KEY, '1');
    } catch {
      /* storage unavailable: the start screen simply shows again next time */
    }
  }, []);

  function resetExperiment() {
    setMemory(16);
    setResolution(1);
    setAirflow(65);
    setRunning(false);
    setWorkload('game');
    setLog([]);
  }

  function toggleFlat() {
    if (flat) setSceneKey((k) => k + 1);
    setFlat((v) => !v);
  }

  // Record each configuration that stays unchanged for a moment while a task runs.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      const r = simulate({ workload, resolution, memory, airflow, running: true });
      setLog((previous) => {
        const last = previous[0];
        if (
          last &&
          last.workload === workload &&
          last.memory === memory &&
          last.airflow === airflow &&
          (workload !== 'game' || last.resolution === resolution)
        )
          return previous;
        return [
          {
            id: (last?.id ?? 0) + 1,
            workload,
            resolution,
            memory,
            airflow,
            score: r.score,
            temperature: r.temperature,
            watts: r.watts,
            throttling: r.throttling,
            bottleneck: r.bottleneck,
          },
          ...previous,
        ].slice(0, 6);
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [running, workload, resolution, memory, airflow]);

  useEffect(() => {
    let last = 0;
    let timer = window.setTimeout(() => setIdle(true), IDLE_AFTER_MS);
    const wake = () => {
      const now = performance.now();
      if (now - last < 500) return;
      last = now;
      window.clearTimeout(timer);
      setIdle(false);
      timer = window.setTimeout(() => setIdle(true), IDLE_AFTER_MS);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, []);

  useEffect(() => {
    if (!sceneNode) return;
    const observer = new IntersectionObserver(([entry]) => setOnscreen(entry.isIntersecting));
    observer.observe(sceneNode);
    return () => observer.disconnect();
  }, [sceneNode]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 9000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || help || booting)
      return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key =
      event.code === 'Space' ? ' ' : event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const index = parts.findIndex((p) => p.id === selected);
    switch (key) {
      case 'a':
        return switchMode('anatomy');
      case 'd':
        return switchMode('signal');
      case 'l':
        return switchMode('lab');
      case '?':
        return setHelp(true);
      case 'r':
        return !flat && setReset((n) => n + 1);
      case 'e':
        if (mode !== 'lab' && !flat && !isolated) setSpread((v) => (v > 0.5 ? 0 : 1));
        return;
      case 'f':
        if (mode === 'anatomy' && selected && !flat) setIsolated((v) => !v);
        return;
      case ' ':
        if (mode !== 'lab' || target.closest('button')) return;
        event.preventDefault();
        return setRunning((v) => !v);
      case 'Escape':
        if (isolated) setIsolated(false);
        else if (selected) setSelected(null);
        return;
      case 'ArrowRight':
      case 'ArrowLeft': {
        if (target.closest('[role="tablist"]')) return;
        const dir = key === 'ArrowRight' ? 1 : -1;
        if (mode === 'signal') setStep((s) => Math.min(steps.length - 1, Math.max(0, s + dir)));
        else if (mode === 'anatomy')
          select(parts[(Math.max(index, dir > 0 ? -1 : 0) + dir + parts.length) % parts.length].id);
        return;
      }
    }
    if (/^[1-7]$/.test(key)) inspect(parts[Number(key) - 1].id);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const view = flat
    ? 'SCHEMAT 2D'
    : isolated && selected
      ? 'SZCZEGÓŁOWY'
      : spread > 0.1
        ? 'ROZŁOŻONY'
        : 'ZŁOŻONY';
  const figure = mode === 'anatomy' ? '01' : mode === 'signal' ? '02' : '03';
  const schematic = (
    <Schematic
      selected={selected}
      hovered={hovered}
      onSelect={inspect}
      onHover={setHovered}
      mode={mode}
      step={step}
      running={running}
      workload={workload}
    />
  );

  return (
    <div className={`app mode-${mode} ${motionOff ? 'still' : ''}`}>
      <a className="skip-link" href="#panel">
        Przejdź do panelu
      </a>
      <header className="topbar">
        <button
          className="brand"
          aria-label="PCVerse — wróć do anatomii"
          onClick={() => switchMode('anatomy')}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
            <path d="M16 3 27 9.5v13L16 29 5 22.5v-13Z" />
            <path d="M5 9.5 16 16l11-6.5M16 16v13" />
            <circle cx="16" cy="16" r="2.2" />
          </svg>
          <span className="brand-name">
            PC<b>VERSE</b>
          </span>
          <span className="brand-sub">ATLAS MASZYNY</span>
        </button>
        <nav className="channels" aria-label="Tryb doświadczenia">
          {channels.map((c, i) => (
            <button
              key={c.id}
              onClick={() => switchMode(c.id)}
              aria-current={mode === c.id ? 'page' : undefined}
            >
              <small>0{i + 1}</small>
              <span>{c.name}</span>
              <kbd aria-hidden="true">{c.key}</kbd>
            </button>
          ))}
        </nav>
        <div className="topbar-end">
          <span className="sys" aria-hidden="true">
            <i className={`led ${running ? 'hot' : 'on'}`} /> {running ? 'OBCIĄŻENIE' : 'SYS OK'}
          </span>
          <button
            className="help-button"
            onClick={() => setHelp(true)}
            aria-label="Instrukcja i skróty klawiszowe"
          >
            <span>Instrukcja</span>
            <kbd>?</kbd>
          </button>
        </div>
      </header>

      <main
        className="stage"
        id="experience"
        style={
          {
            '--inset-left': `${insets.left}px`,
            '--inset-right': `${insets.right}px`,
          } as CSSProperties
        }
      >
        <div
          className={`scene-layer ${hovered && mode === 'anatomy' && !flat ? 'pointing' : ''}`}
          ref={setSceneNode}
          role="region"
          aria-label="Interaktywny eksponat komputera"
        >
          {flat ? (
            schematic
          ) : (
            <SceneBoundary key={sceneKey} onFailure={fallback} fallback={schematic}>
              <Suspense fallback={null}>
                <AtlasScene
                  isolated={isolated && mode === 'anatomy' && !!selected}
                  selected={selected}
                  hovered={hovered}
                  onSelect={inspect}
                  onHover={setHovered}
                  spread={spread}
                  mode={mode}
                  step={step}
                  running={running}
                  reduced={motionOff}
                  reset={reset}
                  low={low}
                  insets={insets}
                  onError={fallback}
                  onStats={setStats}
                  onProgress={setProgress}
                  onReady={onReady}
                  airflow={airflow}
                  temperature={result.temperature}
                  workload={workload}
                  onSlow={onSlow}
                  idle={idle}
                  onscreen={onscreen}
                />
              </Suspense>
            </SceneBoundary>
          )}
          {!flat && !sceneReady && !booting && (
            <div className="scene-loader" role="status">
              <span>WCZYTYWANIE EKSPONATU</span>
              <b>{Math.round(progress)}%</b>
              <i style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <div className="stage-frame" aria-hidden="true">
          <span className="fig">
            FIG. {figure} <b>—</b> WIDOK {view}
          </span>
          <span className="coords">SKALA UMOWNA · EKSPONAT DYDAKTYCZNY</span>
        </div>

        <section
          className="dock dock-left"
          id="panel"
          ref={leftDock}
          aria-label="Opis i sterowanie"
        >
          {mode === 'anatomy' && (
            <AnatomyPanel
              selected={selected}
              visited={visited}
              flat={flat}
              isolated={isolated}
              onIsolate={() => setIsolated((v) => !v)}
              onSelect={inspect}
              onHover={setHovered}
              onClear={() => {
                setSelected(null);
                setIsolated(false);
              }}
              onSignal={() => switchMode('signal')}
            />
          )}
          {mode === 'signal' && (
            <SignalPanel step={step} onStep={setStep} onLab={() => switchMode('lab')} />
          )}
          {mode === 'lab' && (
            <LabPanel
              workload={workload}
              resolution={resolution}
              memory={memory}
              airflow={airflow}
              running={running}
              onWorkload={setWorkload}
              onResolution={setResolution}
              onMemory={setMemory}
              onAirflow={setAirflow}
              onRun={() => setRunning((v) => !v)}
              onReset={resetExperiment}
            />
          )}
        </section>

        {mode === 'lab' && (
          <aside className="dock dock-right" ref={rightDock} aria-label="Wyniki symulacji">
            <Telemetry
              result={result}
              workload={workload}
              running={running}
              reduced={motionOff}
              log={log}
              onClearLog={() => setLog([])}
            />
          </aside>
        )}

        <div className="stage-tools">
          {mode !== 'lab' && !flat && !(isolated && selected) && (
            <div className="assembly">
              <button
                className="tool"
                onClick={() => setSpread((v) => (v > 0.5 ? 0 : 1))}
                aria-label={spread > 0.5 ? 'Złóż komputer' : 'Rozłóż komputer'}
                title={spread > 0.5 ? 'Złóż komputer (E)' : 'Rozłóż komputer (E)'}
              >
                {spread > 0.5 ? <FoldVertical size={16} /> : <UnfoldVertical size={16} />}
              </button>
              <input
                type="range"
                className="fader compact"
                min="0"
                max="1"
                step=".01"
                value={spread}
                style={{ '--fill': `${spread * 100}%` } as CSSProperties}
                aria-label="Rozsunięcie podzespołów"
                onChange={(e) => setSpread(+e.target.value)}
              />
              <span className="assembly-value" aria-hidden="true">
                {String(Math.round(spread * 100)).padStart(3, '0')}
              </span>
            </div>
          )}
          <div className="view-tools">
            <button
              className="tool"
              title="Resetuj kamerę (R)"
              aria-label="Resetuj kamerę"
              disabled={flat}
              onClick={() => setReset((n) => n + 1)}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="tool"
              title={flat ? 'Włącz widok 3D' : 'Włącz schemat 2D'}
              aria-label={flat ? 'Włącz widok 3D' : 'Włącz schemat 2D'}
              aria-pressed={flat}
              onClick={toggleFlat}
            >
              {flat ? <Box size={16} /> : <Layers3 size={16} />}
            </button>
            <button
              className="tool labelled"
              title={
                autoLow && low ? 'Oszczędna jakość włączona automatycznie' : 'Jakość renderowania'
              }
              aria-label={low ? 'Włącz pełną jakość' : 'Włącz oszczędną jakość'}
              disabled={flat}
              onClick={() => {
                setLow((v) => !v);
                setAutoLow(false);
              }}
            >
              <Gauge size={16} />
              <span>{low ? 'ECO' : 'HQ'}</span>
            </button>
            <button
              className="tool"
              title={
                reduced
                  ? 'Ruch ograniczony w ustawieniach systemu'
                  : paused
                    ? 'Wznów animacje'
                    : 'Wstrzymaj animacje'
              }
              aria-label="Ogranicz animacje"
              aria-pressed={motionOff}
              disabled={reduced || flat}
              onClick={() => setPaused((v) => !v)}
            >
              {motionOff ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
        </div>

        {toast && (
          <div className="toast" role="status">
            <span className="toast-badge">7/7</span>
            <div>
              <b>Anatomia zbadana w całości.</b>
              <p>Teraz zobacz, jak te części współpracują.</p>
            </div>
            <button
              className="btn primary small"
              onClick={() => {
                setToast(false);
                switchMode('signal');
              }}
            >
              <span>Droga danych</span>
              <ArrowRight size={15} />
            </button>
            <button
              className="icon-button bare"
              aria-label="Zamknij powiadomienie"
              onClick={() => setToast(false)}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </main>

      <nav className="rail" aria-label="Katalog podzespołów">
        <div className="rail-head">
          <span>KATALOG</span>
          <b>
            {String(visited.length).padStart(2, '0')}
            <i>/07</i>
          </b>
        </div>
        <div className="rail-items">
          {parts.map((p, i) => (
            <button
              key={p.id}
              aria-pressed={selected === p.id}
              className={`${visited.includes(p.id) ? 'seen' : ''} ${hovered === p.id ? 'hover' : ''}`}
              onClick={() => inspect(p.id)}
              onPointerEnter={(e) =>
                e.pointerType !== 'touch' && mode === 'anatomy' && setHovered(p.id)
              }
              onPointerLeave={() => mode === 'anatomy' && setHovered(null)}
            >
              <span className="rail-ref">
                <kbd>{i + 1}</kbd>
                {p.ref}
              </span>
              <PartGlyph id={p.id} size={26} />
              <span className="rail-text">
                <strong>{p.label}</strong>
                <span>{p.name}</span>
              </span>
              <i className="led" aria-hidden="true" />
              {visited.includes(p.id) && <span className="sr-only">, zbadano</span>}
            </button>
          ))}
        </div>
      </nav>

      <footer className="statusbar">
        <span>
          <i className="led on" /> KANAŁ {figure} · {view}
        </span>
        <span className="stats">{flat ? 'SCHEMAT 2D · PEŁNA OBSŁUGA KLAWIATURĄ' : stats}</span>
        <span className="status-end">MODEL EDUKACYJNY · NIE BENCHMARK</span>
      </footer>

      {booting && (
        <BootScreen
          progress={progress}
          ready={flat || sceneReady}
          flat={flat}
          reduced={reduced}
          onDone={finishBoot}
        />
      )}
      {help && <HelpDialog onClose={() => setHelp(false)} />}
    </div>
  );
}
