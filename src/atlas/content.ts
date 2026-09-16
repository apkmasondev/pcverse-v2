export type PartId = 'cpu' | 'gpu' | 'ram' | 'board' | 'ssd' | 'psu' | 'cooler';
export type Mode = 'anatomy' | 'signal' | 'lab' | 'build';
export const parts: {
  id: PartId;
  name: string;
  label: string;
  /** Silkscreen-style reference designator, as printed next to a part on a real PCB. */
  ref: string;
  role: string;
  description: string;
  fact: string;
  spec: string;
  position: [number, number, number];
}[] = [
  {
    id: 'cpu',
    ref: 'U1',
    name: 'Procesor',
    label: 'CPU',
    role: 'Wykonuje instrukcje.',
    description:
      'Logika gry, obliczenia i instrukcje systemu trafiają do procesora. Jego rdzenie wykonują zadania, korzystając z szybkiej pamięci podręcznej i danych w RAM.',
    fact: 'Więcej rdzeni pomaga wtedy, gdy program potrafi rozdzielić między nie pracę. Samo GHz nie wystarczy do porównania procesorów.',
    spec: 'INSTRUKCJE → WYNIKI',
    position: [0, 0.5, -1.1],
  },
  {
    id: 'gpu',
    ref: 'PCIE1',
    name: 'Karta graficzna',
    label: 'GPU',
    role: 'Tysiące obliczeń naraz.',
    description:
      'GPU przetwarza wiele podobnych zadań równolegle. Buduje obraz z geometrii, tekstur i światła, a gotową klatkę wysyła do monitora. Ma własną pamięć VRAM.',
    fact: 'Wyższa rozdzielczość oznacza więcej pikseli do obliczenia. Szybszy procesor nie usunie ograniczenia po stronie GPU.',
    spec: 'GEOMETRIA → PIKSELE',
    position: [0.35, 2.65, 1.25],
  },
  {
    id: 'ram',
    ref: 'DIMM1',
    name: 'Pamięć operacyjna',
    label: 'RAM',
    role: 'Miejsce na to, co teraz.',
    description:
      'RAM przechowuje dane uruchomionych programów. Procesor może szybko je odczytywać i zmieniać. Po wyłączeniu zasilania zawartość RAM znika.',
    fact: 'Kiedy brakuje RAM, system może przenosić część danych na dysk. To pomaga działać dalej, ale jest znacznie wolniejsze.',
    spec: 'SZYBKA / ULOTNA',
    position: [2.04, 1.25, -1.25],
  },
  {
    id: 'board',
    ref: 'MB1',
    name: 'Płyta główna',
    label: 'MB',
    role: 'Łączy cały zespół.',
    description:
      'Ścieżki, gniazda i magistrale łączą podzespoły. RAM komunikuje się z kontrolerem pamięci procesora, a GPU i NVMe korzystają z PCI Express. Chipset obsługuje dodatkowe połączenia.',
    fact: 'Podzespoły muszą być zgodne: liczy się m.in. gniazdo CPU, generacja RAM, firmware i dostępne linie PCIe.',
    spec: 'POŁĄCZENIA / PCIe',
    position: [-1.6, 0.3, 2],
  },
  {
    id: 'ssd',
    ref: 'M2_1',
    name: 'Pamięć masowa',
    label: 'SSD',
    role: 'Pamięta po wyłączeniu.',
    description:
      'SSD zapisuje system, programy i pliki w pamięci flash NAND. Model NVMe korzysta z PCIe. Przy uruchomieniu aplikacji potrzebne dane są odczytywane do RAM.',
    fact: 'Szybki SSD skraca wczytywanie. Zwykle nie zwiększa liczby klatek, jeśli gra ma już potrzebne dane w pamięci.',
    spec: 'TRWAŁA / FLASH NAND',
    position: [-0.2, 0.35, 1.43],
  },
  {
    id: 'psu',
    ref: 'PSU1',
    name: 'Zasilacz',
    label: 'PSU',
    role: 'Energia dla każdej części.',
    description:
      'Zasilacz zamienia prąd przemienny z sieci na stabilne napięcia stałe. Układy VRM obniżają je dalej, między innymi do napięcia potrzebnego procesorowi.',
    fact: '650 W to dostępna moc wyjściowa, a nie stały pobór. Komputer pobiera tyle, ile potrzebują podzespoły, plus straty zasilacza.',
    spec: 'AC → DC / 650 W',
    position: [-4.22, 1.9, -0.35],
  },
  {
    id: 'cooler',
    ref: 'FAN1',
    name: 'Chłodzenie',
    label: 'AIR',
    role: 'Wyprowadza ciepło.',
    description:
      'Ciepło przechodzi przez pastę do miedzianej podstawy. Ciepłowody w kształcie litery U unoszą je do wieży cienkich żeberek, a wentylator przepycha powietrze między nimi w stronę tylnego panelu.',
    fact: 'Chłodzenie przenosi ciepło do otoczenia. Słaby przepływ powietrza podnosi temperaturę i może wymusić obniżenie taktowania.',
    spec: 'CIEPŁO → OTOCZENIE',
    position: [0.1, 2.65, -1.1],
  },
];
export const steps: { title: string; text: string; from: PartId; to: PartId; tag: string }[] = [
  {
    title: 'Wszystko zaczyna się od pliku.',
    text: 'Uruchamiasz grę. System odczytuje kod i zasoby z SSD do pamięci RAM. Pliki pozostają na dysku także po wyłączeniu komputera.',
    from: 'ssd',
    to: 'ram',
    tag: '01 / WCZYTYWANIE',
  },
  {
    title: 'Dane trafiają do pracy.',
    text: 'CPU pobiera instrukcje i dane z RAM, korzystając po drodze z pamięci podręcznej. Oblicza logikę gry: ruch, fizykę i zachowanie postaci.',
    from: 'ram',
    to: 'cpu',
    tag: '02 / OBLICZENIA',
  },
  {
    title: 'Z obliczeń powstaje obraz.',
    text: 'CPU przygotowuje polecenia rysowania. GPU wykonuje je równolegle, wykorzystując zasoby we własnej pamięci VRAM. Tak powstaje kolejna klatka.',
    from: 'cpu',
    to: 'gpu',
    tag: '03 / RENDEROWANIE',
  },
  {
    title: 'Każda klatka potrzebuje energii.',
    text: 'PSU zasila podzespoły przez cały czas. Ich praca wytwarza ciepło, które chłodzenie oddaje powietrzu. To proces ciągły, nie ostatni etap po renderowaniu.',
    from: 'psu',
    to: 'board',
    tag: '04 / ENERGIA I CIEPŁO',
  },
];
export type Workload = 'game' | 'render' | 'tabs';
export const workloads: { id: Workload; name: string; short: string }[] = [
  { id: 'game', name: 'Gra 3D', short: '01' },
  { id: 'render', name: 'Render CPU', short: '02' },
  { id: 'tabs', name: 'Wiele aplikacji', short: '03' },
];
export const workloadHints: Record<Workload, string> = {
  game: 'Uruchom grę i porównaj 1080p z 4K.',
  render: 'Uruchom render i zmniejsz przepływ powietrza.',
  tabs: 'Uruchom aplikacje i porównaj 8 GB z 32 GB RAM.',
};
export const quiz: { question: string; options: string[]; answer: number; why: string }[] = [
  {
    question: 'Co zachowa pliki bez zasilania?',
    options: ['RAM', 'SSD', 'Pamięć podręczna CPU'],
    answer: 1,
    why: 'Pamięć flash SSD jest nieulotna. RAM i cache tracą zawartość po odcięciu zasilania.',
  },
  {
    question: 'Gra działa płynnie w 1080p, ale zwalnia w 4K. Co jest wąskim gardłem?',
    options: ['Dysk SSD', 'Karta graficzna', 'Zasilacz'],
    answer: 1,
    why: 'Czterokrotnie więcej pikseli do obliczenia w każdej klatce obciąża przede wszystkim GPU.',
  },
  {
    question: 'Skąd procesor pobiera dane, na których właśnie pracuje?',
    options: ['Bezpośrednio z SSD', 'Z RAM i pamięci podręcznej', 'Z pamięci VRAM'],
    answer: 1,
    why: 'Dane są najpierw wczytywane z SSD do RAM. CPU korzysta z RAM i własnej, jeszcze szybszej pamięci podręcznej.',
  },
];
