# Territory, sídla, armáda a tempo hry

Tato iterace pokračuje na předchozí implementaci. Engine, data-driven production units, `Condition`, `GameEffect`, save systém i statický GitHub Pages build zůstávají. Nový loop je Territory → sídla → kapacita → populace → armáda → conquest → Territory. Research je pouze jedna z podmínek další epochy.

## Začátek a odemykání

Nová hra má jeden Homeland s jedním stavebním slotem a jeden Founding Camp s kapacitou 20. Kapacitu poskytuje tábor, nikoli území. Díky tomu lze dosáhnout Agricultural Age před odemčením stavby sídel. Camp se po Settled Life upgraduje na Settlement; Village Organization odemkne Town. Počáteční Camp už zabírá slot, takže první další Settlement potřebuje nové území.

Organized Warfare je záměrně v Agricultural Age. Bronze Age vyžaduje dvě území, proto musí být první dobytí dostupné před vstupem do Bronze. Levy Infantry dovolí dobýt první frontier s několika desítkami vojáků a zbytkem populace pracujícím v Townu. Bezplatný Woodcutter i ruční sběr Materials zůstávají cestou k potřebnému vybavení a stavbám. Demobilizace a rozebrání produkčních tierů dovolují změnit rozdělení lidí.

Settlements se objeví až po Settled Life, Military a Territory po Organized Warfare. Wealth, Economy a Energy zůstávají skryté.

## Kapacita a investice

| Sídlo         | Základní kapacita | Základní cena Materials / Food | Odemčení                |
| ------------- | ----------------: | -----------------------------: | ----------------------- |
| Founding Camp |                20 |                počáteční domov | začátek hry             |
| Settlement    |                25 |                      100 / 100 | Settled Life            |
| Town          |                75 |                     1000 / 300 | Village Organization    |
| City          |               250 |                   25000 / 1000 | Construction            |
| Metropolis    |              1000 |                 250000 / 10000 | Advanced Urban Planning |

Každé sídlo používá jeden slot. Build přidá nové sídlo a slot spotřebuje; upgrade nahradí jeden kus předchozího tieru a počet slotů nezmění. Camp → Settlement je také upgrade. Žádný downgrade není v této iteraci implementovaný.

Kapacita je součet upravených kapacit všech sídel, zaokrouhlený dolů na celé lidi. `settlementCapacityMultiplier` může cílit na konkrétní tier nebo všechna sídla a pocházet z technologií, éry nebo dalších obecných efektů. Urban Planning přidává 25 % všem sídlům, Aqueducts 50 % Townům a City, Civil Administration 30 %, Sanitation 20 % a Advanced Urban Planning 40 %. Construction, Masonry a Banking snižují Materials cenu sídel přes `settlementCostMultiplier`.

Další postavené sídlo násobí ceny faktorem `balance.settlements.costGrowth` (výchozí 1.4). Každý upgrade má vlastní lifetime počítadlo investic a geometrickou cenu: Town ×1.6, City ×2, Metropolis ×2.2. Max platí přesně součet jednotlivých cen; převod City na Metropolis nesmaže dřívější City investice. UI ukazuje skutečnou cenu po efektech a škálování.
Ruční i automatický růst zastaví stejná `growPopulation`, když je Population >= Capacity. Population zobrazuje důvod a odkaz na Settlements nebo research potřebný k jejich odemčení. Auto Growth dál pravidelně zkouší stejnou akci, takže po zvýšení kapacity automaticky pokračuje. Dřívější rezervy Food i osmihodinový offline limit zůstávají.

## Armáda a ekonomická cena

Armáda má právě tři počty: `infantry`, `cavalry`, `ranged`. Jejich equipment tier se placeným upgradem změní pro celou kategorii bez další populace. Technologie pouze zpřístupní upgrade; aktuální tier ovlivňuje Power, náborovou cenu i upkeep. Data všech tierů jsou v `content/military.ts`. Infantry vede od Levy přes Spearman a Heavy Infantry po Men-at-Arms, Line Infantry a Rifle Infantry; Cavalry od Horsemen po Mounted Rifles; Ranged od Archer přes Composite Bowman, Crossbowman a Musketeer po Rifleman. Submachine Gunner je připravený budoucí obsah.

`Population = production footprints + military footprints + Idle Population`.

Vojáci nevyrábějí běžné zdroje a každý spotřebuje Food i Materials za sekundu. `militaryUpkeepMultiplier` z technologií Supply Lines, Professional Army a Military Logistics náklady snižuje. UI ukazuje gross produkci, upkeep i net; resource ledger a hlavní přehledy používají čisté hodnoty. Nedostatek zásob postupně snižuje readiness až na 50 %, nikoli populaci; její zlepšení vyžaduje znovu zásobovat armádu. Skutečné ztráty dál vznikají v boji.

## Kampaně a volba území

Každá frontier má tři stabilní volby: Fertile Plains / Mineral Highlands / Scholarly Province s bonusem pro Food / Materials / Research. Všechny přidají jedno území a jeden slot. Základ defense zůstává 40 × 1.8^conquests, varianty ho násobí 0.8 / 1 / 1.25 a dávají 3 / 5 / 8 procentních bodů trvalé produkce. Při další conquest se obtížnosti mezi oblastmi střídají; porážka ani reload nabídku nezmění.

Infantry counteruje Cavalry, Cavalry Ranged a Ranged Infantry. Složení obránců vzniká deterministicky. Při jediném odemčeném vlastním typu jsou counters vypnuté, při dvou mají menší vliv. Kombinovaná armáda s alespoň 15 % vojáků každého odemčeného typu dostává bonus ×1.1. Bez Espionage UI ukazuje pouze bezpečné rozpětí power, délky a casualties; až intelligence odhalí skutečné složení a přesný odhad.

Délka je `baseDuration × Defense / effectivePower`, výchozí 180 s, minimum 15 s, maximum 600 s. Launch uloží nasazené jednotky, počáteční efektivní Power, Defense, délku a konkrétní odměnu. Nábor, demobilizace a equipment upgrades jsou do konce blokované. Armáda dál spotřebovává zásoby; zhoršené zásobování může změnit výsledek. Jiný nově koupený bonus zpětně nemění launch snapshot.

Vítězství při effective Power >= Defense ztrácí `max(2 %, 16 % / ratio²)` každého typu, zaokrouhlené dolů; porážka 35 % + 35 % × (1 − ratio), nejvýše 70 %. Fortifications ztráty násobí 0.65. Neexistuje RNG. Casualties odečtou vojáky i jejich footprint z Population, nikoli celkem vytvořené lidi.

Živý i offline průběh používá `simulate` s hranicemi růstu, vyčerpání zásob, statistik a dokončení kampaně. Uloženou odměnu nelze získat dvakrát. Offline report uvádí také Food a Materials skutečně zaplacené za armádu.

## Epochy a nové technologie

| Další éra    | Technologie                                                                | Další požadavky                                                                          |
| ------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Agricultural | Agriculture                                                                | Population 20                                                                            |
| Bronze       | Mining, Writing, Organized Warfare                                         | Population 50, Territories 2, Settlements 2                                              |
| Classical    | Mathematics, Construction, Formal Education                                | Population 150, Territories 4, Capacity 200                                              |
| Medieval     | Engineering, Institutional Learning, Classical Army                        | Population 400, Territories 7, City nebo vyšší 2, Military Power 700                     |
| Renaissance  | Universities, Civil Administration, Professional Army, Long Distance Trade | Population 1000, Territories 10, City nebo vyšší 5, Capacity 1500, Military Power 6000   |
| Industrial   | Steam Power, Mechanization, Early Industry                                 | Population 2000, Territories 16, City nebo vyšší 10, Capacity 2500, Military Power 40000 |

Overview ukazuje pouze další epochu s každým požadavkem, aktuální hodnotou a stavem Met / Needed. Nové podmínky jsou součástí obecného `Condition` evaluatoru. Éry se dále přecházejí ručně, bez resetu, s jedním Civilization point při prvním vstupu.

Celkem je 62 technologií:

- Agricultural: Village Organization, Organized Warfare.
- Bronze: Archery, Horsemanship.
- Classical: Aqueducts, Classical Army, Supply Lines.
- Medieval: Feudal Organization, Fortifications, Heavy Plow, Guilds, Universities, Civil Administration, Professional Army, Masonry, Long Distance Trade, Sanitation, Espionage.
- Renaissance: Printing Press, Humanism, Navigation, Gunpowder, Banking, Scientific Method, Advanced Urban Planning, Early Industry, Steam Power, Mechanization, Military Logistics.
- Industrial: Factories, Rifling.

Steam Power a Mechanization jsou pozdní Renaissance technologie umožňující vstup do Industrial Age. Factories jsou počáteční industrial obsah s unlockem existujících tierů Industrial Farm, Factory a Laboratory. Plný Industrial/Energy obsah zde ještě není. Metropolis je dostupná po Advanced Urban Planning. Navigation zrychluje kampaně a připravuje znalost pro budoucí exploration; Banking a Long Distance Trade zatím neodemykají Wealth.

## Pacing a centrální nastavení

Násobiče Research cen pro Tribal / Agricultural / Bronze / Classical / Medieval / Renaissance / Industrial jsou 1 / 10 / 40 / 180 / 800 / 4000 / 20000. Materials násobiče jsou 1 / 5 / 15 / 50 / 180 / 600 / 2000. Základní ceny zůstávají v definicích technologií. Pozdější výzkum tak drahne rychleji než samotné produkční bonusy.

Cena růstu používá 1.12 do populace 20, 1.008 od 20 do 400 a 1.001 nad 400. Mírnější pozdější část zabraňuje prakticky nedosažitelným tisícovým populacím; kapacita a náklady na sídla a armádu představují další limity. To je první balance pass, nikoli přesný časový slib každému hráči.

Automatický hráč z nového save s deseti počátečními kliknutími a bez grantů dosáhl:

| Milník       | Simulovaný čas |
| ------------ | -------------: |
| Agricultural |          5 min |
| Bronze       |    56 min 30 s |
| Classical    |     1 h 51 min |
| Medieval     |     3 h 18 min |
| Renaissance  | 4 h 0 min 30 s |

Průchod skutečným prohlížečem s běžnými UI akcemi a pouze vývojovým speed multiplierem dosáhl Agricultural za 16 min 40 s, Bronze za 1 h 15 min, Classical za 2 h 21 min 40 s, Medieval za 3 h 45 min a Renaissance za 4 h 35 min. Nepoužíval přidávání zdrojů, populace, území ani technologií. Méně časté rozhodování v tomto UI průchodu přirozeně prodloužilo čas oproti engine průchodu.

Hráč průběžně investuje, přerozděluje pracovníky, staví sídla, rekrutuje armádu a dobývá území. Žádná éra nemá podmínku uplynulého času. Při ladění jsou nejúčinnější `technologyCosts`, `eraRequirements`, `populationGrowth`, `settlements.costGrowth`, `military.recruitCostGrowth` a `conquest` v `content/config.ts`; ceny, kapacity, produkce a jednotkové power zůstávají v content registries.

## Statistika, save a rozšiřování

Statistics přidává Population Capacity, Owned Territories a Military Power over time po odemčení příslušných features. Census distribuce obsahuje Military podle skutečných footprintů. Sampling zůstává každých 30 simulovaných sekund, nejvýše 2000 bodů na sérii, včetně offline průběhu.

Aktuální save je v6; nové vojenské a city převody popisuje [growth-warfare.md](growth-warfare.md). Níže popsaný územní převod vznikl ve v4. Migrace dále zachovává všechny předchozí verze, doplňuje jazyk a opravuje nové tech edges podle [localization.md](localization.md). Verze 3 dostane jeden Homeland, jeden Camp, prázdnou armádu a žádnou kampaň; stávající lidé, pracovníci, zdroje, technologie, skilly, achievementy a historie se zachovají. Population nad novou kapacitou zůstává, pouze další růst čeká na zvýšení kapacity. Capacity se odvozuje ze sídel a efektů, neukládá se jako druhá nezávislá pravda. Uložený `populationCapacityBonus` je vyhrazen pro explicitní vývojový grant. Import kontroluje počty, sloty, armádní footprinty a konzistenci rozpracované kampaně. Časy logu jsou celé milisekundy, i když kampaň končí mezi dvěma běžnými tick hranicemi.

Nový typ území přidejte do `content/territories.ts` s `settlementSlots`, případnými `effects` a strategickými resource metadata. Nové sídlo přidejte do `content/settlements.ts`, vojenskou jednotku do `content/military.ts`. Systémy a UI načítají registry; konkrétní tech ID patří do obsahových podmínek, nikoli obecných výpočtů. Grafy dál přidává `content/statistics.ts`; jejich nové `sampleValue` callbacks se vyhodnocují až při samplování, což zachovává bezpečné načítání navzájem odkazovaných engine modulů.

Development panel nabízí + Territory, + Settlement, +100 Capacity, + Military Units, Complete Campaign, odemykání technologií dosažených epoch a zrychlení 10/100/1000. Zobrazuje také aktuální scaling parametry. Tyto granty slouží diagnostice; balance průchody je nepoužívají. V produkčním buildu je celý panel odstraněn.

## Ověření iterace

Aktuální growth/army/frontiers iterace prošla všemi 152 unit/integration testy, TypeScript, lintem včetně katalogů a production buildem. Chromium ověřil nový run až do Renaissance bez grantů, desktop a mobilní sheets, import skutečného v4 Medieval save, dávkový růst, placené equipment upgrady, průběžnou údržbu, špionáž, rozpracovanou kampaň přes reload a její offline dokončení bez dvojí odměny. Production build byl ověřen také ze statického hostingu pod `/civ365/` bez asset 404 a chyb JavaScriptu, včetně násobných City cen, bonusu růstu dalšího města a ukládání jazyka; deploy dál obstarává stávající GitHub Pages workflow po merge do main. Podrobnosti jsou v [growth-warfare.md](growth-warfare.md).
