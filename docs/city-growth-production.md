# Městský základ růstu a produkční investice

City a Metropolis poskytují základ populačního růstu. Všechny `populationGrowthAmountMultiplier` efekty z technologií, skills, epoch a dalších registries násobí celý základ; bonus měst se nepřičítá až po násobení.

`base = max(minimumBaseAmount, cityCount × (basePeoplePerCity + sum(populationGrowthPerCity)))`

`peoplePerStep = max(1, floor(base × product(populationGrowthAmountMultiplier)))`

Výchozí `basePeoplePerCity = 1`, `minimumBaseAmount = 1` a `minimumCityTier = 3` jsou v `balance.populationGrowth`. Camp, Settlement a Town se do počtu měst nepočítají. City a Metropolis se počítají stejně, takže upgrade na Metropolis nesníží růst. Před prvním městem zůstává základ jeden člověk a raný postup se nezablokuje. Výpočet zachovává Decimal aritmetiku i u velmi velkých počtů; zaokrouhluje až společný výsledek.

Municipal Charters zachovává +30 % kapacity a přidává jeden **základní** člověk za City/Metropolis před násobením. Bez tohoto bonusu dávají tři města při ×16 růstu 48 lidí. S kompletním Medieval výzkumem dávají dvě města základ 4 × multiplier 8 = 32 lidí. Šest Cities a dvě Metropolis v Renaissance dávají základ 16 × multiplier 12 = 192 lidí.

Celá dávka stále stojí aktuální Food cenu jednoho člověka podle předchozí iterace. Food rezerva, kapacitně zkrácené skupiny, zákaz růstu nad kapacitou, historie skutečné spotřeby a živý/offline postup používají společné quote a simulation funkce. Existující populace se při načtení nesnižuje.

## Výnosy a ceny produkčních upgradů

Všechny tři produkční řetězce zachovávají počty potřebných vstupních jednotek i footprint 1 / 5 / 20 / 100 lidí. Vyšší jednotky stále dědí bonusy předchozích tierů. Základní poměr výkonu vůči **celé vstupní skupině** je ×1.6 pro tier 2, ×2 pro tier 3 a ×3 pro tier 4. Další bonus cílového tieru může poměr zlepšit.

| Upgrade         | Vstupní skupina | Základní výkon /s | Základní poměr | Cena Materials / Food / Research |
| --------------- | --------------- | ----------------: | -------------: | -------------------------------: |
| Farmer          | 5 Gatherers     |            4 Food |           ×1.6 |                      20 / 50 / 0 |
| Miner           | 5 Woodcutters   |       4 Materials |           ×1.6 |                      30 / 40 / 0 |
| Scholar         | 5 Thinkers      |      1.2 Research |           ×1.6 |                      40 / 0 / 30 |
| Farm            | 4 Farmers       |           32 Food |             ×2 |                    600 / 500 / 0 |
| Workshop        | 4 Miners        |      32 Materials |             ×2 |                   1200 / 300 / 0 |
| Academy         | 4 Scholars      |      9.6 Research |             ×2 |                   1500 / 0 / 600 |
| Industrial Farm | 5 Farms         |          480 Food |             ×3 |              60 000 / 15 000 / 0 |
| Factory         | 5 Workshops     |     480 Materials |             ×3 |                  100 000 / 0 / 0 |
| Laboratory      | 5 Academies     |      144 Research |             ×3 |              80 000 / 0 / 15 000 |

Pět Farms tedy vyrábí základních 160 Food/s a jedna Industrial Farm se stejnými 100 lidmi 480 Food/s. Přínos je +200 %, před společnými zděděnými bonusy. Analogicky fungují Factory a Laboratory. Ceny i výkony žijí v `content/units.ts`; UI nemá vlastní balance konstanty. Počáteční tier 2 zůstává dostupný za původní ceny. Pokročilé investice mají vyšší cenu za výrazně lepší produktivitu.

Max a jednotlivé upgrady platí stejné ceny a spotřebují stejné vstupy. Rozebrání vrací vstupní jednotky a zachovává lidi; utracené prostředky se nevracejí. Dříve postavené jednotky dostanou nový výkon při načtení, bez dodatečného účtování starých investic.

## Rozhraní a ukládání

Population ukazuje Cities + Metropolises, základní lidi na město, společný základ, multiplier a výslednou rovnici. Text u Municipal Charters rozlišuje základní bonus. Workforce má přímo na kartě viditelný poměr výkonu při stejné pracovní síle; dosavadní Production comparison dál ukazuje náhradu, novou jednotku i skutečný Net gain.

Nový rozpad růstu a yield ukazatele jsou pasivní discoveries. Zvýrazní svůj list a zůstanou nové do pěti souvislých sekund zobrazení. Kolísání počtů měst, jednotek nebo výnosů nevytváří nové značky. Přidání těchto discovery ID zachovává stará v8 acknowledgement pole, prostředky, populaci, jednotky, kampaně, jazyk a historii. Save verze se nemění, protože nevznikla nová persistentní pole. Nové texty jsou v lokalizačním katalogu a aktuální základní parametry jsou také v development readoutu.

## Ověření

205 testů pokrývá městský základ a fallback, rovnost City/Metropolis, ignorování nižších sídel, společné násobení a konečné zaokrouhlení, extrémně velké počty, cenu jedné celé dávky, kapacitu, rezervu a offline shodu. Testy všech devíti produkčních převodů v sedmi epochách, s bonusy a různými počty jednotek, ověřují minimální poměr ×1.6 / ×2 / ×3 a zachovaný populační footprint. Další regrese ověřuje vyšší industrial investici, Max/single shodu a nové pasivní discoveries přes save/load.

Nový save prošel do Industrial pouze běžnými akcemi a simulací, s deseti úvodními Food kliknutími a bez grantů:

| Éra          | Simulovaný čas |
| ------------ | -------------: |
| Agricultural |          5 min |
| Bronze       |    55 min 30 s |
| Classical    |     1 h 53 min |
| Medieval     |     2 h 40 min |
| Renaissance  |     2 h 50 min |
| Industrial   | 3 h 3 min 30 s |

Pozice rekonstruovaná podle předchozích screenshotů obnoví postup z Renaissance do Industrial za dalších osm simulovaných minut, se skutečnými investicemi, Materials výrobou a kampaněmi. Jde o měření konkrétní politiky, nikoli časový zámek nebo slib doby hraní.

Chromium prošel také nový save přes běžná UI tlačítka, s deseti počátečními Food kliknutími a pouze development speed ×1000: Agricultural za 16 min 40 s, Bronze za 1 h 23 min 20 s, Classical za 2 h 38 min 20 s, Medieval za 3 h 11 min 40 s, Renaissance za 3 h 45 min a Industrial za 4 h 35 min. Průchod nepoužil granty zdrojů, populace, území či technologií. Přidělování velkých skupin přes UI ovladače probíhá v postupných časových úsecích; méně časté rozhodování prodlužuje čas proti engine politice.

Statický produkční build pod `/civ365/` ověřil skutečný starý v8 import, nový rozpad výpočtu a jeho pětisekundové čtení, placenou stavbu City, převod City → Metropolis, růst +96 za jednu cenu, vyšší ceny všech tří industrial upgradů a skutečný poměr ×3, zachovaný footprint, reload, CS preferenci a mobilní sheets při 390 px. Bez JavaScript chyb, asset 404 či development panelu; TypeScript, lint/lokalizační kontrola a production build procházejí.
