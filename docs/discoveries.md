# Nový obsah a čitelná oznámení

Nově odemčená záložka dostane výraznější název, zlaté pozadí a bodovou značku. Zůstane označená do jejího otevření, včetně navigace přes odkazy z Overview nebo jiného listu. Nový obsah na již navštíveném listu záložku znovu označí. Otevření zruší značku záložky, ale nové prvky uvnitř listu zůstanou označené samostatně.

Klikatelný prvek ztratí zvýraznění po použití svého dostupného ovládání: tlačítka, přepínače, dropdownu, textového vstupu nebo odkazu. Klik na prázdné místo, pouhý focus či disabled ovládání značku neodstraní. Klávesnicová aktivace funguje přes stejné click/change události jako myš. Pokud prvek obsahuje více ovládacích prvků, stačí použít jeden z nich.

Pasivní prvek potřebuje **pět souvislých skutečných sekund** zobrazení. Alespoň 50 % jeho plochy musí být viditelné; `IntersectionObserver` respektuje i vnitřní scroll technologického stromu a listů. Změna listu, odscrollování nebo skrytí dokumentu odpočet zruší. Offline dialog čtení pozastaví a po zavření začne nový interval. Simulation speed ani offline progress čas čtení nezkracují. Po reloadu začne neukončené čtení znovu; dokončené přečtení zůstává uložené.

## Registry a komponenty

- `game/content/sheets.ts` drží společné ID, názvy a feature gates listů; renderer doplní komponenty a ikony.
- `game/systems/discoveries.ts` odvozuje aktuální objevy ze stejného obsahu a podmínek jako UI. Každý má stabilní ID, list a režim `interactive` / `passive`. Kontroluje také otevírání listu, potvrzování prvku a ID pro save validaci.
- `components/Discovery.tsx` zachovává původní DOM typ, rozložení, accessible názvy i focus. Přidává outline a popis nového obsahu, sleduje viditelnost a zachytává ovládací interakce. Provider počítá registry jednou pro aktuální snapshot a blokuje čtení za offline dialogem.
- `gameStore.visitSheet` a `gameStore.acknowledgeDiscovery` ukládají UI metadata bez změny ekonomiky, populace, jednotek, kampaně nebo event logu.

Registry pokrývá výrobní tiery, research uzly, sídla, vojenské kategorie a vybavení, špionáž, produkční bonusy, grafy, skills, achievementy, automatický růst a jeho technologické modifikátory. Overview sleduje nová resource KPI, ledger řádky, ruční ovládání, odkazy, další epochu i nový guidance krok. Population sleduje také nově zobrazené resource řádky a kapacitní upozornění; nové kampaně mají samostatné informační panely.

Locked preview a dostupný interaktivní prvek mají různá ID. Přečtený náhled tedy nezruší značku při skutečném odemčení jednotky, výzkumu nebo equipment upgradu. Earned achievement je nový objev i po přečtení jeho `In progress` řádku. Běžná změna ceny, počtu, produkce nebo další Activity záznam novou značku nevytváří. Nová procenta již získaného territory bonusu nemění jeho přečtený stav; první získání bonusu je samostatný objev po jeho nulovém náhledu.

Při přidání nového prvku doplňte jeho podmínky a stabilní ID do registry a validátoru, potom označte skutečný UI blok přes `Discovery`. Registry nepatří do UI komponent a ID se nepřekládají. Všechny veřejné popisy používají existující EN/CS katalogy.

## Save v8

`discoveryProgress` drží tři nezávislá pole: `openedSheets`, `noticedItems` a `acknowledgedItems`. Značky přežijí autosave, export/import i reload. Reset založí nový přehled. Poškozená ID, duplicity nebo potvrzený prvek bez odpovídajícího noticed ID import odmítne. Předešlé revisions zůstávají platné i po upgradu, přechodu epochy nebo dokončení výzkumu.

Migrace v7 → v8 označí již existující listy a obsah jako přečtené. Starý hráč tak nedostane najednou značky za všechno, co již měl. Ukládání původní populace, zdrojů, armády, historie, kampaní a jazyka pokračuje beze změny. Následující nové odemčení, včetně offline dosaženého achievementu, už zůstane nepřečtené do skutečné návštěvy a čtení/interakce. Starší migrace pokračují přes v7 do v8.

## Oznámení

Od viewportu 1440 px mají toast zprávy text 16 px, větší padding, šířku až 460 px a ikony 28 px. Od 1920 px používají text 18 px a šířku až 520 px. Achievementy zobrazují Award ikonu. Mobilní rozměry stále respektují šířku displeje a spodní navigaci.

## Ověření

172 testů pokrývá všechny dosavadní herní systémy i nové značky, nezávislost tab/item potvrzení, opětovné odemčení po preview, novou resource řádku, equipment research, růstové modifikátory, achievementy, špionáž, save/load, validaci a v7 migraci. Celý engine průchod nového save dál dosáhne Renaissance bez grantů za 4 h 9 min simulace.

Chromium ověřil skutečná UI ovládání, nové záložky, opětovné zvýraznění po výzkumu, nezávislé prvky, disabled ovládání, reload, čtení až po pěti sekundách, reset odpočtu při změně listu nebo scrollu, skrytý dokument, offline modal a stejný skutečný čas při ×1000 simulaci. Ověřil také růstové bonusy, 16/18 px oznámení a registry markerů na všech deseti listech při šířce 390 px bez přetékání nebo JavaScript chyb.

Finální production build prošel statickým hostingem pod `/civ365/`, včetně skutečného v7 savu, zachování ekonomiky a jazyka, potvrzení náboru, pasivního čtení, reloadu a EN/CS na mobilu. Žádné asset 404 nebo vývojový panel. TypeScript, lint včetně katalogů a build prošly; stávající Pages workflow publikuje po merge do main.
