import type { PartId } from './content';

export type Connector = 'atx' | 'eps' | 'pcie' | 'fan';
export interface BuildState {
  /** Index into `buildSteps`; the last index is the power-on test. */
  step: number;
  paste: boolean;
  power: Record<Connector, boolean>;
  /** Wrong answers given at decision points, kept for the final summary. */
  mistakes: number;
  /** Faults fixed after a failed power-on test. */
  repairs: number;
}
/** What the 3D scene and schematic need to know about an assembly in progress. */
export interface BuildView {
  installed: PartId[];
  pending: PartId | null;
  paste: boolean;
  power: Record<Connector, boolean>;
  /** Power-on test: not started, running its LED sequence, passed, or the first fault found. */
  post: 'none' | 'booting' | 'ok' | Connector | 'paste';
}
export interface BuildOption {
  label: string;
  correct: boolean;
  feedback: string;
  /** Proceed even though the choice is not ideal; consequences surface in the power-on test. */
  proceed?: boolean;
  patch?: Partial<Pick<BuildState, 'paste'>>;
}
export interface BuildStep {
  id: 'cpu' | 'paste' | 'cooler' | 'ram' | 'ssd' | 'gpu' | 'power' | 'post';
  short: string;
  /** Part lowered into place when the step is completed. */
  part?: PartId;
  title: string;
  text: string;
  tip?: string;
  action?: string;
  question?: string;
  options?: BuildOption[];
}

export const connectors: { id: Connector; label: string; detail: string }[] = [
  { id: 'atx', label: '24-pin ATX', detail: 'Zasilanie płyty głównej' },
  { id: 'eps', label: '8-pin EPS', detail: 'Zasilanie procesora przy gnieździe' },
  { id: 'pcie', label: '2 × 8-pin PCIe', detail: 'Dodatkowe zasilanie karty graficznej' },
  { id: 'fan', label: 'CPU_FAN', detail: 'Wentylator chłodzenia i odczyt obrotów' },
];

export const buildSteps: BuildStep[] = [
  {
    id: 'cpu',
    short: 'CPU',
    part: 'cpu',
    title: 'Procesor do gniazda.',
    text: 'Unieś dźwignię i otwórz ramkę. Złoty trójkąt w rogu procesora ustaw przy znaczniku gniazda. Połóż CPU pionowo, bez przesuwania i nacisku, a potem zamknij ramkę.',
    tip: 'Delikatne styki LGA są w gnieździe płyty. Wygięty styk to jedna z najdroższych pomyłek przy montażu.',
    action: 'Osadź procesor',
  },
  {
    id: 'paste',
    short: 'PASTA',
    title: 'Pasta termoprzewodząca.',
    action: 'Dalej',
    text: 'Procesor i podstawa chłodzenia tylko wyglądają na gładkie. Mikroskopijne szczeliny wypełnia powietrze, które słabo przewodzi ciepło. Pasta je zastępuje.',
    question: 'Ile pasty nałożyć?',
    options: [
      {
        label: 'Kroplę wielkości ziarna grochu na środek',
        correct: true,
        feedback: 'Dobrze. Docisk chłodzenia sam rozprowadzi cienką, równą warstwę.',
        patch: { paste: true },
      },
      {
        label: 'Grubą warstwę na całą powierzchnię i brzegi',
        correct: false,
        feedback:
          'Za dużo. Nadmiar wypłynie na gniazdo, a gruba warstwa przewodzi ciepło gorzej niż cienka. Spróbuj jeszcze raz.',
      },
      {
        label: 'Pomiń, radiator i tak przylega',
        correct: false,
        proceed: true,
        feedback: 'Idziesz dalej bez pasty. Sprawdzimy to przy uruchomieniu.',
        patch: { paste: false },
      },
    ],
  },
  {
    id: 'cooler',
    short: 'CHŁODZ.',
    part: 'cooler',
    title: 'Chłodzenie wieżowe.',
    text: 'Przykręć mostek montażowy na krzyż, po kilka obrotów z każdej strony, żeby nacisk rozłożył się równo. Wentylator ma wdmuchiwać powietrze przez żeberka w stronę tylnego panelu.',
    tip: 'Zdejmij folię ochronną z miedzianej podstawy. Pozostawiona izoluje prawie tak jak brak pasty.',
    action: 'Zamontuj chłodzenie',
  },
  {
    id: 'ram',
    short: 'RAM',
    part: 'ram',
    title: 'Pamięć w dwóch kanałach.',
    text: 'Płyta ma cztery gniazda DIMM w dwóch kanałach, A i B. Dwie kości pracują najszybciej, gdy każda trafi do innego kanału.',
    action: 'Włóż pamięć',
    tip: 'Wycięcie w stykach pasuje tylko w jednej orientacji. Zatrzaski powinny zamknąć się same, gdy kość wejdzie równo.',
    question: 'Do których gniazd włożyć dwie kości?',
    options: [
      {
        label: 'A2 i B2, czyli drugie i czwarte od procesora',
        correct: true,
        feedback:
          'Tak zaleca instrukcja większości płyt: tryb dwukanałowy i najlepsze prowadzenie sygnału.',
      },
      {
        label: 'A1 i A2, dwa gniazda obok siebie',
        correct: false,
        feedback:
          'Obie kości trafiłyby do kanału A. Pamięć pracowałaby jednokanałowo, z mniejszą przepustowością. Spróbuj jeszcze raz.',
      },
      {
        label: 'A1 i B1, najbliżej procesora',
        correct: false,
        feedback:
          'To nadal dwa kanały, ale dla dwóch kości płyty zalecają A2 i B2. Pod nie są zoptymalizowane ścieżki. Spróbuj jeszcze raz.',
      },
    ],
  },
  {
    id: 'ssd',
    short: 'SSD',
    part: 'ssd',
    title: 'Dysk M.2 NVMe.',
    text: 'Wsuń moduł do złącza pod kątem około 30°, dociśnij do płyty i przykręć małą śrubką. Dysk korzysta z linii PCIe i nie potrzebuje żadnych przewodów.',
    tip: 'Jeśli płyta ma osłonę M.2 z termopadem, zdejmij z niego folię.',
    action: 'Zamontuj SSD',
  },
  {
    id: 'gpu',
    short: 'GPU',
    part: 'gpu',
    title: 'Karta graficzna.',
    action: 'Osadź kartę',
    text: 'Karta wchodzi w złącze PCIe i jest przykręcona do tylnego panelu. Zatrzask złącza zamyka się sam, gdy styki wejdą do końca.',
    question: 'Które złącze wybrać?',
    options: [
      {
        label: 'Górne PCIe x16, połączone z procesorem',
        correct: true,
        feedback:
          'Dobrze. Szesnaście linii PCIe prosto z procesora daje karcie pełną przepustowość.',
      },
      {
        label: 'Dolne, też pełnej długości',
        correct: false,
        feedback:
          'Dolne złącze ma kształt x16, ale często tylko 4 linie z chipsetu. Karta działałaby wolniej. Spróbuj jeszcze raz.',
      },
    ],
  },
  {
    id: 'power',
    short: 'ZASIL.',
    title: 'Zasilanie.',
    text: 'Podłącz przewody z zasilacza. Każda wtyczka pasuje tylko w jednej orientacji i powinna zatrzasnąć się z wyczuwalnym kliknięciem. Możesz uruchomić komputer w dowolnej chwili.',
    action: 'Uruchom komputer',
  },
  {
    id: 'post',
    short: 'START',
    title: 'Test po włączeniu.',
    text: '',
  },
];

export const initialBuild: BuildState = {
  step: 0,
  paste: false,
  power: { atx: false, eps: false, pcie: false, fan: false },
  mistakes: 0,
  repairs: 0,
};

export const postStep = buildSteps.length - 1;

/** Parts already seated in the board at the current step. */
export function installedParts(state: BuildState): PartId[] {
  return buildSteps.slice(0, state.step).flatMap((s) => (s.part ? [s.part] : []));
}

/** The part waiting above the board for the current step, if any. */
export function pendingPart(state: BuildState): PartId | null {
  return buildSteps[state.step]?.part ?? null;
}

export interface PostIssue {
  id: Connector | 'paste';
  headline: string;
  symptom: string;
  cause: string;
  fix: string;
  /** Prevents the operating system from starting at all. */
  blocking: boolean;
}

/** Diagnoses the power-on test in the order a real machine would reveal each fault. */
export function evaluatePost(state: Pick<BuildState, 'paste' | 'power'>): PostIssue[] {
  const issues: PostIssue[] = [];
  if (!state.power.atx)
    issues.push({
      id: 'atx',
      headline: 'Cisza.',
      symptom: 'Nic się nie dzieje. Wentylatory stoją, a diody na płycie nie świecą.',
      cause: 'Płyta główna nie dostaje prądu z 24-pinowej wtyczki ATX.',
      fix: 'Podłącz 24-pin ATX',
      blocking: true,
    });
  if (!state.power.eps)
    issues.push({
      id: 'eps',
      headline: 'Wentylatory ruszyły, obrazu brak.',
      symptom: 'Na płycie świeci dioda diagnostyczna CPU.',
      cause: 'Procesor nie ma zasilania: brakuje 8-pinowej wtyczki EPS obok gniazda.',
      fix: 'Podłącz 8-pin EPS',
      blocking: true,
    });
  if (!state.power.pcie)
    issues.push({
      id: 'pcie',
      headline: 'Monitor bez sygnału.',
      symptom: 'Płyta przechodzi test, ale karta graficzna nie wyświetla obrazu.',
      cause: 'Karta nie dostała dodatkowego zasilania z wtyczek PCIe 8-pin.',
      fix: 'Podłącz przewody PCIe',
      blocking: true,
    });
  if (!state.power.fan)
    issues.push({
      id: 'fan',
      headline: 'CPU Fan Error!',
      symptom: 'Start zatrzymuje się na komunikacie „CPU Fan Error! Press F1 to Resume”.',
      cause: 'Płyta nie widzi obrotów wentylatora, bo przewód nie trafił do złącza CPU_FAN.',
      fix: 'Podłącz CPU_FAN',
      blocking: true,
    });
  if (!state.paste)
    issues.push({
      id: 'paste',
      headline: 'Przegrzanie po minucie.',
      symptom: 'System startuje, ale temperatura procesora szybko sięga 95°C, a wydajność spada.',
      cause: 'Brak pasty termoprzewodzącej: między procesorem a chłodzeniem zostało powietrze.',
      fix: 'Zdejmij chłodzenie i nałóż pastę',
      blocking: false,
    });
  return issues;
}

export function applyFix(state: BuildState, id: PostIssue['id']): BuildState {
  return id === 'paste'
    ? { ...state, paste: true }
    : { ...state, power: { ...state.power, [id]: true } };
}
