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
