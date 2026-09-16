<div align="center">

# PCVerse — Atlas maszyny

**Interaktywny model 3D peceta. Rozłóż go na części, prześledź drogę danych, sprawdź, co spowalnia maszynę, i złóż ją samodzielnie.**

[**▶ Otwórz demo**](https://apkmason.dev/pcverse-v2/) · React · Three.js · React Three Fiber · Blender · WebGL

<img src="docs/explode.webp" alt="Model komputera płynnie rozkłada się na podzespoły i składa z powrotem" width="720" />

</div>

## Cztery kanały

| Anatomia | Droga danych | Laboratorium |
| --- | --- | --- |
| <img src="docs/anatomy.webp" alt="Kanał anatomii z rozłożonym modelem i katalogiem części" /> | <img src="docs/signal.webp" alt="Etap renderowania: przepływ CPU → GPU na schemacie i w modelu" /> | <img src="docs/lab.webp" alt="Laboratorium z telemetrią, wskaźnikiem temperatury i dziennikiem pomiarów" /> |
| Siedem podzespołów z kartami katalogowymi, podświetlaniem pod kursorem, widokiem rozłożonym i oglądaniem z bliska: przód, tył, góra, spód, złącza. | Cztery etapy od wczytania pliku z SSD po obraz na ekranie, z zasilaniem i ciepłem w tle. Na końcu test wiedzy. | Gra, render lub wiele aplikacji. Zmieniasz rozdzielczość, RAM i przepływ powietrza, a telemetria i dziennik pomiarów pokazują skutki. |

### Montaż

<img src="docs/build.webp" alt="Tryb montażu: karta graficzna unosi się nad złączem PCIe, obok lista kontrolna i pytanie o wybór złącza" />

Złóż komputer w kolejności serwisanta: procesor, pasta termoprzewodząca, chłodzenie, pamięć w gniazdach A2/B2, dysk M.2, karta w górnym złączu PCIe i cztery przewody zasilające. Każda część unosi się nad swoim gniazdem i opada po zamontowaniu, a w modelu pojawiają się tylko faktycznie podłączone przewody. Decyzje mają konsekwencje: pominięta pasta albo niepodłączony EPS wyjdą dopiero przy pierwszym uruchomieniu, z realistycznym objawem i diagnozą, np. „CPU Fan Error!” albo świecącą diodą CPU.

<table>
  <tr>
    <td width="42%"><img src="docs/cooler.webp" alt="Zbliżenie wieżowego chłodzenia CPU z ciepłowodami i wentylatorem 120 mm" /></td>
    <td width="42%"><img src="docs/psu-back.webp" alt="Tył zasilacza z gniazdem IEC, włącznikiem i kratką wentylacyjną" /></td>
    <td width="16%" rowspan="2"><img src="docs/mobile.webp" alt="Widok na telefonie" /></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/schematic.webp" alt="Schemat 2D płyty głównej widzianej z góry, dostępny bez WebGL" /></td>
  </tr>
</table>

## Jak powstało

- **Model w 100% ze skryptów.** Cała scena powstaje w Blenderze 5.2 z kodu Pythona (`scripts/build_atlas.py`), bez ręcznego klikania. Asercje pilnują realizmu i prześwitów: wieżowe chłodzenie z ciepłowodami U i wentylatorem na wlocie, karta prostopadła do płyty w złączu PCIe, zasilacz ATX z gniazdami modułowymi z przodu i gniazdem IEC z tyłu, pamięci w gniazdach A2/B2, osobne wiązki ATX 24-pin, EPS 8-pin i PCIe.
- **Lekko mimo szczegółów.** 208 tys. trójkątów skompresowanych meshoptem z 10,4 MB do 4,2 MB. Dekoder jest w bundlu, więc strona nie łączy się z żadnym CDN. Cienie są przeliczane tylko przy ruchu, a gdy nikt nie korzysta ze strony, wentylatory zwalniają i scena przestaje renderować.
- **Interfejs jak przyrząd pomiarowy.** Ciemny stół serwisowy, ekran startowy w stylu BIOS z prawdziwym postępem ładowania, oznaczenia części jak na PCB (U1, PCIE1, DIMM1), skróty klawiszowe (A/D/L/M, 1–7, E, F, R, Spacja, ?).
- **Dostępny.** Schemat 2D bez WebGL (`?2d`), pełna obsługa klawiaturą, `prefers-reduced-motion`, ręczna pauza animacji i układ mobilny.
- **Sprawdzane automatycznie.** Testy symulacji, logiki montażu i diagnostyki, tras elastycznych przewodów oraz skompresowanego modelu uruchamia CI przed każdym wdrożeniem na GitHub Pages.

To model dydaktyczny, nie benchmark: wyniki są uproszczonym modelem zależności, a skala eksponatu jest umowna.

## Uruchomienie

Wymagany Node.js 22.18+ (zalecany 24).

```sh
npm ci
npm run dev        # http://localhost:5173/pcverse-v2/
npm test
npm run build      # wynik w dist/
```

Przebudowa modelu (wymaga Blendera 5.2 w PATH, ok. 6 min):

```sh
npm run model:build     # scena w Blenderze + kompresja
npm run model:optimize  # sama kompresja art/export/atlas.raw.glb
```

## Struktura

```
src/App.tsx      stan, układ, skróty klawiszowe
src/ui/          panele, schemat 2D, telemetria, ekran startowy
src/atlas/       scena 3D, treść, symulacja, logika montażu, trasy przewodów, fonty
public/          model GLB, mapa HDR, obraz podglądu
scripts/         potok modelu (Blender, optymalizacja) i testy
art/textures/    źródła tekstur powierzchni
docs/            zrzuty do README
```

## Zasoby

- Fonty DM Sans i Space Grotesk na licencji SIL Open Font License, serwowane lokalnie.
- Mapa środowiska `studio_small_03` z Poly Haven (CC0).
- Tekstury powierzchni wygenerowane narzędziem AI na potrzeby projektu; mapy normalnych i chropowatości generowane matematycznie.

---

© 2026 [apkmasondev](https://github.com/apkmasondev). Wszelkie prawa zastrzeżone. Kod jest publiczny do wglądu. Chcesz wykorzystać projekt albo zamówić podobny? Zajrzyj na [apkmason.dev](https://apkmason.dev).
