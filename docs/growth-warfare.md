# Dávkový růst, města a zásobovaná armáda

Tato změna navazuje na stávající engine a workbook UI. Populace v pozdních epochách nemá růst po jednom člověku při stále dražším jídle; Materials mají trvalé využití ve městech, vojenském vybavení a údržbě. Parametry jsou v `content/config.ts`, ceny a tier chains v content registries.

## Růst

Počet lidí na ruční i automatický krok je:

`floor(product(populationGrowthAmountMultiplier) + City/Metropolis count × sum(populationGrowthPerCity))`.

Urban Communities přidá ×2, Public Health další ×2, Sanitation další ×2 a Humanism ×1.5. Civil Administration přidává +1 za každé City nebo Metropolis. Dvě Cities s kompletním Medieval výzkumem tedy dávají **10 lidí za krok**. Town a Settlement tento městský bonus neposkytují.

Cena dávky je přesný součet cen jednotlivých lidí, včetně přechodů přes populační hranice 20 a 400. Základ 10 Food a počáteční násobič 1.12 zůstávají; další části jsou nyní 1.008 a 1.001. Tím se odstraňuje pozdní extrémní cena, nikoli potřeba Food. `populationCostMultiplier` efekty zůstávají.

Pokud lze zaplatit jen část dávky, narodí se tato část. Stejně funguje zbývající kapacita: tři volná místa dovolí tři lidi i při normální dávce deset. Auto Growth chrání zvolenou rezervu Food; ruční růst ji může použít. Populace nad capem ze starého savu se nesnižuje. UI ukazuje dávku, její cenu, interval i konkrétní growth modifiers.

## Materiálové investice

| Tier       | Základ Materials / Food |               Násobič dalšího upgradu |
| ---------- | ----------------------: | ------------------------------------: |
| Settlement |               100 / 100 | ×1 pro Camp upgrade; nové domovy ×1.4 |
| Town       |              1000 / 300 |                                  ×1.6 |
| City       |            25000 / 1000 |                                    ×2 |
| Metropolis |          250000 / 10000 |                                  ×2.2 |

Každý upgrade má vlastní `settlementInvestments` lifetime counter. První City stojí 25000 základních Materials, druhá 50000, třetí 100000 a desátá 12800000, před technologickými slevami. Převod City na Metropolis tento counter nesmaže. Max je geometrický součet stejných cen jako jednotlivé upgrady; territory footprint se nemění. Nové settlements dál potřebují volný slot.

## Tři kategorie a equipment

`militaryUnits` obsahuje pouze Infantry / Cavalry / Ranged, `militaryTiers` drží jejich aktuální vybavení. Každý voják stále reprezentuje jednoho člověka; obecný `populationCost` zůstává podporovaný. Výzkum zpřístupní další tier, potom hráč zaplatí upgrade celé kategorie. Upgrade zachová počty a populaci; noví vojáci se nabírají do aktuálního tieru. Cena vybaví všechny současné vojáky, u prázdné kategorie jeden training kit. Food tvoří čtvrtinu náborové ceny cílového vybavení, Materials celou cenu, bez náborového army-size násobiče. Upgrady jsou postupné.

| Kategorie | Dostupný řetězec                                                                |
| --------- | ------------------------------------------------------------------------------- |
| Infantry  | Levy → Spearman → Heavy Infantry → Men-at-Arms → Line Infantry → Rifle Infantry |
| Cavalry   | Horsemen → Lancers → Knight → Dragoon → Mounted Rifles                          |
| Ranged    | Archer → Composite Bowman → Crossbowman → Musketeer → Rifleman                  |

Horsemanship odemkne Cavalry v Bronze. Classical Army zpřístupní klasické vybavení, Feudal Organization Knight/Crossbowman, Professional Army Men-at-Arms, Gunpowder renaissance vybavení a Industrial Rifling pušky. Submachine Gunner je připravený budoucí tier s `never` condition; nepřidává neexistující moderní epochu.

Každý tier definuje Power, náborové ceny a **Food / Materials za sekundu**. Upkeep se platí i během kampaně a offline. Supply Lines ×0.8, Professional Army ×0.8 a Military Logistics ×0.75 používají obecný `militaryUpkeepMultiplier`. Ledger a hlavní resource rates ukazují net produkci; Military navíc rozklad gross / upkeep / net a jednotkové náklady.

Při nedostatku se zaplatí jen dostupná část, resources nikdy neklesnou pod nulu a vojáci se automaticky nemažou. Readiness postupně klesá podle podílu dodaných zásob, nejvýše k 50 %, a násobí Military Power. Zásoby ji obnoví. Zhoršení během kampaně může změnit vítězství a casualties; nové technologické power bonusy nemění její zmrazený launch snapshot. Demobilizace uvolní lidi i upkeep.

## Frontiers a špionáž

Každý conquest nabídne Fertile Plains, Mineral Highlands a Scholarly Province: +1 territory/slot a trvalý bonus Food / Materials / Research. Easy / Standard / Hard defense násobiče jsou 0.8 / 1 / 1.25, bonusy 3 / 5 / 8 procentních bodů. Obtížnosti a složení jsou deterministické z pořadí conquest; reload, změna armády ani porážka nabídku nepřehodí. Volba odměny se uloží při launch a po vítězství přičte do `territoryProductionBonuses`. Bonusy stejného resource se sčítají a vstupují do obecného production effect systému.

Infantry counteruje Cavalry, Cavalry counteruje Ranged a Ranged counteruje Infantry. Jeden dostupný vlastní typ znamená nulový vliv counters; dva typy používají menší sílu. Kombinovaná armáda s nejméně 15 % vojáků každého odemčeného typu získá ×1.1. Výsledek vychází z upravené síly a defense, bez RNG.

Bez Espionage UI neprozradí skutečné složení ani přesný tactical power: předpověď pokrývá všechny možné permutace konfigurace obránců. Vyrovnaná armáda má menší rozpětí než jednostranná. Espionage v Medieval odemkne `intelligence`, ukáže procenta typů a přesný výsledek při zachování zásob. UI upozorní, pokud současná zásoba a net produkce nemusí pokrýt délku kampaně.

## Save v6

Všechny starší migrace pokračují do v6. Levy/Spearman/Heavy Infantry se sečtou do Infantry, Archer/Musketeer do Ranged a Knight do Cavalry. Kategorie zachová nejvyšší skutečně vlastněné vybavení, celkovou vojenskou i celkovou populaci, zdroje, pracovníky, technologie, historii a nastavení jazyka. Starému Knight doplní Horsemanship, aby nová base-category podmínka nepoškodila legitimní save.

City counters se bezpečně odvodí ze současných sídel a jejich vyšších tierů. Dřívější frontier zůstane bez dodatečné odměny, nové bonusy začínají na nule a readiness na 100 %. Běžná stará armáda začne platit údržbu podle převedeného vybavení. Již běžící legacy campaign zachová původní Power, délku, vítězství i **ztráty zaokrouhlené v původních jednotlivých typech**, takže sloučení jednotek nezmění zaplacenou populaci. Ztráty ani dokončenou odměnu nelze získat nebo odečíst dvakrát.

Import ověřuje equipment tiers a jejich odkrytí, readiness, investment counters, sloty, military footprint, typ odměny, frozen campaign data a legacy losses. Populace nad capem zůstává chráněná.

## Ověření

152 unit/integration testů pokrývá engine i nové hranice růstu, reserve/partial batches, geometric city upgrades, tři role/equipment, upkeep, supply exhaustion, counters/intelligence, tři odměny, save v6 a offline shodu. Player policy používá pouze běžné akce, kombinovanou armádu a 35 % ekonomické populace pro Materials; její úplný průchod bez grantů dosáhl:

| Éra          | Simulovaný čas |
| ------------ | -------------: |
| Agricultural |          5 min |
| Bronze       |    56 min 30 s |
| Classical    |     1 h 51 min |
| Medieval     |     3 h 18 min |
| Renaissance  | 4 h 0 min 30 s |

Výsledek je měření jedné optimalizované politiky, nikoli časový zámek nebo slib každému hráči. Research a kombinované era requirements zůstávají; rychlejší pozdní populace sama éry neodemkne.

Chromium prošel také nový save přes běžná UI tlačítka, s deseti počátečními Food kliknutími a pouze vývojovým zrychlením simulace, bez grantů zdrojů, populace, území nebo technologií. Agricultural dosáhl za 16 min 40 s, Bronze za 1 h 15 min, Classical za 2 h 21 min 40 s, Medieval za 3 h 45 min a Renaissance za 4 h 35 min. Rozhodování po delších úsecích přirozeně prodloužilo tento průchod proti engine politice.

Samostatný browser test importoval skutečný v4 Medieval save se 700 lidmi a 88 Heavy Infantry bez ztráty populace. Ověřil dávkový růst, placené upgrady zachovávající počty, průběžnou údržbu, skryté a špionáží odhalené obránce a vybranou kampaň přes reload a offline dokončení s jednou odměnou a skutečnými casualties. Produkční build ze statického hostingu pod `/civ365/` ověřil i násobně dražší City, bonus růstu dalšího města, ukládání CS preference a mobilní sheets při šířce 390 px, bez asset 404, chyb JavaScriptu a vývojového panelu.
