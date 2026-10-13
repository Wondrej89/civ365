# Trade, milestone series and future eras

Long Distance Trade v Medieval Age nyní odemkne záložku Trade. Starý save s již dokončeným výzkumem ji získá během nejbližší herní akce/ticku; není nutné znovu kupovat research.

## Směna přebytků

Zdroje mají společnou obchodní hodnotu: Food 1, Materials 2, Research 6. Research představuje výměnu znalostí. Směnit lze pouze dva rozdílné dostupné zdroje z tohoto registru; Population, Civilization points a skryté Wealth nelze obchodovat.

```text
received = floor(sold × value(sell) / value(buy) × efficiency)
efficiency = min(95%, 60% + sum(tradeEfficiencyBonus))
```

Základních 1 000 Materials tedy dává 1 200 Food nebo 200 Research. Banking přidá 10 procentních bodů, Oceanic Navigation 5, Railways 10 a Global Markets 10. Achievement za první směnu přidá 1 bod. Bonusy používají obecný GameEffect; strop a hodnoty zdrojů jsou v `content/config.ts`, ne v komponentách.

Každá transakce znovu ověří odemčení, zdroje a rozpočet. Je atomická, cena i obdržené množství odpovídají quote. Počet musí být kladný a celočíselný, lze použít 25/50/100 % zásob nebo Max. Max prodá celé jednotky a ponechá zbytek. UI ukazuje kurz, náklad, příjem a důvod blokace. Směna nemá cooldown a proběhne okamžitě; výzkum a obchodní ztráta určují její hodnotu.

Společná hodnotová základna a účinnost nižší než jedna znamenají, že součin kurzů libovolného cyklu je menší než jedna. Zaokrouhlení příjmu dolů ztrátu pouze zvětšuje. Testy kontrolují všechny dvou- i třízdrojové cykly včetně maximálních bonusů.

Počítají se `tradesCompleted`, `tradeValueExchanged` a objemy prodaných jednotlivých zdrojů. Obdržené zdroje se nezapočítávají do production statistik ani achievementů za vyrobené zdroje. Statistics má po odemčení Trade graf životního objemu směny; obchodní hodnota je množství prodaných zdrojů v jednotkách hodnoty Food.

## Jednorázové a opakované achievementy

Původní First Steps, Getting Organized, Curious Minds a Settled Life zůstávají jednorázové. Přibývají první City, první směna a vstupy do Industrial a Modern Age. Původní `smallTribe` je první populační milník se stejným ID a stejnou odměnou, takže starým hráčům se jeho bonus nepřičte podruhé.

| Série | První cíl | Další cíle | Odměna za stupeň |
| --- | ---: | --- | --- |
| Growing Civilization | rekord 10 obyvatel | 100, 1 000, 10 000… | +2 % Food production |
| Knowledge Through the Ages | 100 vyrobeného Research | 1 000, 10 000… | +2 % Research production |
| Builders of Civilization | 1 000 vyrobených Materials | 10 000, 100 000… | +2 % Materials production |
| Beyond the Frontier | 1 dobyté území | 10, 100… | +2 % Materials production |
| International Exchange | 1 000 obchodní hodnoty | 10 000, 100 000… | +2 % Research production |

Registry nyní generují 18 stupňů každé série z centrálního násobku ×10. Každý stupeň má vlastní stabilní ID v `achievements`; bonusy všech dosažených stupňů se násobí. Po dosažení více cílů najednou se udělí všechny chybějící odměny. Populace používá historické maximum, ostatní série kumulativní statistiky. Ztráty, utrácení, reload a offline postup nepovolí znovu udělit stejný stupeň.

Achievements zobrazuje rekord/celkový objem, další cíl, počet dosažených stupňů, odměnu a rozbalitelný seznam. Získání dalšího stupně znovu zvýrazní kartu a záložku; pasivní karta se přečte až po pěti skutečných sekundách viditelnosti. Trade znovu upozorní na odemčený lepší kurz i nový přehled vylepšení. Číselné změny zásob nebo cen samy upozornění nezakládají.

## Další epochy

Industrial přidává Scientific Crop Rotation, Railways, Mass Education, Public Sanitation, Vaccination, Telegraph, Steelmaking, Combined Arms Doctrine a Electrical Engineering. Modern obsahuje Synthetic Fertilizers, Assembly Lines, Radio, Modern Medicine, Automatic Weapons, Global Markets, Civil Registries, Research Institutes, Mechanized Logistics a Atomic Theory.

Public Sanitation a Modern Medicine snižují Food cenu jedné růstové dávky, Vaccination násobí dávku a Civil Registries přidává člověka do městského základu před násobením. Platí existující cena celé skupiny za jednoho člověka, kapacita i absence hard time gates. Vyšší Food/Materials/Research produkce odpovídá rostoucím research cenám; epochální research multiplikátory jsou Industrial 20 000, Modern 100 000, Atomic 500 000.

Modern vybavení zachovává tři kategorie: Motorized Infantry, Armored Cars a Submachine Gunner. Vyžaduje Automatic Weapons; příslušný equipment upgrade platí pro celou kategorii a nadále spotřebovává zásoby. Pěchota/jízda/střelba zachovává populační footprint, údržbu, counters a combined-arms pravidla.

| Vstup | Výzkumy | Populace | Území | City/Metropolis | Kapacita | Síla armády |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Modern | Electrical Engineering, Vaccination, Combined Arms Doctrine | 8 000 | 20 | 14 | 12 000 | 160 000 |
| Atomic | Atomic Theory, Modern Medicine, Mechanized Logistics, Global Markets | 12 000 | 24 | 18 | 18 000 | 600 000 |

Atomic Age je dosažitelný a má tři vstupní technologie: Electronics, Antibiotics a Precision Manufacturing. Plný další obsah zůstává pro navazující iterace. Zatím se neodemyká Energy ani Wealth. Research graf používá skutečné prerequisites a zachovává pravidlo, že další karta ve stejné větvi nemůže obejít předchozí.

## Save a ověření

Save version 9 přidává obchodní statistiky s bezpečnými nulovými defaults a podporuje nové content ID. Migrace zachovává populaci i nad kapacitou, zdroje, osady, armádu, rozpracovanou campaign, výzkumy, jazyk a v8 discovery metadata. Populační rekordy a produkční statistiky umožní automaticky získat chybějící nové milníky. Načtené seznamy jsou kopie, takže nové odměny nemění původní save objekt. Null discoveryProgress z v8/v9 zůstává neplatný; starší formáty stále dostanou seed.

TypeScript, lint včetně locale katalogů, 230 testů a produkční build prošly. Testy nově pokrývají quote všech šesti směrů, Max, neplatné vstupy, atomickou cenu/příjem, obecné bonusy, cykly bez zisku, volume bez production inflace, roundtrip, catch-up milníky, ztráty a opětovný růst, discovery upozornění, migraci v8 a všechny typy bran Modern/Atomic.

Automatická politika z nového save používá pouze běžné akce a úvodních 10 kliknutí Food. Bez grantů dosáhla Agricultural v 300 s, Bronze v 3 240 s, Classical v 6 510 s, Medieval v 8 940 s, Renaissance v 9 810 s, Industrial v 10 500 s, Modern v 10 920 s a Atomic v 11 490 s (3 h 11 min 30 s simulace). Jde o velmi aktivní optimalizovaný benchmark; nepředstavuje předpověď času běžného hráče.

Build rozděluje knihovny a aplikaci do dvou cachovatelných JS souborů (~250/261 kB). Relativní base `./` a čistě klientské záložky dál fungují pro GitHub Pages pod `/civ365/` bez serverového routingu.

Produkční browser smoke pod `/civ365/` prošel importem skutečného v8 save z předchozí verze, zachováním populace/armády/zdrojů/discovery metadata, první směnou, Research receipt, blokací neplatných vstupů, výzkumem Railways a novým upozorněním na lepší kurz, Max, reloadem, milníkovým seznamem a pěti sekundami viditelnosti, grafem Trade a uloženou CS preferencí. Desktop 1 600 px a mobil 390 px nemají přetečení; oba nové JS soubory a ostatní statické soubory se načetly bez 404 nebo JS chyby.

Samostatný průchod skutečnými tlačítky v Chromium začal novou hru, použil jen 10 Food kliknutí a vývojovou rychlost ×1 000 bez grantů. Dosáhl Agricultural v 1 000 s, Bronze v 5 000 s, Classical v 9 500 s, Medieval v 11 500 s, Renaissance v 13 500 s, Industrial v 16 500 s, Modern v 18 500 s a Atomic v 20 500 s (5 h 41 min 40 s simulace). Všechny přechody proběhly přes checklist, skutečnou stavbu a upgrady, placené vojáky a dokončené campaign; průchod potvrdil ztráty populace i 23 dobytých území. UI akce jsou dávkované mezi kroky simulace a omezené běžnými tlačítky +1/+10/Max. Celá cesta skončila bez JS/HTTP chyb.
