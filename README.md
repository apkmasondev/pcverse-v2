# PCVerse v2 — Atlas maszyny

Interaktywne laboratorium edukacyjne o budowie komputera PC. Realistyczny model 3D ustawiony na stole serwisowym i trzy sposoby odkrywania, jak działa maszyna.

**Demo:** https://apkmasondev.github.io/pcverse-v2/

## Co można zrobić

- **Anatomia:** siedem podzespołów (CPU, GPU, RAM, płyta główna, SSD, zasilacz, chłodzenie), dla każdego karta katalogowa. Części podświetlają się pod kursorem. Model można rozłożyć, obracać i oglądać każdą część z bliska w ujęciach przód, tył, góra, spód i złącza.
- **Droga danych:** cztery etapy (SSD → RAM → CPU → GPU oraz zasilanie i ciepło) ze schematem magistrali i testem wiedzy na koniec.
- **Laboratorium:** gra, render albo wiele aplikacji; rozdzielczość, pojemność RAM i przepływ powietrza. Telemetria pokazuje płynność, temperaturę z progiem 90 °C, obciążenie, moc i zapas zasilacza, a dziennik pomiarów pozwala porównywać kolejne konfiguracje.
- **Skróty klawiszowe:** A / D / L kanały, 1–7 części, ← / → kolejna część lub etap, E rozłóż, F z bliska, R reset kamery, Spacja start/stop zadania, Esc powrót, ? instrukcja.
- **Dostępność:** schemat 2D płyty bez WebGL (przełącznik warstw lub adres `?2d`), pełna obsługa klawiaturą, respektowanie `prefers-reduced-motion` i ręczna pauza animacji.

To model dydaktyczny, nie benchmark. Wyniki są uproszczonym, deterministycznym modelem zależności, a układ i skala eksponatu są umowne.

## Uruchomienie

Wymagany Node.js 22.18+ (zalecany 24).

```sh
npm ci
npm run dev        # http://localhost:5173/pcverse-v2/
npm test           # symulacja, trasy przewodów, kontrola modelu
npm run lint
npm run build      # wynik w dist/
npm run preview    # http://localhost:4173/pcverse-v2/
```

Ścieżkę bazową ustawia `vite.config.ts`. Przy każdym pushu na `main` workflow `.github/workflows/deploy.yml` uruchamia lint, testy i build, a potem publikuje stronę na GitHub Pages.

## Model 3D

Model powstaje w całości ze skryptów Blendera 5.2, bez ręcznie klikanej sceny:

```sh
npm run model:build     # Blender w PATH: budowa sceny + kompresja (ok. 6 min)
npm run model:optimize  # sama kompresja art/export/atlas.raw.glb
```

- `scripts/build_atlas.py`, `atlas_details.py`, `finish_atlas.py` budują geometrię, materiały i eksport. Asercje pilnują prześwitów, m.in. chipset–PCIe, VRM–EPS, otwory wentylatorów GPU, ciepłowody–mostek oraz wentylator wieży–DIMM.
- `scripts/optimize_model.mjs` wykonuje deduplikację, spawanie wierzchołków i kompresję `EXT_meshopt_compression`. Wynik to `public/models/atlas.glb`: ok. 4,2 MB i 208 tys. trójkątów. Dekoder jest w bundlu, więc aplikacja nie łączy się z zewnętrznymi serwerami.
- Dbałość o realizm: wieżowe chłodzenie CPU (poziome żeberka, cztery ciepłowody U, wentylator 120 mm na wlocie), karta graficzna prostopadła do płyty w złączu PCIe, zasilacz ATX z gniazdami modułowymi z przodu oraz gniazdem IEC i włącznikiem z tyłu, osobne wiązki ATX 24-pin, EPS 8-pin i PCIe 8-pin.

Renderowanie jest oszczędne: DPR maks. 1,5 oraz tryb ECO z DPR 1 i bez cieni. Mapa cieni jest przeliczana tylko wtedy, gdy geometria się przesuwa. Po 45 s bez interakcji wentylatory zwalniają i scena przestaje renderować, a płótno przewinięte poza ekran nie rysuje klatek. Utrata kontekstu WebGL przełącza na schemat 2D.

## Struktura

```
src/App.tsx            stan, układ, skróty klawiszowe
src/ui/                panele, schemat 2D, telemetria, ekran startowy
src/atlas/             scena 3D, treść edukacyjna, model symulacji, trasy przewodów, fonty
public/                model GLB, mapa HDR, favicon
scripts/               potok modelu (Blender, optymalizacja) i testy Node
art/textures/          źródła tekstur powierzchni
```

## Zasoby i licencje

- Fonty DM Sans i Space Grotesk na licencji SIL Open Font License (`src/atlas/fonts/*-OFL.txt`), serwowane lokalnie.
- Mapa środowiska `studio_small_03` pochodzi z Poly Haven (CC0).
- Tekstury powierzchni w `art/textures` wygenerowano narzędziem AI na potrzeby projektu. To ilustracje materiałów, a nie projekty rzeczywistych produktów. Mapy normalnych i chropowatości są generowane matematycznie w `scripts/atlas_details.py`.

Znane ograniczenie: React Three Fiber korzysta z przestarzałego `THREE.Clock`, co daje jedno ostrzeżenie w konsoli.
