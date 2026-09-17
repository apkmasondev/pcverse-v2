import type { Workload } from './content';
export interface Setup {
  workload: Workload;
  resolution: number;
  memory: number;
  airflow: number;
  running: boolean;
}
/** Deliberately simplified, deterministic teaching model, never a hardware benchmark. */
export function simulate({ workload, resolution, memory, airflow, running }: Setup) {
  const demand = workload === 'tabs' ? 22 : workload === 'render' ? 12 : 10;
  const pressure = running ? Math.max(0, (demand - memory) / demand) : 0;
  const cpu = running ? (workload === 'render' ? 100 : workload === 'tabs' ? 47 : 64) : 3;
  const gpu = running ? (workload === 'game' ? [53, 78, 99][resolution] : 9) : 2;
  const temperature = running
    ? Math.round(31 + cpu * 0.32 + gpu * 0.11 + (100 - airflow) * 0.35)
    : 29;
  const throttling = temperature >= 90;
  const thermalFactor = throttling ? 0.7 : 1;
  const watts = Math.round(45 + cpu * 1.2 * thermalFactor + gpu * 2.1);
  const score = running
    ? Math.round(
        (workload === 'game' ? [120, 86, 49][resolution] : workload === 'render' ? 100 : 96) *
          (1 - pressure * 0.72) *
          thermalFactor,
      )
    : 0;
  const bottleneck = !running
    ? 'Gotowość'
    : throttling
      ? 'Temperatura'
      : pressure > 0
        ? 'Pojemność RAM'
        : workload === 'game'
          ? resolution === 0
            ? 'CPU / logika gry'
            : 'GPU / rozdzielczość'
          : workload === 'render'
            ? 'Moc obliczeniowa CPU'
            : 'Wystarczająco dużo RAM';
  const explanation = !running
    ? 'Uruchom zadanie i obserwuj, jak zmienia się praca całego komputera.'
    : throttling
      ? 'Zbyt słaby przepływ powietrza podniósł temperaturę. Model obniżył taktowanie, aby ograniczyć nagrzewanie. Zwiększ przepływ i porównaj wynik.'
      : pressure > 0
        ? `Zadanie potrzebuje około ${demand} GB. Część danych trafia do pliku wymiany na SSD. Zwiększ RAM i porównaj wynik.`
        : workload === 'game'
          ? resolution === 0
            ? 'GPU ma zapas mocy. Przy niskiej rozdzielczości tempo gry może ograniczać przygotowanie klatek na CPU.'
            : 'Więcej pikseli obciąża GPU. Zmniejsz rozdzielczość i obserwuj zmianę liczby klatek na sekundę.'
          : workload === 'render'
            ? 'Ten render korzysta z CPU. Szybsza karta graficzna ani RAM ponad potrzebną pojemność same w sobie go nie przyspieszą.'
            : 'Dane wszystkich aplikacji mieszczą się w RAM. Dalsze zwiększanie pojemności nie poprawi już wyniku w tym modelu.';
  return {
    cpu,
    gpu,
    watts,
    temperature,
    throttling,
    pressure,
    score,
    bottleneck,
    explanation,
    demand,
  };
}

/** Surface temperature of one exhibit part: `low` at its base, `high` at its top. */
export interface PartHeat {
  low: number;
  high: number;
}
export type HeatMap = Record<
  'cpu' | 'cooler' | 'gpu' | 'ram' | 'board' | 'ssd' | 'psu' | 'cables' | 'bench',
  PartHeat
>;
export const THERMAL_RANGE = { min: 25, max: 85 };

/** Illustrative thermal-camera view derived from the same teaching model as the lab results. */
export function heatMap(setup: Setup, result: ReturnType<typeof simulate>): HeatMap {
  const ambient = 24;
  const even = (t: number): PartHeat => ({ low: t, high: t });
  const cpu = result.temperature;
  // Heat spreads up the heatpipes; stronger airflow cools the fin stack more than the base.
  const fins = ambient + (cpu - ambient) * (0.55 - setup.airflow * 0.003);
  const gpuCore = 30 + result.gpu * 0.5;
  return {
    cpu: even(cpu),
    cooler: { low: cpu - 6, high: Math.round(fins) },
    gpu: { low: gpuCore - 6, high: gpuCore },
    // Modules warm with memory traffic and even more when the system runs out of RAM.
    ram: even(34 + result.cpu * 0.12 + (setup.running ? 6 : 0) + result.pressure * 14),
    // Power stages around the socket run hotter than the rest of the board.
    board: { low: 32 + result.cpu * 0.18, high: 30 + result.cpu * 0.08 },
    // NVMe controllers heat up under I/O; swapping when RAM runs out keeps them busy.
    ssd: even(
      36 +
        (setup.running ? 8 : 0) +
        result.pressure * 28 +
        (setup.running && setup.workload === 'tabs' ? 4 : 0),
    ),
    // Conversion losses grow with the power drawn by the components.
    psu: { low: 32 + result.watts * 0.05, high: 30 + result.watts * 0.04 },
    cables: even(ambient + 3),
    bench: even(ambient),
  };
}
