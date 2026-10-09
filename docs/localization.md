# Research návaznosti a lokalizace

Organized Warfare je v Agricultural Age přímo po Settled Life, před Organized Settlements. Stojí 600 Research / 400 Materials místo 1800 / 1000 a nepotřebuje Division of Labor. Town je ve stromu vidět před ní, aby bylo jasné, kde zvýšit kapacitu. Organized Settlements navazuje na Natural Growth, Record Keeping a Organized Warfare. Classical Army nyní potřebuje také Organized Warfare, Archery a Engineering, kromě původních Bronze Working, Construction a Census. Engineering tvoří skutečnou klasickou návaznost; vojenské tier unlocks dál respektují společný military feature.

Každý prerequisite brání nákupu v enginu, ne jen disabled tlačítkem v UI. Test kontroluje každou hranu při chybějícím rodiči, neznámá ID, cykly, návaznosti do budoucích epoch a překryvy pozic. Již zakoupené objevy se kvůli novým hranám neztrácejí.

## Posun stromu

**Next unresearched technology** cykluje nejprve dostupné nevyzkoumané objevy a potom odhalené zamčené uzly. Skrytý obsah ani hotové uzly nevybírá. Po nákupu posledního vybraného uzlu začíná opět první dostupnou možností. Pokud nic nezbývá, je tlačítko vypnuté. Posun probíhá uvnitř grafu a respektuje zoom, mobilní šířku i preferenci omezeného pohybu; uzel získá zvýraznění a klávesnicový focus.

## Jazykový základ

Settings obsahuje **Language: English / Czech**. Výchozí jazyk je `en`. Čeština (`cs`) je placeholder: přeložené je ovládání jazyka a upozornění, ostatní text používá anglický fallback. Plný český překlad je další obsahová práce; přepínač už nyní funguje v celé aplikaci. Čísla a časy používají zvolené locale, kořen HTML dostane `lang`. Volba je součástí exportu/importu a autosave, přežije reload i reset civilizace.

- `src/i18n/types.ts`: podporované jazyky, message descriptor a typy parametrů.
- `src/i18n/core.ts`: čisté překladové funkce, interpolace, anglický fallback a rozpoznání historických event templates.
- `src/i18n/LocaleContext.tsx`: React provider a `useI18n`; poskytuje `t`, formátování čísel, času, duration, událostí a chyb.
- `src/i18n/locales/en.json`: generovaný anglický katalog. Anglická zdrojová fráze je message ID, stejně jako v gettext.
- `src/i18n/locales/cs.json`: ručně doplňované české překlady. Neznámý překlad se bezpečně vrátí k angličtině.
- `src/i18n/event-templates.json`: generované šablony pro rozpoznání dřívějších event logů.

UI používá překladové funkce také pro názvy, popisy, bonusy, branch labels, nápovědu, tooltips, accessibility labels a resource/settlement/unit/era/statistics obsah. Definice a ID zůstávají v angličtině a nemění herní logiku. Branding Civilization.xlsx, spreadsheet souřadnice, hráčem vložený save a neznámé zprávy prohlížeče se nepřekládají automaticky.

## Jak doplnit překlad

Do `cs.json` přidejte odpovídající frázi z `en.json`:

```json
{
  "Food": "Jídlo",
  "Organized Warfare": "Organizované válčení",
  "Research {0}": "Vyzkoumat {0}",
  "Advance to {era}": "Postoupit do epochy {era}",
  "{0} researched.": "Výzkum dokončen: {0}."
}
```

Parametry lze přeskládat, ale jejich jména musí zůstat stejná. Statické texty vložte přes `const { t: tr } = useI18n()` a `tr('New text')`; dynamickou větu používejte jako jednu šablonu, například `tr('Advance to {era}', { era: tr(era.name) })`. Samotné ID obsahu, CSS classes a podmínky netransformujte. Texty z registry překládejte při renderování, například `tr(unit.description)`, a nepřepisujte registry podle zvoleného jazyka.

Nové eventy vytvářejte přes `message('Template {name}', { name: definition.name })` a `logEvent`. Save drží anglický čitelný `message` i volitelný descriptor `translation`; překlad vzniká až při zobrazení, takže přepnutí jazyka přeloží i již zaznamenanou historii. Starší známé event formáty rozpozná generovaný registry, neznámý historický text má bezpečný fallback.

Po změně textů spusťte:

```bash
npm run i18n:extract
npm run i18n:check
```

Extraktor sbírá UI message IDs, content texty, chybové zprávy a event templates. Kontrola odmítne zastaralý anglický katalog, neznámé české klíče, odlišné placeholdery, nepřeložené JSX texty a statické veřejné textové attributes. `i18n:check` je součást `npm run lint`, tedy i GitHub CI. Nový jazyk vyžaduje nový katalog, doplnění `languages`, `localeNames`, katalogového registry a nabídky v Settings; změna překladu existujícího jazyka UI úpravy nepotřebuje.

## Save v5

Aktuální formát je v6. Níže popsaný převod v4 → v5 dál probíhá před novým převodem armády, měst a kampaní v [growth-warfare.md](growth-warfare.md).

Migrace v4 → v5 přidá `settings.language: 'en'`. U již zakoupených Organized Settlements doplní Organized Warfare; u Classical Army nově požadované Organized Warfare, Archery a Engineering. Zachová všechny ostatní objevy, zdroje, pracovníky, populaci, armádu, kampaně a historii. Doplní pouze nové hrany těchto dvou definic; poškozené původní prerequisites dál odmítá validace. Běžné nové nákupy už musí splnit všechny podmínky a zaplatit cenu.

JSON import ověřuje podporovaný jazyk a strukturu event descriptorů. Migrace v0/v1/v2/v3 pokračují přes v4 a v5 až do v6; populace nad kapacitou se stále nesnižuje.

## Ověření tempa

V předchozí research/localization iteraci optimalizovaný hráč z nového save bez grantů dosáhl Agricultural za 5 minut, Bronze za 57 minut, Classical za 2 h 2 min 30 s, Medieval za 4 h 34 min a Renaissance za 8 h 21 min. Armáda je dostupná dříve, dlouhodobé multisystémové gates zůstávají. Toto jsou výsledky testovací politiky, ne přesný časový slib každému hráči.

V předchozí iteraci 131 testů ověřilo původní engine i nové prerequisites, navigační pořadí, locale roundtrip, v4 grandfathering, event descriptors, legacy event rozpoznání a fallback/interpolaci. Chromium ověřil EN/CS přes reload, export/import a reset, dynamický překlad názvu/resource/eventu přidáním dočasného testovacího katalogu, nemožnost koupit Classical Army bez Archery/Engineering, cyklování a centrování uzlů při 75/100/125 % zoomu a všechny mobilní sheets bez přetékání a JavaScript chyb. Samostatný browser test produkčního buildu pod `/civ365/` ověřil assety bez 404, migraci v4, uložený jazyk, navigaci výzkumu a mobilní zobrazení; neobjevily se JavaScript chyby ani development tools.
