# Civilization.xlsx

Hratelná browserová incremental hra ve stylu světlého tabulkového workbooku. Začněte s jediným člověkem, sbírejte Food, budujte produkční řetězce, objevujte technologie a vstupte do Agricultural Age. Bez backendu, účtu nebo externích služeb.

## Spuštění

Vyžaduje Node.js 22.12+ (ověřeno na 24.19) a npm.

```bash
npm install
npm run dev
```

Pro opakovatelnou instalaci používejte `npm ci`. V cloudovém prostředí s omezeným zápisem do domovského adresáře:

```bash
npm ci --cache /tmp/civ365-npm-cache --no-audit --no-fund
```

## Kontroly a build

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run preview
```

`dist/` je kompletní statický web. Vite používá relativní `base: './'`, takže build lze hostovat také pod `/civ365/` na GitHub Pages. Publikujte obsah `dist/`, nikoli zdrojové soubory; není potřeba SPA fallback ani serverové API. Vývojářský panel se kompilací do produkčního UI nepřenáší. Žádné fonty, obrázky ani data se nestahují z externích služeb během hry.

## GitHub Pages a pull requesty

Workflow `.github/workflows/pages.yml` automaticky spouští TypeScript kontrolu, lint, testy a production build pro každý PR do `main`. Po sloučení do `main` také publikuje obsah `dist/` přes oficiální GitHub Pages Actions. PR samo produkční web nepřepisuje.

Jednorázové nastavení v repozitáři:

1. Otevřete **Settings → Pages → Build and deployment**.
2. Jako **Source** zvolte **GitHub Actions**.
3. Sloučte PR do `main`. V kartě **Actions** sledujte workflow **Validate and deploy GitHub Pages**.
4. Po úspěšném deploymentu bude hra dostupná na `https://wondrej89.github.io/civ365/` (pokud není nastavena vlastní doména).

Při dalších změnách vytvořte pracovní větev a PR do `main`. Po úspěšných kontrolách a sloučení se web aktualizuje automaticky. Pokud už je kód na `main`, lze v kartě **Actions** vybrat workflow a použít **Run workflow**. Pro samotnou hru není potřeba cloudové vývojové prostředí; návštěvníci ji spouštějí přímo z GitHub Pages a save mají ve svém prohlížeči.

## První hraní

1. Sbírejte Food. Po 5 Food celkem se objeví Materials, po 10 možnost růstu populace.
2. Druhý člověk odemkne Workforce a první achievement. Otevřete Food Production a naberte Gatherery; automatická produkce začne s pouhými 10 úvodními kliknutími.
3. Při populaci 5 se objeví Thinker a Research. Naberte Thinkera a Woodcuttera; ostatní mohou sbírat Food.
4. V Research kupujte technologie. Language → Knowledge Sharing → Agriculture odemkne Scholar a Farmer, Woodworking odemkne Miner. Každý vzniká z 5 jednotek předchozího tieru a dalších zdrojů. Například 1 Farmer spotřebuje 5 Gathererů, 20 Materials a 50 Food, stále reprezentuje 5 lidí a produkuje základní 4 Food/s.
5. S Agriculture a populací 20 lze v Overview vstoupit do Agricultural Age. Stav se neresetuje; získáte 1 Civilization point a možnost výběru skillu.

Automatický průchod v testech trvá přibližně 15 minut s jedním Thinkerem a deseti úvodními kliknutími. Více Thinkerů postup zrychlí. Populace Food nespotřebovává průběžně; MVP používá Food jako cenu růstu a upgradu.

Workforce zobrazuje samostatné sloupce Food, Materials a Research. Tier 1 nabízí nábor +1 / +10 / Max a uvolnění −1 / −10 / All. Vyšší tiery nabízejí Upgrade 1 / Max, porovnání produkce a Dismantle 1 / All. Rozebrání vrátí předchozí jednotky, ale nevrací utracené zdroje. Overview ukazuje agregovanou produkci; odkazy otevřou a zvýrazní příslušný sloupec Workforce.

## Architektura

```text
src/game/
  types.ts                  společné typy obsahu, podmínek, efektů a akcí
  state.ts                  počáteční stav, klonování, statistiky
  content/                  herní definice a balance
  engine/
    conditions.ts           společný evaluator podmínek
    effects.ts              aktivní efekty, odvozené modifikátory
    units.ts                řetězce, odvozená populace, nábor a upgrady
    production.ts           součet produkce tierů, preview, cena populace
    simulation.ts           čisté akce a časová simulace
  systems/
    progression.ts          unlocks, technologie, skills, achievementy, eras
    save.ts                 validace, migrace, localStorage, import/export
    offline.ts              offline limit a report
  utils/numbers.ts           Decimal helper, jednotné formátování
  store.ts                  jediný timer, autosave, externí React store
src/components/             workbook UI a jednotlivé sheets
src/hooks/useGame.ts         useSyncExternalStore
```

Engine nemá závislost na Reactu ani DOM. `applyAction` a `simulate` vracejí nový stav. Zdroje, populace, počty `productionUnits` i herní statistiky používají `break_infinity.js` Decimal; čísla typu `number` jsou čas, konfigurace a malé levely skillů. Decimal není přesná finanční aritmetika: zanedbatelné rozdíly se u velmi velkých částek zaokrouhlují.

Jeden timer simuluje skutečně uplynulý čas po 100 ms, React dostává snapshot nejvýše každých 250 ms. Akce nejprve synchronizují čas, aby nábor nebo upgrade nezměnil zpětně minulou produkci. Offline výpočet používá stejnou funkci `simulate` s kroky nejvýše 10 s; tím průběžně vyhodnocuje achievementy a jejich bonusy. Během dlouhých neaktivních intervalů se započítá nejvýše 8 hodin. Nákupy, růst populace a vstup do éry vždy vyžadují hráčovu akci.

`getPopulationFootprint(id)` rekurzivně násobí počty vstupních jednotek. Pro řetězec Gatherer → Farmer → Farm → Industrial Farm vrací 1 / 5 / 20 / 100 lidí. Platí `Total Population = Idle Population + Σ(owned × footprint)`. Upgrade a rozebrání zachovávají oba členy populace; jen nábor a uvolnění tieru 1 mění Idle Population. Max používá minimum dostupných vstupů a zdrojů, bez smyčky přes jednotlivé jednotky.

Všechny progression systémy používají `Condition`: `resourceAtLeast`, `populationAtLeast`, `technologyOwned`, `achievementOwned`, `eraReached`, `featureUnlocked`, `statAtLeast`, `all`, `any`, `not` a konstanty `always`/`never`. Unlocky jsou trvalé a vyhodnocují se do ustáleného stavu. UI používá `isFeatureUnlocked`; sheet registry je v `components/sheets.ts`. Budoucí systémy a Wealth jsou zamčené a skryté.

Jednotky, technologie, skilly, achievementy a éry sdílejí `GameEffect`. Aktivní efekty se odvozují z vlastnictví; základní definice se nemění. Podporovány jsou násobiče produkce/zdrojů/jednotek, ploché bonusy, cena růstu a unlocky. Efekty jednotek se aplikují za každý vlastněný kus: ploché bonusy se násobí počtem, násobiče umocňují. Zmizí po rozebrání. `grantResource` je jednorázový efekt při nákupu či vstupu do éry; jednotky používají pouze průběžné efekty. Skill engine podporuje levely, rostoucí ceny, prerequisite levely i oboustranné vyloučení, i když MVP nabídka používá jen tři jednoduché volby.

Statistiky zahrnují vyprodukované zdroje (za celou hru, nezávisle na útratách), ruční kliknutí, nejvyšší populaci, simulovaný čas, počet technologií a přechodů érami. Event log uchovává posledních 100 událostí.

## Save systém

Klíč localStorage: `civilization.xlsx.save`. Autosave každých 10 s, při skrytí stránky a odchodu. JSON obsahuje `saveVersion: 2`, čas vytvoření/uložení/simulace, Decimal částky jako řetězce, `productionUnits`, objevy, skilly, achievementy, éry, features, statistiky, nastavení a události. Export je Base64 UTF-8 text; import přijímá také JSON.

Import kontroluje strukturu, ID obsahu, nezáporné konečné částky, celé počty jednotek, jejich vážený population footprint, odemčení jednotek, prerequisites, levely a konflikty skillů, éry, nastavení a event log. Nepodporované budoucí verze odmítá. `migrateSave` převádí verze 0 → 1 → 2. Staré `jobAssignments` převede do tieru 1; starý Farmer zabíral jen jednoho člověka, proto se každý změní na jednoho Gatherera. Zachová populaci, zdroje i objevy a vysvětlí převod v event logu. Poškozený automatický save zůstane jako `.recovery` kopie. Při nedostupném localStorage UI upozorní; export funguje i bez něj.

Reset vyžaduje potvrzení. Před importem nebo resetem doporučujeme exportovat starý stav. Savům lze záměrně upravit hodnoty; jde o lokální single-player hru, nikoli ochranu proti cheatingu. Mezi více současně otevřenými záložkami není synchronizace, používejte jednu aktivní záložku.

## Jak přidat obsah

Definice přidejte do exportovaných polí v `src/game/content/`. Hlavní loop měnit nemusíte. Následující příklady jsou návody pro další vývoj, nejsou součástí MVP.

### Produkční jednotka (`content/units.ts`)

```ts
{
  id: 'builder', name: 'Builder', description: 'Build lasting structures.',
  category: 'materials', tier: 3,
  upgradeFrom: { unitId: 'miner', amount: 4 },
  costs: [{ resource: 'materials', amount: 200 }],
  baseProduction: [{ resource: 'materials', amount: 20 }],
  visibilityCondition: { type: 'eraReached', eraId: 'agricultural' },
  unlockCondition: { type: 'technologyOwned', technologyId: 'construction' },
  effects: [{ type: 'unitProductionMultiplier', unit: 'miner', resource: 'materials', value: 1.1 }],
}
```

Tier 1 má `populationCost` (výchozí 1), vyšší tier má `upgradeFrom` bez další ceny populace. Nábor, upgrady, produkce, save i Workforce načtou jednotku z registry. Jedna jednotka může produkovat více zdrojů a ovlivňovat ostatní přes `effects`. Validace definic odmítne neplatný řetězec, cyklus, neznámý zdroj nebo dodatečnou cenu populace na vyšším tieru.

Každý zdroj s viditelnými jednotkami své `category` automaticky vytvoří nový produkční sloupec. Volitelný `productionLabel` určuje název sloupce i odkazu v Overview. UI neobsahuje konkrétní převody mezi jednotkami. `visibilityCondition` a `unlockCondition` rozlišují hidden / revealed (`???`) / available / owned. Čtyři tiery každého současného řetězce jsou připravené v datech; tier 3 a 4 zůstávají zatím skryté.

### Technologie (`content/technologies.ts`)

```ts
{
  id: 'construction', name: 'Construction', era: 'agricultural',
  description: 'Learn to build together.',
  cost: [{ resource: 'research', amount: 100 }, { resource: 'materials', amount: 60 }],
  prerequisites: ['woodworking'],
  visibilityCondition: { type: 'eraReached', eraId: 'agricultural' },
  unlockCondition: { type: 'technologyOwned', technologyId: 'woodworking' },
  effects: [{ type: 'productionMultiplier', resource: 'materials', value: 1.2 }],
  effectText: '+20% Materials production',
}
```

`visibilityCondition` rozlišuje skryté a odhalené karty, `unlockCondition` a prerequisites dostupnost nákupu; cena pak určuje, zda si jej hráč může dovolit. `lockedPreview: true` zobrazí odhalenou zamčenou technologii jako `???`. Vlastnictví znamená stav `purchased`. Pole `era` je metadata; podmínku odkrytí nastavujte explicitně.

### Achievement (`content/achievements.ts`)

```ts
{
  id: 'village', name: 'Village', description: 'Reach 50 people.',
  condition: { type: 'populationAtLeast', value: 50 },
  effects: [{ type: 'productionMultiplier', resource: 'food', value: 1.02 }],
  reward: '+2% Food production',
}
```

Použijte `hidden: true`, pokud hráč nemá achievement vidět před získáním.

### Skill (`content/skills.ts`)

```ts
{
  id: 'craftGuilds', name: 'Craft Guilds', branch: 'Industry',
  description: '+10% Materials per level.', cost: 1, costGrowth: 2, maxLevel: 3,
  prerequisites: [{ id: 'efficientHands', level: 1 }],
  exclusiveWith: ['scholarGuilds'],
  effects: [{ type: 'productionMultiplier', resource: 'materials', value: 1.1 }],
}
```

Vylučované ID musí být skutečně přidaný skill. Efekty se aplikují jednou za získaný level.

### Éra (`content/eras.ts`)

```ts
{
  id: 'ancient', name: 'Ancient Age', subtitle: 'Build something lasting.',
  previous: 'agricultural',
  requirements: [
    { type: 'technologyOwned', technologyId: 'construction' },
    { type: 'populationAtLeast', value: 50 },
  ],
  effects: [{ type: 'productionMultiplier', resource: 'materials', value: 1.1 }],
  onEnterEffects: [{ type: 'grantResource', resource: 'civilizationPoints', value: 1 }],
}
```

Overview automaticky nabídne přechod po splnění podmínek. Vstup se zaznamená bez resetu. Nové features přidejte do `content/features.ts`, jejich unlock podmínky mohou používat `eraReached`. Pro novou obrazovku přidejte komponentu a záznam v `components/sheets.ts` s `requiredFeature`; neduplikujte podmínky éry uvnitř UI.

Nový zdroj přidejte do `content/resources.ts`: engine, produkce, formatter a save automaticky použijí registry. Nové uložené údaje či přejmenování ID mohou vyžadovat migraci. Balancování je v `content/config.ts` a příslušných content definicích.

## Rozsah a omezení

MVP končí herním obsahem Agricultural Age. Economy, Energy, Space a Prestige nejsou implementované ani viditelné. Skills poskytují první jednorázovou volbu; další body vyžadují přidaný obsah. Grafiku tvoří workbook, KPI, tabulky a jednoduchý ukazatel postupu, bez složitých animací. Budoucí mechaniky s průběžnou spotřebou zdrojů budou potřebovat systém receptů; nynější jednotky zdroje spotřebovávají při upgradu a průběžně pouze produkují.

Kritické unit/integration testy pokrývají odemykání, časovou produkci, workforce invarianty, technologie, podmínky, efekty, achievementy, přechod éry, skilly, save roundtrip/validaci/migraci, offline produkci a úplný průchod první epochou. UI lze ověřit také přes reálný prohlížeč.
