# Pořadí výzkumu a návaznosti ve v7

Graf již nemá ručně zadané řádky. Každý uzel dostane řádek `max(řádek rodičů ve stejné éře + 1)`, nebo 0 pro počáteční výzkum dané éry. Počítá se z celého registry, včetně momentálně skrytých objevů. Relativní řádek se tedy po odhalení dalších uzlů nemění. Každá spojnice směřuje dolů a mezi výzkumy jedné větve nejsou prázdné řádky bez důvodu.

Vojenský a logistický výzkum má vlastní pátý sloupec a branch label `military`. Organized Warfare je v prvním kroku po Settled Life, vedle Village Organization a nad Natural Growth. Nadále vyžaduje pouze Settled Life a stojí 600 Research / 400 Materials. Armáda nemusí čekat na města, Division of Labor nebo automatický růst.

Pozice a skutečné prerequisites spolu souhlasí i v ostatních větvích. Přidané hrany jsou:

| Éra          | Nová návaznost                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Tribal       | Foraging → Agriculture                                                                                           |
| Agricultural | Village Organization → Natural Growth; Irrigation → Animal Husbandry; Division of Labor → Stoneworking           |
| Bronze       | Wheel → Advanced Agriculture; Bronze Working → Construction; Organized Warfare → Archery; Archery → Horsemanship |
| Classical    | Engineering → Craftsmanship; Public Health → Aqueducts                                                           |
| Medieval     | Masonry → Long Distance Trade; Civil Administration → Sanitation; Professional Army → Espionage                  |
| Renaissance  | Navigation → Gunpowder; Gunpowder → Military Logistics                                                           |

Aqueducts tak například navazují na Urban Planning → Urban Communities → Public Health, při zachování Engineering prerequisite. Bez Public Health je nelze koupit ani UI tlačítkem, ani přímou game akcí. Classical Army a Supply Lines jsou ve vojenském sloupci, kde je jejich pořadí odvozené ze skutečných vojenských a Engineering podmínek. Industrial Rifling je po Factories.

Různé větve mohou postupovat paralelně. Každý další výzkum ve stejném sloupci však má skutečnou přímou nebo nepřímou cestu od předchozího uzlu. Nové podmínky jsou v `prerequisitesAddedInV7` v content definici a používá je zároveň save migrace. Nákup dál ověřuje všechny prerequisites v enginu; UI pouze zobrazuje jeho výsledek.

## Save v7

Všechny starší převody pokračují do v7. Nejprve se u v6 ověří původní prerequisites, bez nově přidaných hran. Původně poškozený výzkum se tím neopravuje potichu. Pak se již zakoupeným objevům doplní nově potřebná cesta, včetně předků nově doplněných uzlů. Zachová se populace, zdroje, pracovníci, sídla, vojenské vybavení, rozpracovaná kampaň, historie a jazyk. Nesouvisející výzkum se nedoplňuje.

Pokud doplněná cesta zkrátí automatický růstový interval, jeho rozpracovaný odpočet začne od nuly. Tím stará fáze delší než nový interval nezneplatní save; přepínač, Food rezerva a populace zůstávají. Nový v7 save se už ověřuje podle všech podmínek a opakovaný import neprovádí další grandfathering.

## Ověření

158 testů pokrývá všechny nákupní hrany, validní graf, jedinečné pozice, dopředné spojnice, návaznost každého svislého nástupce, časnou dostupnost Organized Warfare, blokované Aqueducts a v6 → v7 převod včetně kampaně a růstové fáze. Plný engine průchod nového save bez grantů dosáhl Agricultural za 5 min, Bronze za 56 min 30 s, Classical za 1 h 55 min 30 s, Medieval za 3 h 29 min 30 s a Renaissance za 4 h 9 min. Éry nemají časové podmínky a hra se na nových návaznostech nezasekne.

Chromium ověřil skutečné UI: Warfare vedle Village Organization a nad Natural Growth; Aqueducts odemčené až po Urban Communities a Public Health; všech 62 karet bez překryvů a všechny rodiče nad jejich potomky; skutečný v6 Medieval save bez ztráty populace, zdrojů, armády nebo CS preference; mobilní navigaci k nevyzkoumanému uzlu při 75/100/125 % zoomu bez přetékání a chyb JavaScriptu.

Produkční build byl ověřen ze statického hostingu pod `/civ365/`: import skutečných v4 a v6 savů, doplnění cesty pro staré Aqueducts včetně resetu růstové fáze, CS přes reload a mobilní navigace. Žádné asset 404, JavaScript chyby ani vývojový panel; GitHub Pages dál publikuje po merge do main.
