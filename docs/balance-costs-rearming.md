# Research, population and rearming balance

Ceny vycházejí z centrálního `content/config.ts`. Tato iterace mění výpočty a nové akce, zachovává existující save v9 a obsah stromu. Staré nákupy a přezbrojení se znovu neúčtují.

## Výzkum po každém nákupu

```text
price(resource) = content cost including era multiplier × purchaseGrowth(resource)^ownedTechnologyCount
Research purchaseGrowth = 1.075
Materials purchaseGrowth = 1.04
```

Každý dokončený výzkum zvýší Research ceny ostatních výzkumů o 7,5 % a Materials ceny o 4 %. Násobení je globální a neresetuje se na hranici epoch. Počet se odvozuje z `researchedTechnologies`, nikoli ze statistického čítače: funguje i pro staré/migrované saves a zachovává již vlastněné technologie. Failed/duplicate research, skill nebo přechod epochy nic nepřidávají.

`technologyCost(state, technology)` používá platební kontrola, odečet, Costs UI, deficit tooltip a testovací player policy. Content definice jsou stále základní ceny. Ceny nevyzkoumaných karet se po nákupu aktualizují; dokončená karta nezobrazuje současnou cenu jako údajně historicky zaplacenou cenu. Research ukazuje procenta i aktuální násobiče. První Foraging stojí původních 8 Research, následující Tool Making 19,35 Research a 10,4 Materials.

## Dosažitelná cena pozdní populace

Do 2 000 obyvatel se původní křivka nemění: základ 10 Food, ×1.12 do 20 lidí, ×1.008 do 400 a ×1.001 do 2 000. Nad tímto bodem už exponenciální část nenarůstá:

```text
price(p > 2000) = price(2000) × (1 + (p − 2000) / 500)^2
```

Technologické/skill `populationCostMultiplier` efekty zůstávají, stejně jako počet lidí z měst a růstové násobky. Celá dávka stále stojí jednu aktuální cenu; větší dávka nenásobí Food účet. Křivka je na hranici spojitá, vždy roste a nemá cenový nebo populační strop. Počítá se v Decimal, i pro populace mimo JS Number rozsah.

S kompletním výzkumem před Atomic a bez skill slev:

| Populace | Předchozí cena dávky | Nová cena dávky |
| ---: | ---: | ---: |
| 2 000 | ~111 Food | ~111 Food |
| 20 000 | ~7,24 miliardy Food | ~152 tisíc Food |
| 50 000 | ~7,62 × 10²² Food | ~1,05 milionu Food |
| 100 000 | ~3,86 × 10⁴⁴ Food | ~4,32 milionu Food |

Kapacita a Food rezerva nadále platí. Uložení nad kapacitou nesníží populaci; další růst čeká na rozšíření. Ruční, automatický a offline růst používají stejnou cenu a zaznamenávají skutečnou platbu.

## Přezbrojení se zmenšením aktivní jednotky

```text
retained = floor(currentUnits × (1 − 0.5))
withdrawn = currentUnits − retained
Idle Population += withdrawn × populationCostPerUnit
```

Vojáci se vrací k civilnímu obyvatelstvu, nezapočítávají se do válečných ztrát a Total Population se nemění. Hráč je musí znovu naverbovat za Food/Materials ceny nového vybavení. Díky tomu typické zdvojnásobení jednotkového Power samo o sobě nezdvojnásobí celé vojsko. Při 10 jednotkách zbude 5; při 9 zbývají 4; při 1 žádná. Výjimka raného Levy → Spearman s trojnásobným základem dává po návratu poloviny net ×1.5, oproti dosavadnímu ×3.

Dosavadní resource quote za přezbrojení podle počtu před akcí zůstává: Food je 25 % náborové ceny cílového tieru, Materials 100 %, bez náborového army-size násobiče. Prázdná kategorie platí jeden training kit. Doplnění stažených vojáků je samostatný placený nábor se škálováním velikosti armády. Tři kategorie, postupné tiery, údržba a counters zůstávají.

Náhled ukazuje aktuální → zbývající počet, navrácenou Idle Population a současnou → výslednou Military Power celé armády. Akce je blokovaná během campaign, bez potřebného výzkumu nebo zdrojů. Při reloadu se nová pravidla zpětně neaplikují na již vybavené vojáky; uloží se skutečný aktuální počet a tier. Nové vysvětlivky cen a přezbrojení mají vlastní pasivní discovery ID: starý save na ně upozorní a pět skutečných viditelných sekund je označí jako přečtené. Změny čísel samy znovu neupozorňují.

## Ověření

TypeScript, lint včetně i18n katalogů a statický production build prošly. 244 testů pokrývá zejména dynamický quote/platbu, opakované a neplatné nákupy, nezměněné content ceny, obnovení ceny z owned IDs, zásoby při vstupu do epochy, původní Food křivku do 2 000, spojitou pozdní část, velké Decimal hodnoty, 20k save a růst po reloadu/offline, 50% návrat lidí, liché/prázdné jednotky, skutečnou platbu rekrutů, generický population footprint a campaign blokace.

Rekonstruovaná pozice kolem 20 000 obyvatel se stejnými starými prostředky a výzkumy pokračovala ručním, automatickým i offline růstem bez dodatečných grantů. Test porovnal 10 minut živé a offline simulace a dosáhl nejméně 30 000 lidí při dodržení capu. Předchozí Renaissance recovery scénář zůstal dosažitelný a vstoupil do Industrial za 480 sekund běžných akcí/simulace.

Průchod z nové pozice používá jen 10 úvodních Food kliknutí a běžné akce, bez grantů nebo časových podmínek. V každé nové epoše zkusí samostatný nákup bez posunu času, s předností nejlevnějších dostupných výzkumů; žádná epocha se tak nedá hned vykoupit.

| Dosažená epocha | Celkový simulovaný čas |
| --- | ---: |
| Agricultural | 5 min 30 s |
| Bronze | 1 h 39 min 30 s |
| Classical | 5 h 25 min |
| Medieval | 9 h 45 min |
| Renaissance | 13 h 16 min |
| Industrial | 18 h 11 min 30 s |
| Modern | 20 h 39 min 30 s |
| Atomic | 23 h 26 min 30 s |

Jde o deterministický balance benchmark s aktivní přerozdělovací politikou, nikoli přesný časový slib běžnému hráči. Potřeba sídel/území, zaplacené vybavení a research postup jsou v průchodu skutečné; lidský čas ani ruční počty kliknutí nepředstavují herní gate.

Chromium ověřil produkční web pod `/civ365/`: zachování v9 pozice, dostupnou cenu celé růstové dávky, zablokované staré Research zásoby pro Atomic, automatiku/offline pokračování, zobrazený a odečtený Research quote, zdražení dalšího výzkumu, jeho správnou blokaci, 9 → 4 vojáky bez ztráty obyvatel, placené doplnění, reload bez druhého odečtu vojáků a nízké počáteční nákupy 8/19,35 Research. Nové vysvětlivky se oznamují a přečtou až po pěti sekundách viditelnosti; značka vydrží reload. CS preference i mobil 390 px prošly bez přetečení, 404 a JS chyby.
