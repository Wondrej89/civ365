# Produkční upgrady a rozlišený výzkum

Vyšší produkční jednotka dědí bonusy všech vstupních tierů podle `upgradeFrom`. Irrigation proto zvyšuje Farmer, Farm i Industrial Farm; Craftsmanship zvyšuje Workshop i Factory. Totéž platí pro obecné `jobProductionMultiplier` efekty a další budoucí řetězce. Každý efekt se použije jednou a respektuje omezení na resource. Bonus vyššího tieru se nevrací do nižších jednotek.

Farm již nedává `1.1 ^ počet Farms` násobič Farmerům a Laboratory podobně nenásobí Academies. Tyto vlastnické bonusy zvýhodňovaly nižší jednotky, rostly exponenciálně a při převodu na vyšší tier mizely. Produkční definice nyní poskytují výhodu přímo svým výkonem při stejném počtu lidí:

| Řetězec   | Základní produkce na člověka od tieru 1 do 4 |
| --------- | -------------------------------------------- |
| Food      | 0.5 → 0.8 → 1.4 → 1.5/s                      |
| Materials | 0.5 → 0.8 → 1.4 → 1.5/s                      |
| Research  | 0.15 → 0.24 → 0.42 → 0.45/s                  |

Všechny tři řetězce zachovávají populace 1 / 5 / 20 / 100 lidí na jednotku, ceny a převody. UI Production comparison počítá skutečný Net gain celého systému, včetně obecně podporovaných vlastnických efektů. Popis Irrigation, Division of Labor, Craftsmanship a Workforce vysvětluje dědění bonusů.

## Různé přínosy navazujících karet

- Language snižuje Food cenu populace o 10 %, Knowledge Sharing přidává 40 % Research.
- Tool Making zvyšuje Materials, Woodworking snižuje Materials cenu sídel o 10 %.
- Irrigation zvyšuje produkci Farmerů a jejich upgradů, Animal Husbandry snižuje Food cenu populace o 20 %.
- Urban Communities dává ×4 lidi za krok při původních 7 sekundách. Public Baths zkracuje interval na 2 sekundy při stejné dávce. Aqueducts pak zvyšuje kapacitu Town a City.
- Printing Press zvyšuje Research, Humanism upravuje cenu a počet lidí, Scientific Method znovu zvyšuje Research.
- Proto-Industry zvyšuje Materials, Steam Experiments snižuje Materials cenu sídel o 10 % a připravuje Industrial Age.

Dokončený Classical výzkum stále poskytuje čtyři lidi každé dvě sekundy; dokončený Medieval výzkum se dvěma městy deset lidí. Dávkový růst, Food rezerva, kapacita, údržba armády a více podmínek pro vstup do epoch fungují dál. Ceny výzkumů ani požadavky epoch se nemění.

## Dobové názvy

| Stabilní ID / původní název                    | Aktuální název         | Éra a význam                                                    |
| ---------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| formalEducation / Formal Education             | Scribal Schools        | Bronze: školy písařů                                            |
| engineering / Engineering                      | Civil Engineering      | Classical: stavby, komunikace a infrastruktura                  |
| institutionalLearning / Institutional Learning | Philosophical Schools  | Classical: školy a akademie                                     |
| publicHealth / Public Health                   | Public Baths           | Classical: veřejné lázně místo moderního zdravotnického systému |
| fortifications / Fortifications                | Castles                | Medieval: hradní opevnění                                       |
| civilAdministration / Civil Administration     | Municipal Charters     | Medieval: městská práva a správa                                |
| masonry / Masonry                              | Gothic Masonry         | Medieval: dobová specializace staršího kamenictví               |
| sanitation / Sanitation                        | Town Waterworks        | Medieval: městské studny, vodovody a zásobování vodou           |
| navigation / Navigation                        | Oceanic Navigation     | Renaissance: oceánská plavba                                    |
| gunpowder / Gunpowder                          | Matchlock Firearms     | Renaissance: palné zbraně místo objevu střelného prachu         |
| earlyIndustry / Early Industry                 | Proto-Industry         | Renaissance: rozvoj řemeslné výroby                             |
| steamPower / Steam Power                       | Steam Experiments      | pozdní Renaissance: pokusy se zařízením poháněným párou         |
| mechanization / Mechanization                  | Mechanical Engineering | pozdní Renaissance: mechanika před průmyslovou mechanizací      |

Factories a Rifling patří dál do Industrial Age; Energy a plný průmyslový obsah se nepřidávají. Prerequisites a jejich grafické vrstvy zůstávají zachované. Anglický katalog je regenerovaný; český placeholder používá aktuální anglické názvy.

## Kompatibilita a ověření

Formát zůstává v8: změna nemá nová uložená pole. Populace, prostředky, počty jednotek, jejich odemčení, rozpracované kampaně, jazyk i značky přečteného obsahu se zachovají. Registry akceptuje také dříve přečtený interval Urban Communities a násobič Public Health, přestože tyto efekty už nejsou aktivní. Historické události mohou obsahovat původní název. Platná rozpracovaná fáze růstu starého save je nadále platná pro nový interval.

Regresní testy porovnávají jednotlivý i Max upgrade všech devíti převodů ve všech sedmi epochách, s úplnými bonusy a smíšenou výrobou včetně milionu vyšších jednotek. Ověřují skutečný kladný rozdíl produkce a zachovaný populační footprint. Další testy ověřují rozlišené efekty růstu, rozdílné přínosy sousedních karet, staré discovery ID a save/export roundtrip.

Kompletní sada má 185 procházejících testů. Nový save prošel pomocí běžných akcí, deseti počátečních Food kliknutí a simulace bez grantů:

| Éra          |  Simulovaný čas |
| ------------ | --------------: |
| Agricultural |           5 min |
| Bronze       |     55 min 30 s |
| Classical    | 1 h 53 min 30 s |
| Medieval     | 3 h 21 min 30 s |
| Renaissance  | 3 h 56 min 30 s |

Jde o jednu deterministickou hráčskou politiku, nikoli časové zámky nebo garantované časy. Populační kapacita, investice do měst a conquest dál podmiňují postup.

Chromium ověřil produkční build ze statického hostingu pod `/civ365/`: v8 import s populací nad capem a původními značkami přečtení, všech devět placených produkčních převodů a reload, skutečný výzkum Urban Communities a Public Baths včetně růstového UI a podmínek, dobové názvy, EN/CS nastavení a mobilní sheets při 390 px. Bez JavaScript chyb, asset 404 nebo vývojového panelu. Grow tlačítko při dosažené kapacitě již nevypisuje záporný nedostatek Food.

Cena celé růstové dávky, aktuální conquest křivka a ověřený vstup do Industrial Age jsou popsány v [renaissance-recovery.md](renaissance-recovery.md). Starší výsledky průchodů výše zachycují předchozí balance.
