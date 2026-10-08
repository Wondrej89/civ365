# Progression, automatizace a statistiky

Tento dokument popisuje technologický strom, automatizaci a registry grafů. Aktuální obsah má 57 technologií; nová smyčka Territory → Settlements → Population → Army → Conquest a úplné požadavky epoch jsou v [realm.md](realm.md). Economy a Wealth zůstávají skryté.

## Základní technologie automatizace a produkce

| Éra          | Technologie            | Výsledek                                               |
| ------------ | ---------------------- | ------------------------------------------------------ |
| Agricultural | Settled Life           | Odemkne Settlements a cestu k automatizaci.            |
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
| Bronze       | Bronze Working         | Odemkne Workshop a Spearman.                           |
| Bronze       | Wheel                  | +20 % Materials produkce.                              |
| Bronze       | Advanced Agriculture   | Odemkne Farm.                                          |
| Bronze       | Census                 | Odemkne graf rozložení populace.                       |
| Bronze       | Mathematics            | +30 % Research produkce.                               |
| Bronze       | Construction           | +20 % Materials; levnější růst a stavby, City.         |
| Bronze       | Formal Education       | Odemkne Scholar.                                       |
| Classical    | Engineering            | +40 % Materials produkce.                              |
| Classical    | Philosophy             | +40 % Research produkce.                               |
| Classical    | Urban Planning         | −10 % ceny růstu a +25 % settlement capacity.          |
| Classical    | Institutional Learning | Odemkne Academy.                                       |
| Classical    | Craftsmanship          | +30 % produkce Workshopů.                              |
| Classical    | Urban Communities      | Zkrátí interval automatického růstu ze 7 na 4 sekundy. |
| Classical    | Public Health          | Zkrátí interval automatického růstu ze 4 na 2 sekundy. |

Původní Foraging, Tool Making, Woodworking, Language, Knowledge Sharing a Agriculture zůstávají. Nové hry získají Miner přes Mining a Scholar přes Formal Education. Migrace zachová tyto unlocky hráčům, kteří už měli staré Woodworking / Knowledge Sharing.

## Éry a produkční řetězce

Požadavky příští éry ukazuje Overview jako checklist technologií, populace, území, kapacity, settlement tiers a vojenské síly. Přesné hodnoty jsou centrálně v `balance.eraRequirements` a jejich tabulka v [realm.md](realm.md#epochy-a-nové-technologie).

Přechod zachová zdroje, populaci i jednotky, zapíše událost a při prvním vstupu přidá jeden Civilization point. Každá éra zpřístupní nákup své další části stromu; nemá časový zámek.

Gatherer → Farmer → Farm, Woodcutter → Miner → Workshop a Thinker → Scholar → Academy jsou hratelné. Tier 4 odemkne Factories v Industrial Age. Všechny upgrady od tieru 2 potřebují Materials a předchozí jednotky; libovolné další ceny určuje pole `costs`. Základní jednotky potřebují jen Idle Population, takže Woodcutter vždy poskytuje cestu k Materials bez předchozí investice Materials. Lze také ručně sbírat Materials.

Převody 5 → 1 a poté 4 → 1 zachovávají původní footprint 1 / 5 / 20 / 100 lidí. Farm a Workshop mají základní produkci 28/s, Academy 8.4/s: před dalšími bonusy je to 1.75× produkce čtyř vstupních jednotek. Rozebrání vrací nižší jednotky; utracené zdroje se nevracejí.

## Auto Growth

Po Settled Life → Natural Growth se v Population objeví přepínač, interval, odpočet, Food Reserve a přehled technologických modifikátorů. Výchozí stav je OFF, rezerva 10 %. Přepnutí OFF/ON zahájí nový interval. Ruční Grow Population zůstává dostupný.

Jediná funkce `growPopulation` ověřuje Population Capacity i cenu, odečte Food a přidá jednoho člověka do Idle Population. Ruční akce i automatické události používají právě tuto funkci. Automatika při každém intervalu zkusí jeden růst; neúspěšný pokus čeká na další interval. Cena se přepočítá z aktuální populace a efektů.

Rezerva chrání 0 / 10 / 25 / 50 % zásoby **před konkrétním pokusem**. Při 100 Food, rezervě 25 % a ceně 80 se růst neprovede; při ceně 70 ano, zůstane 30 Food. Rezerva není pevná dlouhodobá hranice: při příštím pokusu se přepočítá z nové zásoby. Ruční tlačítko ji může utratit. Ruční i automatický růst se zastaví při dosažení kapacity; Population odkazuje na Settlements. Pokud chcete Food hromadit na upgrade, automatiku lze dočasně vypnout.

Interval se násobí obecnými efekty `populationGrowthIntervalMultiplier`, nikoli přepínáním podle ID technologií. Kombinace 0.7 × (4/7) × 0.5 dává 10 → 7 → 4 → 2 sekund. Základní interval, minimální interval a volby rezervy jsou v `content/config.ts`.

Živá i offline simulace používá stejný `simulate`. Kroky končí také na hranicích růstu a statistického samplování, aby produkce, cena, rezerva i nové bonusy platily ve správném pořadí. Offline limit zůstává 8 hodin. Offline report rozlišuje skutečně vyprodukované Food a Food spotřebované růstem a uvádí počet nových lidí. Zvlášť uvádí vojenské ztráty a získaná území.

## Technologický strom

`systems/technology-tree.ts` sestaví viditelné uzly a spojnice přímo z `prerequisites`. UI kreslí SVG šipky a karty, seskupuje éry, používá `treePosition` jako souřadnice sloupce a řádku uvnitř éry a nabízí obousměrný scroll a zoom 75 / 100 / 125 %. Na telefonu se posouvá vnitřek grafu.

`technologyStatus` rozlišuje `hidden`, `revealed`, `available` a `researched`. Nákup vyžaduje prerequisites, unlock podmínku a dostatek zdrojů. Strom ukazuje dokončené a dostupné uzly a nejvýše jednu další úroveň navazující na ně. Z následující nedosažené éry se zobrazí jen uzly s již splněnými prerequisites; vzdálenější éry zůstanou skryté. Před Record Keeping neexistuje viditelný odkaz na Statistics.

Novou větev přidejte do `entries` v `content/technologies.ts`: zadejte jedinečné `id`, `era`, `branch`, `x`, `y`, základní cenu, `prerequisites`, `effects` a `effectText`. Souřadnice nesmí kolidovat s jiným uzlem stejné éry. Tovární funkce vytvoří `treePosition`, ceny a obecné podmínky; nepřidávají se ručně žádné spojnice do Reactu. Pro novou éru doplňte registry `content/eras.ts` a případně násobič cen v `balance.technologyCosts`. Název `branch` je otevřený řetězec, takže lze přidat například `computing` bez úpravy typového unionu.

## Statistics a další grafy

Record Keeping založí první sample Population. Další vznikají každých 30 **simulovaných herních sekund**, včetně offline času. Vývojové zrychlení tedy zrychluje i sampling. Timestamp je celé číslo sekund od začátku simulované hry, hodnota je řetězec Decimal; každá série ukládá jen tyto dvě hodnoty, nikoli kopii stavu.

Historie je omezená na posledních 2000 bodů na sérii, což při výchozím intervalu představuje přibližně 16 hodin 40 minut simulované hry. `retainSamples` v `systems/statistics.ts` odděluje retenční politiku; pozdější downsampling může zachovat starší agregované body bez změny simulace nebo grafu. Historická pole se při klonování stavu nekopírují; nový sample vytváří nové pole jen pro příslušnou sérii.

Statistics vykresluje obecný čárový graf ze skutečně uložených samples, KPI aktuální/maximální/celkem vytvořené populace a Idle/Assigned. „Total population created“ zahrnuje zakládajícího člověka. Po Census se přidá sloupcový graf rozložení; počítá lidi reprezentované jednotkami, takže jedna Farm přidá 20 lidí do Food Production. Military se počítá samostatně a stále je součástí celkové populace. Po odemčení features se přidají také historické série Population Capacity, Owned Territories a Military Power.

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

`saveVersion` je 4, migrace běží 0 → 1 → 2 → 3 → 4. Migrace zachovávají zdroje, populaci, jednotky, technologie, skilly a achievementy. Verze 2 převádí `scientist` na `academy`, zachovává staré unlocky Miner/Scholar a založí nové údaje automatizace a historie. Verze 3 přidává bezpečné defaults území, Camp a armády; populace nad kapacitou zůstává. Historii nelze zpětně rekonstruovat. Import ověřuje fáze, rezervu, limity historie, timestampy, footprint workers + military i snapshot kampaně.

Testy pokrývají automatizaci, statistiky, novou investiční smyčku, migrace a dosažitelnost Renaissance. Engine průchod dosáhl Classical za 2 h 19 min a Medieval za 4 h 41 min; skutečné UI dosáhlo Medieval za 5 simulovaných hodin bez grantů. Podrobné výsledky a balance parametry jsou v [realm.md](realm.md).

## Co ladit dále

Balance je první průchod, nikoli finální tempo. Náklady, kapacita a conquest nyní přirozeně omezují rychlost. Pro další ladění sledujte více systémů současně; samotný Research neříká, jak rychle hráč projde éry. Pro další ladění jsou nejúčinnější:

- `content/config.ts`: násobiče cen Research/Materials pro jednotlivé éry; nemění šest původních tribal cen.
- `content/units.ts`: ceny `costs`, základní produkce, převody `upgradeFrom` a bonusy okolním tierům. Změna footprintu vyžaduje zhodnocení migrace; změna ceny nebo produkce ne.
- `content/config.ts`: základní cena populace, násobič 1.12 do populace 20, 1.012 do 400 a 1.004 nad ní. Pozdní mírnější růst zachovává dosažitelnost Renaissance.
- `content/technologies.ts`: jednotlivé ceny, prerequisites, produkční bonusy a intervalové efekty automatizace.
- `content/eras.ts`: podmínky přechodu; jejich číselné hodnoty jsou v `balance.eraRequirements`.

Samplovací interval a limit historie ladí velikost save a přesnost grafu, nikoli ekonomiku hry.
