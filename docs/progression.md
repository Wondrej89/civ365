# Progression, automatizace a statistiky

Tato iterace rozšiřuje současný engine, `Condition`, `GameEffect`, tiered units a statický GitHub Pages build. Technologie mají 31 uzlů: původních šest a 25 nových. Economy a Wealth zůstávají skryté.

## Přidané technologie

| Éra          | Technologie            | Výsledek                                               |
| ------------ | ---------------------- | ------------------------------------------------------ |
| Agricultural | Settled Life           | Otevře cestu k automatizaci populace.                  |
| Agricultural | Natural Growth         | Odemkne Automatic Population Growth.                   |
| Agricultural | Irrigation             | +25 % produkce Farmerů.                                |
| Agricultural | Animal Husbandry       | +25 % Food produkce.                                   |
| Agricultural | Stoneworking           | +30 % Materials produkce.                              |
| Agricultural | Mining                 | Odemkne Miner.                                         |
| Agricultural | Division of Labor      | +10 % produkce Gathererů, Woodcutterů a Thinkerů.      |
| Agricultural | Record Keeping         | Odemkne Statistics a zaznamenávání historie.           |
| Agricultural | Writing                | +35 % Research produkce.                               |
| Agricultural | Organized Settlements  | Zkrátí interval automatického růstu z 10 na 7 sekund.  |
| Bronze       | Metallurgy             | +35 % Materials produkce.                              |
| Bronze       | Bronze Working         | Odemkne Workshop.                                      |
| Bronze       | Wheel                  | +20 % Materials produkce.                              |
| Bronze       | Advanced Agriculture   | Odemkne Farm.                                          |
| Bronze       | Census                 | Odemkne graf rozložení populace.                       |
| Bronze       | Mathematics            | +30 % Research produkce.                               |
| Bronze       | Construction           | +20 % Materials produkce a −10 % ceny růstu.           |
| Bronze       | Formal Education       | Odemkne Scholar.                                       |
| Classical    | Engineering            | +40 % Materials produkce.                              |
| Classical    | Philosophy             | +40 % Research produkce.                               |
| Classical    | Urban Planning         | −10 % ceny růstu; navazuje na ni Urban Communities.    |
| Classical    | Institutional Learning | Odemkne Academy.                                       |
| Classical    | Craftsmanship          | +30 % produkce Workshopů.                              |
| Classical    | Urban Communities      | Zkrátí interval automatického růstu ze 7 na 4 sekundy. |
| Classical    | Public Health          | Zkrátí interval automatického růstu ze 4 na 2 sekundy. |

Původní Foraging, Tool Making, Woodworking, Language, Knowledge Sharing a Agriculture zůstávají. Nové hry získají Miner přes Mining a Scholar přes Formal Education. Migrace zachová tyto unlocky hráčům, kteří už měli staré Woodworking / Knowledge Sharing.

## Éry a produkční řetězce

| Vstup do éry     | Požadavky                                                       |
| ---------------- | --------------------------------------------------------------- |
| Agricultural Age | Agriculture a alespoň 20 lidí.                                  |
| Bronze Age       | Mining, Writing, alespoň 50 lidí a 250 Research v zásobě.       |
| Classical Age    | Mathematics, Construction, Formal Education a alespoň 200 lidí. |

Přechod se provádí v Overview. Zachová zdroje, populaci i jednotky, zapíše událost a při prvním vstupu přidá jeden Civilization point. Research požadované při vstupu do Bronze Age se nespotřebují. Každá éra zpřístupní nákup své další části stromu.

Gatherer → Farmer → Farm, Woodcutter → Miner → Workshop a Thinker → Scholar → Academy jsou hratelné. Tier 4 zůstává připravený v datech a skrytý. Všechny upgrady od tieru 2 potřebují Materials a předchozí jednotky; libovolné další ceny určuje pole `costs`. Základní jednotky potřebují jen Idle Population, takže Woodcutter vždy poskytuje cestu k Materials bez předchozí investice Materials. Lze také ručně sbírat Materials.

Převody 5 → 1 a poté 4 → 1 zachovávají původní footprint 1 / 5 / 20 / 100 lidí. Farm a Workshop mají základní produkci 28/s, Academy 8.4/s: před dalšími bonusy je to 1.75× produkce čtyř vstupních jednotek. Rozebrání vrací nižší jednotky; utracené zdroje se nevracejí.

## Auto Growth

Po Settled Life → Natural Growth se v Population objeví přepínač, interval, odpočet, Food Reserve a přehled technologických modifikátorů. Výchozí stav je OFF, rezerva 10 %. Přepnutí OFF/ON zahájí nový interval. Ruční Grow Population zůstává dostupný.

Jediná funkce `growPopulation` ověřuje cenu, odečte Food a přidá jednoho člověka do Idle Population. Ruční akce i automatické události používají právě tuto funkci. Automatika při každém intervalu zkusí jeden růst; neúspěšný pokus čeká na další interval. Cena se přepočítá z aktuální populace a efektů.

Rezerva chrání 0 / 10 / 25 / 50 % zásoby **před konkrétním pokusem**. Při 100 Food, rezervě 25 % a ceně 80 se růst neprovede; při ceně 70 ano, zůstane 30 Food. Rezerva není pevná dlouhodobá hranice: při příštím pokusu se přepočítá z nové zásoby. Ruční tlačítko ji může utratit. Pokud chcete Food hromadit na upgrade, automatiku lze dočasně vypnout.

Interval se násobí obecnými efekty `populationGrowthIntervalMultiplier`, nikoli přepínáním podle ID technologií. Kombinace 0.7 × (4/7) × 0.5 dává 10 → 7 → 4 → 2 sekund. Základní interval, minimální interval a volby rezervy jsou v `content/config.ts`.

Živá i offline simulace používá stejný `simulate`. Kroky končí také na hranicích růstu a statistického samplování, aby produkce, cena, rezerva i nové bonusy platily ve správném pořadí. Offline limit zůstává 8 hodin. Offline report rozlišuje skutečně vyprodukované Food a Food spotřebované růstem a uvádí počet nových lidí.

## Technologický strom

`systems/technology-tree.ts` sestaví viditelné uzly a spojnice přímo z `prerequisites`. UI kreslí SVG šipky a karty, seskupuje éry, používá `treePosition` jako souřadnice sloupce a řádku uvnitř éry a nabízí obousměrný scroll a zoom 75 / 100 / 125 %. Na telefonu se posouvá vnitřek grafu.

`technologyStatus` rozlišuje `hidden`, `revealed`, `available` a `researched`. Nákup vyžaduje prerequisites, unlock podmínku a dostatek zdrojů. Strom ukazuje dokončené a dostupné uzly a nejvýše jednu další úroveň navazující na ně. Z následující nedosažené éry se zobrazí jen uzly s již splněnými prerequisites; vzdálenější éry zůstanou skryté. Před Record Keeping neexistuje viditelný odkaz na Statistics.

Novou větev přidejte do `entries` v `content/technologies.ts`: zadejte jedinečné `id`, `era`, `branch`, `x`, `y`, základní cenu, `prerequisites`, `effects` a `effectText`. Souřadnice nesmí kolidovat s jiným uzlem stejné éry. Tovární funkce vytvoří `treePosition`, ceny a obecné podmínky; nepřidávají se ručně žádné spojnice do Reactu. Pro novou éru doplňte registry `content/eras.ts` a případně násobič cen v `balance.technologyCosts`. Název `branch` je otevřený řetězec, takže lze přidat například `computing` bez úpravy typového unionu.

## Statistics a další grafy

Record Keeping založí první sample Population. Další vznikají každých 30 **simulovaných herních sekund**, včetně offline času. Vývojové zrychlení tedy zrychluje i sampling. Timestamp je celé číslo sekund od začátku simulované hry, hodnota je řetězec Decimal; každá série ukládá jen tyto dvě hodnoty, nikoli kopii stavu.

Historie je omezená na posledních 2000 bodů na sérii, což při výchozím intervalu představuje přibližně 16 hodin 40 minut simulované hry. `retainSamples` v `systems/statistics.ts` odděluje retenční politiku; pozdější downsampling může zachovat starší agregované body bez změny simulace nebo grafu. Historická pole se při klonování stavu nekopírují; nový sample vytváří nové pole jen pro příslušnou sérii.

Statistics vykresluje obecný čárový graf ze skutečně uložených samples, KPI aktuální/maximální/celkem vytvořené populace a Idle/Assigned. „Total population created“ zahrnuje zakládajícího člověka. Po Census se přidá sloupcový graf rozložení; počítá lidi reprezentované jednotkami, takže jedna Farm přidá 20 lidí do Food Production.

Další historický graf přidejte do `statisticSeries` v `content/statistics.ts`, například:

```ts
{
  id: 'foodStock',
  name: 'Food stock over time',
  color: '#63a476',
  sampleValue: (state) => state.resources.food,
  unlockCondition: { type: 'featureUnlocked', featureId: 'statistics' },
}
```

Engine automaticky začne sérii vzorkovat po splnění podmínky, save ji uloží a Statistics použije stejnou komponentu grafu. Pro další aktuální rozložení přidejte položku do `statisticDistributions` s `values(state)` vracejícím skupiny `{ id, name, color, value }`. Pokud měníte nebo odstraňujete ID již uložených sérií, doplňte migraci.

## Save a ověření

`saveVersion` je 3, migrace běží 0 → 1 → 2 → 3. Verze 2 zachovává zdroje, populace, jednotky, technologie, skilly a achievementy; nové hodnoty dostanou bezpečné defaults. Původní interní ID `scientist` se beze ztráty počtu převádí na `academy`. Staré unlocky Miner/Scholar zůstávají trvale dostupné. Statistiky starých saves začnou bez historie; nelze zpětně rekonstruovat neuložené průběhy. Import ověřuje intervalové fáze, rezervu, limity historie, timestampy i nezáporné hodnoty.

Testy zahrnují růst, rezervy, hranice intervalů, živou/offline shodu, samplování a uložení, migrace, odhalování stromu a přechody érami. Automatický průchod engine dosáhl Agricultural / Bronze / Classical přibližně za 4 / 16 / 29 minut simulované hry při průběžném rozdělování populace a okamžitých nákupech. Reálný průchod UI z nového save dosáhl Agricultural Age za 11 minut 40 sekund a Bronze Age za 26 minut 40 sekund; používal jen běžná tlačítka a vývojové zrychlení, bez přidávání zdrojů nebo populace. Všech 98 testů, TypeScript, lint i build prošly. Chromium ověřil desktop/mobil, import verze 2, automatický i offline růst, grafy a statický build pod cestou `/civ365/` bez chyb načítání.

## Co ladit dále

Balance je první průchod, nikoli finální tempo. Optimalizovaný automatický hráč dosahuje Classical Age rychleji než orientačních 1–3 hodiny. Pro další ladění jsou nejúčinnější:

- `content/config.ts`: násobiče cen Research/Materials pro jednotlivé éry; nemění šest původních tribal cen.
- `content/units.ts`: ceny `costs`, základní produkce, převody `upgradeFrom` a bonusy okolním tierům. Změna footprintu vyžaduje zhodnocení migrace; změna ceny nebo produkce ne.
- `content/config.ts`: základní cena populace, násobič 1.12 do populace 20 a 1.02 nad ní. Mírnější pozdější růst umožňuje dosáhnout 200 lidí bez nepřekonatelné exponenciální ceny.
- `content/technologies.ts`: jednotlivé ceny, prerequisites, produkční bonusy a intervalové efekty automatizace.
- `content/eras.ts`: požadavky na populaci, technologie a zásoby při přechodu.

Samplovací interval a limit historie ladí velikost save a přesnost grafu, nikoli ekonomiku hry.
