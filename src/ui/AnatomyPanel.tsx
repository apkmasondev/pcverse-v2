import { ArrowLeft, ArrowRight, Scan, Undo2 } from 'lucide-react';
import { parts } from '../atlas/content';
import type { PartId } from '../atlas/content';
import PartGlyph from './PartGlyph';

interface Props {
  selected: PartId | null;
  visited: PartId[];
  flat: boolean;
  isolated: boolean;
  onIsolate: () => void;
  onSelect: (id: PartId) => void;
  onHover: (id: PartId | null) => void;
  onClear: () => void;
  onSignal: () => void;
}

export default function AnatomyPanel({
  selected,
  visited,
  flat,
  isolated,
  onIsolate,
  onSelect,
  onHover,
  onClear,
  onSignal,
}: Props) {
  const index = parts.findIndex((p) => p.id === selected);
  const part = parts[index];

  if (!part) {
    const next = parts.find((p) => !visited.includes(p.id)) ?? parts[0];
    return (
      <div className="panel-body intro-panel">
        <div className="panel-kicker">
          <span>KANAŁ 01</span> ANATOMIA
        </div>
        <h1 className="display">
          To nie magia.
          <br />
          To <em>komputer.</em>
        </h1>
        <p className="lede">
          Pod obudową pracuje siedem współzależnych układów. Rozłóż maszynę na części, zobacz
          połączenia i sprawdź, co naprawdę dzieje się po każdym kliknięciu.
        </p>
        <div className="discovery" aria-label={`Zbadane podzespoły: ${visited.length} z 7`}>
          <div className="discovery-head">
            <span>ZBADANE PODZESPOŁY</span>
            <b>
              {visited.length}
              <i>/7</i>
            </b>
          </div>
          <div className="discovery-leds">
            {parts.map((p) => (
              <button
                key={p.id}
                className={visited.includes(p.id) ? 'on' : ''}
                onClick={() => onSelect(p.id)}
                onPointerEnter={() => onHover(p.id)}
                onPointerLeave={() => onHover(null)}
                aria-label={`${p.name}${visited.includes(p.id) ? ', zbadano' : ''}`}
              >
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary wide" onClick={() => onSelect(next.id)}>
          <span>
            {visited.length === 0
              ? 'Zacznij od procesora'
              : visited.length === parts.length
                ? 'Przejrzyj ponownie'
                : `Dalej: ${next.name.toLowerCase()}`}
          </span>
          <ArrowRight size={18} />
        </button>
        <p className="panel-tip">
          {flat
            ? 'Wybierz blok na schemacie płyty albo część z katalogu.'
            : 'Wskaż część na modelu, aby ją podświetlić, i kliknij, aby otworzyć jej kartę. Przeciągnij, by obrócić.'}
        </p>
      </div>
    );
  }

  const prev = parts[index - 1];
  const nextPart = parts[index + 1];
  return (
    <article className="panel-body datasheet" key={part.id}>
      <div className="panel-kicker between">
        <button className="link-button" onClick={onClear}>
          <ArrowLeft size={14} /> Cały komputer
        </button>
        <span>
          {part.ref} · {String(index + 1).padStart(2, '0')}/07
        </span>
      </div>
      <header className="ds-title">
        <span className="ds-glyph">
          <PartGlyph id={part.id} size={34} />
        </span>
        <div>
          <small>{part.label}</small>
          <h1>{part.name}</h1>
        </div>
      </header>
      <p className="ds-role">{part.role}</p>
      <p className="ds-text">{part.description}</p>
      <dl className="ds-spec">
        <dt>PRZEPŁYW</dt>
        <dd>{part.spec}</dd>
      </dl>
      <aside className="note">
        <span>WARTO WIEDZIEĆ</span>
        <p>{part.fact}</p>
      </aside>
      {!flat && (
        <button className="btn ghost wide" aria-pressed={isolated} onClick={onIsolate}>
          {isolated ? <Undo2 size={16} /> : <Scan size={16} />}
          <span>{isolated ? 'Wróć do całego komputera' : 'Obejrzyj część z bliska'}</span>
          <kbd>F</kbd>
        </button>
      )}
      <nav className="ds-pager" aria-label="Kolejne podzespoły">
        <button disabled={!prev} onClick={() => prev && onSelect(prev.id)}>
          <ArrowLeft size={15} />
          <span>
            <small>POPRZEDNI</small>
            {prev ? prev.name : '—'}
          </span>
        </button>
        <button onClick={() => (nextPart ? onSelect(nextPart.id) : onSignal())}>
          <span>
            <small>{nextPart ? 'NASTĘPNY' : 'KANAŁ 02'}</small>
            {nextPart ? nextPart.name : 'Droga danych'}
          </span>
          <ArrowRight size={15} />
        </button>
      </nav>
    </article>
  );
}
