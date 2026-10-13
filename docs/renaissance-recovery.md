# Růst populace a přechod Renaissance → Industrial

Původní růst nakupoval každého člověka zvlášť. Bonus ×16 tedy vyžadoval přibližně šestnáct cen, a při nedostatku Food se narodila jen dostupná část. Při populaci kolem 5730 mohl hráč mít téměř všechny lidi v potravinářství, přesto dostávat jediného člověka za krok. Současně obrana potřebných posledních území několikanásobně překračovala vojenský požadavek epochy.

## Cena růstového kroku

`people = min(populationGrowthAmount, remainingCapacity)`

`Food cost = populationCost(currentPopulation)`

Celá dávka 16 či 20 lidí stojí jednu současnou cenu růstu. Cena se nenásobí počtem lidí, nepřičítají se další marginální ceny a nesčítají se části přes populační cenové zlomy. Následující krok cenu znovu vypočítá podle již zvýšené populace. Technologické slevy Food a stávající cenová křivka zůstávají aktivní.

Při nedostatku Food po ochraně rezervy se celá akce neprovede; automatika počká na další pokus. Ruční růst může rezervu použít. Kapacita může dávku zkrátit: pokud zbývají tři místa, narodí se tři lidé za jednu cenu kroku. Při dosažené kapacitě nebo staré populaci nad kapacitou se nic neodečte ani nevytvoří. Živý běh, offline a ruční tlačítko používají totožné pravidlo; statistika utraceného Food zapisuje skutečnou jednorázovou cenu.

Population a Help tuto cenu vysvětlují. Přehled, Grow tlačítka, odpočty, Food rezerva i offline report čtou stejné quote/simulation funkce.

## Obtížnost dobývání

Centrální parametry `balance.conquest` mají původní základ 40 a násobič 1.8 pro prvních osm dobytí, potom násobič 1.35:

`defense = 40 × 1.8^min(conquered, 8) × 1.35^max(conquered − 8, 0)`

Křivka je spojitá, stále rostoucí a bez pevného seznamu území. Varianty Easy / Standard / Hard dál používají ×0.8 / ×1 / ×1.25. Změna neovlivní první conquest ani cestu před Renaissance; platí pro nové kampaně.

| Cílové území | Standard dříve | Standard nyní | Hard nyní |
| ------------ | -------------: | ------------: | --------: |
| 10           |           4408 |          4408 |      5510 |
| 13           |         25 707 |        10 845 |    13 557 |
| 14           |         46 273 |        14 641 |    18 301 |
| 16           |        149 925 |        26 683 |    33 354 |

Industrial požadavky 2000 lidí, 16 území, 10 Cities nebo vyšších, kapacita 2500 a Military Power 40 000 tak spolu souvisejí. Regrese ověřuje jejich dosažitelnost už se 2000 lidmi: 660 rovnoměrně rozdělených vojáků v Renaissance vybavení, 1000 lidí v Food a 340 v Materials. Armáda splní vojenský požadavek, může zvítězit ve všech třech posledních frontier volbách a výroba pokryje údržbu i dávkový růst. Counters dál odměňují vhodnou kombinaci jednotek.

Materials se nadále spotřebovávají na exponenciálně dražší městské investice, nábor, vybavení a stálou údržbu. Oprava ceny růstu uvolňuje pracovníky pro tyto činnosti. Sídla si zachovávají dosavadní kapacitu a stavební náklady.

## Čísla a staré pozice

Kompaktní formátování nyní ořezává pouze desetinné nuly. Při přesnosti 0 proto zůstane 10k, 40k či 100k; dřívější výraz odstranil i koncové nuly celých čísel a vykresloval například 4k místo 40k. Platí pro EN i CS, záporné částky, všechny suffixy a vědeckou notaci. Hodnoty a herní podmínky samy nebyly formátovací chybou změněné.

Save zůstává v8, protože přetrvávající pole se nemění. Při načtení se zachovají populace, historicky zaplacené Food, prostředky, pracovníci, armáda, výzkum, sídla, jazyk a značky přečteného obsahu. Probíhající stará kampaň si zachová uloženou obranu, sílu, délku, odměnu a ztráty; nová křivka nepozmění již zahájený boj. Dokončení funguje offline a odměna se přičte právě jednou.

## Ověření

201 testů ověřuje zejména jednu cenu za celou dávku, průchod přes populační zlomy, kapacitně zkrácenou dávku, čekání na Food a rezervu, počet lidí i skutečně zaplacené Food, živou/offline shodu, číselné nuly, novou křivku, vojenskou a ekonomickou proveditelnost posledních conquest a starý frozen campaign snapshot.

Nový save prošel pouze běžnými akcemi a simulací, s deseti úvodními Food kliknutími a bez grantů:

| Éra          |  Simulovaný čas |
| ------------ | --------------: |
| Agricultural |           5 min |
| Bronze       |     55 min 30 s |
| Classical    | 1 h 53 min 30 s |
| Medieval     | 3 h 21 min 30 s |
| Renaissance  | 3 h 53 min 30 s |
| Industrial   |      4 h 15 min |

Samostatný test obnoví pozici sestavenou podle screenshotů: 5730 lidí, 12 území, 6 Cities + 2 Metropolis + 4 Towns, 233 vojáků, všechny Renaissance technologie, 18.7 milionu Materials a převážně Food pracovníci. Pouze běžnými akcemi dosáhne Industrial za dalších 27 simulovaných minut, se skutečnou Materials výrobou a placenými kampaněmi a městskými investicemi. Nejde o časový zámek ani zaručený čas každého hráče.

Chromium prošel také úplně nový save přes běžná UI tlačítka, s deseti počátečními Food kliknutími a pouze development speed ×1000, bez grantů. Dosažené časy: Agricultural 16 min 40 s, Bronze 1 h 23 min 20 s, Classical 2 h 38 min 20 s, Medieval 3 h 53 min 20 s, Renaissance 4 h 26 min 40 s a Industrial 5 h 16 min 40 s. Rozhodování v delších úsecích přirozeně prodloužilo průchod proti engine politice.

Produkční build ze statického hostingu pod `/civ365/` ověřil skutečný starý v8 import, screenshotovou pozici s růstem +20 za jednu cenu, automatiku bez produkce, zkrácení dávky na tři místa, správný požadavek 40k, campaign reload a offline dokončení s jednou odměnou. Ověřil také CS nastavení přes reload a mobilní sheets při 390 px, bez JavaScript chyb, asset 404 a development panelu. TypeScript, ESLint, lokalizační kontrola a produkční build procházejí.
