import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const shortcuts: [string[], string][] = [
  [['A', 'D', 'L', 'M'], 'Anatomia · Droga danych · Laboratorium · Montaż'],
  [['1', '–', '7'], 'Wybór podzespołu'],
  [['←', '→'], 'Poprzednia / następna część lub etap'],
  [['E'], 'Rozłóż lub złóż komputer'],
  [['F'], 'Obejrzyj wybraną część z bliska'],
  [['R'], 'Resetuj kamerę'],
  [['Spacja'], 'Uruchom lub zatrzymaj zadanie w laboratorium'],
  [['Esc'], 'Wróć do całego komputera'],
  [['?'], 'Ta instrukcja'],
];

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => {
      node?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="help-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="help-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="help-panel">
        <header className="help-head">
          <span>INSTRUKCJA OBSŁUGI · REV 3</span>
          <button
            className="icon-button"
            aria-label="Zamknij instrukcję"
            onClick={onClose}
            autoFocus
          >
            <X size={18} />
          </button>
        </header>
        <h2 id="help-title" className="display small">
          Ciekawość <em>wystarczy.</em>
        </h2>
        <div className="help-grid">
          <div className="help-channels">
            <p>
              <b>01 Anatomia.</b> Wybierz część na modelu, na dolnej listwie lub klawiszem. Suwak
              rozsuwa podzespoły w kierunku wyjmowania z gniazd. „Z bliska” wyodrębnia wybrany
              element.
            </p>
            <p>
              <b>02 Droga danych.</b> Cztery etapy od odczytu pliku po energię i chłodzenie. Na
              końcu krótki test.
            </p>
            <p>
              <b>03 Laboratorium.</b> Uruchom zadanie, zmieniaj rozdzielczość, RAM i przepływ
              powietrza. Dziennik zapisuje kolejne konfiguracje do porównania. Wynik to uproszczony
              stan po ustabilizowaniu temperatury, nie pomiar sprzętu.
            </p>
            <p>
              <b>04 Montaż.</b> Złóż komputer krok po kroku: procesor, pasta, chłodzenie, pamięć,
              dysk, karta i przewody zasilające. Błędy wyjdą przy pierwszym uruchomieniu, tak jak w
              prawdziwym serwisie.
            </p>
            <aside className="note">
              <span>DOSTĘPNOŚĆ</span>
              <p>
                Tab i Enter obsługują wszystkie przyciski. Przycisk warstw włącza schemat 2D (także
                adresem <code>?2d</code>). Pauza wyłącza ruch cząstek i przejścia; systemowa
                preferencja ograniczonego ruchu jest respektowana.
              </p>
            </aside>
          </div>
          <table className="shortcuts">
            <caption>SKRÓTY KLAWISZOWE</caption>
            <tbody>
              {shortcuts.map(([keys, label]) => (
                <tr key={label}>
                  <td>
                    {keys.map((k) => (k === '–' ? <span key={k}>–</span> : <kbd key={k}>{k}</kbd>))}
                  </td>
                  <td>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="disclaimer">
          Model ma układ ekspozycyjny i umowną skalę. Nie jest instrukcją montażu konkretnego
          komputera.
        </p>
      </section>
    </dialog>
  );
}
