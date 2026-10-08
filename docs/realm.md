# Territory, sídla, armáda a tempo hry

Tato iterace pokračuje na předchozí implementaci. Engine, data-driven production units, `Condition`, `GameEffect`, save systém i statický GitHub Pages build zůstávají. Nový loop je Territory → sídla → kapacita → populace → armáda → conquest → Territory. Research je pouze jedna z podmínek další epochy.

## Začátek a odemykání

Nová hra má jeden Homeland s jedním stavebním slotem a jeden Founding Camp s kapacitou 20. Kapacitu poskytuje tábor, nikoli území. Díky tomu lze dosáhnout Agricultural Age před odemčením stavby sídel. Camp se po Settled Life upgraduje na Settlement; Village Organization odemkne Town. Počáteční Camp už zabírá slot, takže první další Settlement potřebuje nové území.

Organized Warfare je záměrně v Agricultural Age. Bronze Age vyžaduje dvě území, proto musí být první dobytí dostupné před vstupem do Bronze. Levies dovolí dobýt první frontier s přibližně 56–60 vojáky a zbytkem populace pracujícím v Townu. Bezplatný Woodcutter i ruční sběr Materials zůstávají cestou k potřebnému vybavení a stavbám. Demobilizace a rozebrání produkčních tierů dovolují změnit rozdělení lidí.

Settlements se objeví až po Settled Life, Military a Territory po Organized Warfare. Wealth, Economy a Energy zůstávají skryté.

## Kapacita a investice

| Sídlo         | Základní kapacita | Základní cena Materials / Food | Odemčení                |
| ------------- | ----------------: | -----------------------------: | ----------------------- |
| Founding Camp |                20 |                počáteční domov | začátek hry             |
| Settlement    |                25 |                      100 / 100 | Settled Life            |
| Town          |                75 |                      500 / 300 | Village Organization    |
| City          |               250 |                    2500 / 1000 | Construction            |
| Metropolis    |              1000 |                  25000 / 10000 | Advanced Urban Planning |

Každé sídlo používá jeden slot. Build přidá nové sídlo a slot spotřebuje; upgrade nahradí jeden kus předchozího tieru a počet slotů nezmění. Camp → Settlement je také upgrade. Žádný downgrade není v této iteraci implementovaný.

Kapacita je součet upravených kapacit všech sídel, zaokrouhlený dolů na celé lidi. `settlementCapacityMultiplier` může cílit na konkrétní tier nebo všechna sídla a pocházet z technologií, éry nebo dalších obecných efektů. Urban Planning přidává 25 % všem sídlům, Aqueducts 50 % Townům a City, Civil Administration 30 %, Sanitation 20 % a Advanced Urban Planning 40 %. Construction, Masonry a Banking snižují Materials cenu sídel přes `settlementCostMultiplier`.

Další postavené sídlo násobí ceny faktorem `balance.settlements.costGrowth` (výchozí 1.25). Build Max platí geometrický součet stejných cen jako opakovaný Build +1. Upgrade platí aktuální investiční násobič podle celkového počtu postavených sídel; samotný upgrade tento počet nezvyšuje. UI zobrazuje skutečnou cenu po efektech a škálování.

Ruční i automatický růst zastaví stejná `growPopulation`, když je Population >= Capacity. Population zobrazuje důvod a odkaz na Settlements nebo research potřebný k jejich odemčení. Auto Growth dál pravidelně zkouší stejnou akci, takže po zvýšení kapacity automaticky pokračuje. Dřívější rezervy Food i osmihodinový offline limit zůstávají.

## Armáda a ekonomická cena

| Jednotka       | Základní Power | Food / Materials | Odemčení            |
| -------------- | -------------: | ---------------: | ------------------- |
| Levy           |              1 |           10 / 2 | Organized Warfare   |
| Spearman       |              3 |          20 / 15 | Bronze Working      |
| Archer         |              4 |          25 / 20 | Archery             |
| Heavy Infantry |              8 |          40 / 50 | Classical Army      |
| Knight         |             16 |         80 / 120 | Feudal Organization |
| Musketeer      |             30 |        150 / 250 | Gunpowder           |

Každá současná jednotka zabírá jednoho člověka, obecná definice podporuje i jiný footprint. Platí:

`Population = production footprints + military footprints + Idle Population`.

Vojáci netvoří běžné zdroje. Převod pracovníka na vojáka proto snižuje produkci jeho původního odvětví. Recruitment stojí vybavení, demobilizace vrací pouze lidi. Cena náboru roste geometricky s aktuální velikostí armády, výchozí faktor je 1.002 na vojáka; Max a jednotlivé nábory používají stejný výpočet ceny. Military Power je součet `count × basePower` upravený obecnými `militaryPowerMultiplier` efekty. Feudal Organization a Professional Army armádu posilují.

## Kampaně

Defense frontieru je `baseDefense × defenseGrowth ^ territoriesConquered`, výchozí 40 × 1.8^n. Není omezená na seznam předpřipravených území. Vítězství přidává jeden `frontier` do registry území a jeden stavební slot, nikoli kapacitu.

Launch Campaign uloží kopii nasazené armády, Power, Defense, délku a předpověď ztrát. Po dobu kampaně nejde vojáky nabírat ani demobilizovat. Technologie získané během kampaně platí pro další kampaň; její uložený výsledek se zpětně nemění. Výsledek je deterministický: při Power >= Defense vítězství, jinak porážka.

Délka je `baseDuration × Defense / Power` upravená obecnými efekty, výchozí základ 180 s, minimum 15 s, maximum 600 s. Silnější armáda tak kampaň zkracuje. Jde o délku probíhající herní akce, ne čekací podmínku odemčení éry.

Úspěšná armáda ztratí `max(2 %, 16 % / powerRatio²)` každého typu, počty zaokrouhlené dolů. Například při poměru 1.5 jsou základní ztráty přibližně 7.1 %. Slabší armáda ztratí 35 % + 35 % × (1 − ratio), nejvýše 70 %. Fortifications ztráty násobí 0.65. Před útokem jsou Power, Defense, assessment, délka a konkrétní procento viditelné. Neexistuje RNG.

Ztráty odečtou vojáky i jejich footprint z Population; neovlivní kumulativní počet vytvořených lidí. Dokončení zapíše event log a notifikaci. Stav se vyhodnotí v jediném `simulate` na časové hranici kampaně. Živý průběh, reload i offline proto používají stejné pravidlo a odměnu nelze získat podruhé za tutéž dokončenou kampaň. Offline report rozlišuje nové lidi, válečné ztráty a získaná území.

## Epochy a nové technologie

| Další éra    | Technologie                                                                | Další požadavky                                                                                  |
| ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Agricultural | Agriculture                                                                | Population 20                                                                                    |
| Bronze       | Mining, Writing, Organized Warfare                                         | Population 50, Territories 2, alespoň 2 Settlement nebo vyšší                                    |
| Classical    | Mathematics, Construction, Formal Education                                | Population 150, Territories 4, Capacity 200                                                      |
| Medieval     | Engineering, Institutional Learning, Classical Army                        | Population 400, Territories 7, alespoň 2 City nebo vyšší, Military Power 700                     |
| Renaissance  | Universities, Civil Administration, Professional Army, Long Distance Trade | Population 1000, Territories 10, alespoň 5 City nebo vyšší, Capacity 1500, Military Power 6000   |
| Industrial   | Steam Power, Mechanization, Early Industry                                 | Population 2000, Territories 16, alespoň 10 City nebo vyšší, Capacity 2500, Military Power 40000 |

Overview ukazuje pouze další epochu s každým požadavkem, aktuální hodnotou a stavem Met / Needed. Nové podmínky jsou součástí obecného `Condition` evaluatoru. Éry se dále přecházejí ručně, bez resetu, s jedním Civilization point při prvním vstupu.

Přibylo 26 technologií, celkem je 57:

- Agricultural: Village Organization, Organized Warfare.
- Bronze: Archery.
- Classical: Aqueducts, Classical Army.
- Medieval: Feudal Organization, Fortifications, Heavy Plow, Guilds, Universities, Civil Administration, Professional Army, Masonry, Long Distance Trade, Sanitation.
- Renaissance: Printing Press, Humanism, Navigation, Gunpowder, Banking, Scientific Method, Advanced Urban Planning, Early Industry, Steam Power, Mechanization.
- Industrial: Factories.

Steam Power a Mechanization jsou pozdní Renaissance technologie umožňující vstup do Industrial Age. Factories jsou počáteční industrial obsah s unlockem existujících tierů Industrial Farm, Factory a Laboratory. Plný Industrial/Energy obsah zde ještě není. Metropolis je dostupná po Advanced Urban Planning. Navigation zrychluje kampaně a připravuje znalost pro budoucí exploration; Banking a Long Distance Trade zatím neodemykají Wealth.

## Pacing a centrální nastavení

Násobiče Research cen pro Tribal / Agricultural / Bronze / Classical / Medieval / Renaissance / Industrial jsou 1 / 10 / 40 / 180 / 800 / 4000 / 20000. Materials násobiče jsou 1 / 5 / 15 / 50 / 180 / 600 / 2000. Základní ceny zůstávají v definicích technologií. Pozdější výzkum tak drahne rychleji než samotné produkční bonusy.

Cena růstu používá 1.12 do populace 20, 1.012 od 20 do 400 a 1.004 nad 400. Mírnější pozdější část zabraňuje prakticky nedosažitelným tisícovým populacím; kapacita a náklady na sídla a armádu představují další limity. To je první balance pass, nikoli přesný časový slib každému hráči.

Automatický hráč z nového save s deseti počátečními kliknutími a bez grantů dosáhl:

| Milník       |  Simulovaný čas |
| ------------ | --------------: |
| Agricultural |           5 min |
| Bronze       |       1 h 9 min |
| Classical    |      2 h 19 min |
| Medieval     | 4 h 40 min 30 s |
| Renaissance  |      8 h 28 min |

Průchod skutečným prohlížečem s běžnými UI akcemi a pouze vývojovým speed multiplierem dosáhl Agricultural za 16 min 40 s, Bronze za 1 h 23 min 20 s, Classical za 2 h 38 min 20 s a Medieval za 5 h. Nepoužíval přidávání zdrojů, populace, území ani technologií. Méně časté rozhodování v tomto UI průchodu přirozeně prodloužilo čas oproti engine průchodu.

Hráč průběžně investuje, přerozděluje pracovníky, staví sídla, rekrutuje armádu a dobývá území. Žádná éra nemá podmínku uplynulého času. Při ladění jsou nejúčinnější `technologyCosts`, `eraRequirements`, `populationGrowth`, `settlements.costGrowth`, `military.recruitCostGrowth` a `conquest` v `content/config.ts`; ceny, kapacity, produkce a jednotkové power zůstávají v content registries.

## Statistika, save a rozšiřování

Statistics přidává Population Capacity, Owned Territories a Military Power over time po odemčení příslušných features. Census distribuce obsahuje Military podle skutečných footprintů. Sampling zůstává každých 30 simulovaných sekund, nejvýše 2000 bodů na sérii, včetně offline průběhu.

Save v4 migruje všechny předchozí verze. Verze 3 dostane jeden Homeland, jeden Camp, prázdnou armádu a žádnou kampaň; stávající lidé, pracovníci, zdroje, technologie, skilly, achievementy a historie se zachovají. Population nad novou kapacitou zůstává, pouze další růst čeká na zvýšení kapacity. Capacity se odvozuje ze sídel a efektů, neukládá se jako druhá nezávislá pravda. Uložený `populationCapacityBonus` je vyhrazen pro explicitní vývojový grant. Import kontroluje počty, sloty, armádní footprinty a konzistenci rozpracované kampaně. Časy logu jsou celé milisekundy, i když kampaň končí mezi dvěma běžnými tick hranicemi.

Nový typ území přidejte do `content/territories.ts` s `settlementSlots`, případnými `effects` a strategickými resource metadata. Nové sídlo přidejte do `content/settlements.ts`, vojenskou jednotku do `content/military.ts`. Systémy a UI načítají registry; konkrétní tech ID patří do obsahových podmínek, nikoli obecných výpočtů. Grafy dál přidává `content/statistics.ts`; jejich nové `sampleValue` callbacks se vyhodnocují až při samplování, což zachovává bezpečné načítání navzájem odkazovaných engine modulů.

Development panel nabízí + Territory, + Settlement, +100 Capacity, + Military Units, Complete Campaign, odemykání technologií dosažených epoch a zrychlení 10/100/1000. Zobrazuje také aktuální scaling parametry. Tyto granty slouží diagnostice; balance průchody je nepoužívají. V produkčním buildu je celý panel odstraněn.

## Ověření iterace

TypeScript, lint, všech 122 unit/integration testů a production build prošly. Chromium ověřil nový run až do Medieval bez grantů, desktop a mobilní sheets, nové grafy, v3 import s populací nad capem, závazek armády, rozpracovanou kampaň přes reload a její offline dokončení bez dvojí odměny. Production build byl ověřen také ze statického hostingu pod `/civ365/` bez asset 404 a chyb JavaScriptu; deploy dál obstarává stávající GitHub Pages workflow po merge do main.
