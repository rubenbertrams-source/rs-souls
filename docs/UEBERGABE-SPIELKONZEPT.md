# RS Souls — Spielkonzept und Reinstrom-Welt (Übergabe an eine externe KI)

> **Zweck:** Diese Datei beschreibt *was* das Spiel sein soll und *in welcher Welt* es spielt.
> Sie enthält bewusst **keine Assets, keinen Code und keine Werkzeug-Pfade**. Wer das Spiel baut,
> setzt Kunst, Technik und Engine selbst um. Zahlen sind **Startwerte aus einem Prototyp** — sie
> sind nicht endgültig balanciert und dürfen angepasst werden, solange das Gefühl erhalten bleibt.
>
> **Stand:** 2026-10-02. Wo sich die Quellen widersprachen, steht die jeweils neueste Entscheidung
> hier; offene Punkte stehen gesammelt in Abschnitt 13.

---

## 1. Die Spielidee in fünf Sätzen

RS Souls ist ein **2D-Seitenansicht-Soulslike mit Roguelike-Elementen**. Es spielt in der
düsteren Tech-Magie-Endzeitwelt **Reinstrom** (siehe Abschnitt 3). Der Spieler führt einen
Überlebenden durch sechs Level: vom Slum am Stadtrand bis ins Labor unter der Megacity. Der Kampf
ist langsam, hart und fair: jeder Schlag ist eine Entscheidung, Ausdauer regiert, Gegner kündigen
Angriffe an (Telegraf), und man lernt durch Sterben. Die Welt erzählt über Spielgefühl,
Architektur und kurze Texte, nicht über Zwischensequenzen. Das Spiel ist ein **zweites Medium für
dieselbe Welt** einer Pen&Paper-Kampagne, aber ein eigenständiges Spiel.

**Leitprinzip:** *Keine Mechanik ohne Wurzel in der Welt.* Jede Regel muss sich aus dem Setting
begründen lassen (Beispiele in Abschnitt 5). Was sich nicht aus Reinstrom ableiten lässt, gehört
nicht ins Spiel.

### Die drei Säulen (Reihenfolge = Priorität)

1. **Welt ist Charakter.** Orte, Geräusche, Architektur und Lesbarkeit der Level erzählen mehr
   als Dialoge. Szenen und Texte bleiben kurz (nie länger als wenige Sekunden).
2. **Tod ist Tempo.** Sterben setzt zurück, aber das Gelernte bleibt (Wissen des Spielers,
   freigeschaltete Dinge). Der Tod hat Gewicht, ist aber keine Strafe um ihrer selbst willen.
3. **Behutsamkeit schlägt Schnelligkeit.** Kämpfe sind kurz, hart und fordern Positionierung und
   Timing. Skill kommt aus Wiederholung, nicht aus Powerleveling.

### Referenzen (je EIN Aspekt, nicht kopieren)

| Spiel | Was wir uns holen |
|---|---|
| **Salt & Sanctuary** (2D-Souls, Hauptreferenz für den Kampf) | Rolle, Block, Parry, Waffenklassen mit eigenem Angriffsmuster, Ausdauer-Kampf |
| **Dead Cells** | Run → Tod → Meta-Fortschritt, knackiges Treffer-Feedback |
| **Hades** | Waffe frei wechselbar, jede Waffe bringt einen eigenen Spezialangriff mit |
| **Hollow Knight** | Bewegungsfähigkeiten als Fortschritt, den man als Held lernt |
| **Blasphemous 2 / Tunic** | Item-Texte als Atmosphäre und stilles Tutorial |

---

## 2. Spielstruktur

### 2.1 Sechs Level, jedes mit Boss (außer Level 1)

Jedes Level ist ein zusammenhängender Sandkasten aus **Räumen** (abgeschlossene Szenen, die Kamera
bleibt an den Raumgrenzen). Räume haben Rollen: *Eingang* (immer mit Rastpunkt), *Weg*
(austauschbar), *Kammer* (optional, versteckt, mit Belohnung), *Rastplatz* (keine Gegner),
*Ausgang*, *Boss*. Ein Rastplatz ist in jedem Level garantiert, ein Level ohne Heilmöglichkeit ist
eine Sackgasse, keine Herausforderung.

| # | Level | Räume (Auswahl) | Boss | Optionaler Zwischenboss | Funktion |
|---|---|---|---|---|---|
| 1 | **Rosttal** | Marktplatz, Seitengasse, Dachweg, Kollektor-Hof, Speicherhof, Schrottplatz, Trümmerfeld 7, Brinas Nische, Yaras Unterschlupf | keiner | — | Lehr-Level: Nahkampf, Telegraf lesen, ausweichen, zuschlagen. Der Markt ist der Anfang, nicht die Prüfung. |
| 2 | **Rohrviertel** | Rohrviertel, Gassen, Unterrohre, Unterrohre-Schacht, Schwarzmarkt-Gang, Pumpstation, Kontrollposten, Vex' Werkstatt | **Verwerter-Konstrukt** | **Schrott-Golem** (bewacht die Pumpstation) | Labyrinth, Smog, Orientierungsverlust; Kollektor-lose Tiefe in den Unterrohren. |
| 3 | **Schwarze Ader** | Sensor-Masten, Versteinerter Baumring, Stiller Tümpel, Der Schlund, Ader-Rast, Ader-Steg | **Kommandantin Riss**, danach **Schlund-Wächter** (Welle) | **Öl-Leviathan** (optional, im Tümpel) | „Tote Zone": Magie kollabiert, Klimax des ersten Akts. |
| 4 | **Der Weg nach Ascheburg** | Flüsterwald, Dickicht, Lichtquell (Rastplatz), Weg zur Rauchschanze, Rauchschanze, Tote Zone unter der Maut (Wellen-Kessel), Ascheburg-Tor | **Asches Sezier-Golem** | — | Gegenpol: grün, still, Erkundung lohnt sich. Danach Beton, Kontrollen, Lärm. |
| 5 | **Ascheburg** | zehn Bezirke (siehe 2.3) | **Schwarzkittel** (Umspannwerk) | **Asches zweites Exponat** (Sektor Forschung) | Die Stadt: Glas, Licht, Kontrolle. Heat-System. |
| 6 | **Finale: Doktor Asche** | Zugang, Gang, Kesselraum, Archiv, Reanimations-Kammer, Labor (+ Schmiede/Kühlsektion als Pfad-Wahl, + 2 Geheimkammern) | **Doktor Asche** (4 Phasen) | — | Ein-Weg-Finale ohne zweiten Rastpunkt. |

Die Verzweigung innerhalb von Level 4 und 5 ist offen: Räume sind in freier Reihenfolge
besuchbar, Abkürzungen (Hebel, Tore) öffnen Schleifen zurück zu früheren Rastpunkten. Ein
bekanntes Muster ist die **Schleife**: Das Rohrtor in Rosttal ist von dort verklemmt und wird
erst durch einen Hebel hinter dem Boss in den Unterrohren geöffnet. Danach führt es direkt
zurück nach Rosttal.

### 2.2 Zwei Arten, ein Level zu bauen

Dieselben Raum-Bausteine tragen sowohl **von Hand gebaute Level** (Akt-Kampagne, wie oben) als
auch **zufällig zusammengesetzte** (Roguelike-Modus: Raumfolge und Gegner-/Beute-Platzierung per
Saat gewürfelt, gleiche Saat = gleicher Run). Der Standardmodus ist die handgebaute Kampagne;
das Würfeln ist ein Bonusmodus, der **Wiederspielwert** liefert. Ein Run soll 15–30 Minuten
dauern; ein Spielstand pro Profil, **kein Permadeath** (der „weiche Modus": Tod hat
Konsequenzen, löscht aber nicht den Fortschritt).

### 2.3 Ascheburg: zehn Bezirke in drei Ringen

| Ring | Bezirk | Inhalt |
|---|---|---|
| außerhalb | **Rauch-Sammler-Dächer** | sicherste Route, Kletterpassagen, ruhig, keine Boss-Gefahr |
| außerhalb | **Verarbeitet-Bezirk** | industrielle Entsorgung; Reste von Verwerter-Konstrukten |
| außerhalb | **Alte-Welt-Relikt-Zone** | tiefste Schicht, Wächter-Automat (Kampf ist hier die schlechteste Lösung) |
| äußerer Ring | **Verwaltungskern**, **Militär-Checkpoint** | Papiere, Zugänge, Garde |
| mittlerer Ring | **Funkengeborene-Arbeiterviertel**, **Fabrikviertel + Hauptumspannwerk**, **Schwarzmarkt** | Arbeit, Produktion, Unterwelt |
| Kern | **Öffentlicher Schauplatz**, **Archiv** | NEBELWERK-Propaganda; Doktor Asches Forschung |

---

## 3. Die Welt: Reinstrom

### 3.1 Ton und Setting

**Dark Fantasy trifft Industrie-Nahzukunft.** Klassische Fantasy-Wesen leben in einer Welt, die
aussieht wie moderne Industrie am Ende: Wellblech, Rohre, Smog, Glasbauten. Die alte Magie ist
fast erloschen und lebt nur als **Tech-Magie** weiter (Runen + Maschinen). Ton: grimdark, rau,
kriegerisch-modern, im Geist von *District 9* (Klassengesellschaft, Ausgrenzung, Konzern-Militär).
Es gibt keine Elfen-Romantik. Thema ist: Wer kontrolliert die Macht, was kostet der Fortschritt,
wer wird abgehängt.

### 3.2 Die Hintergrundgeschichte (uralt, entfacht neu)

- **Das Licht der Erde:** Vor Äonen floss Magie frei aus der erneuerbaren Kraft von Sonne, Wind,
  Wasser und wachsendem Boden. Die ersten Hüter verbanden dieses Licht mit Werkzeugen (Rune +
  Maschine = Tech-Magie in Keimform). Gleichgewicht.
- **Die Schwarzen Adern:** Eine Abspaltung lernte, Macht aus der Tiefe zu reißen (Erdöl, Kohle,
  „das Tote"). Das gab enorme, schnelle Kraft, aber **verunreinigte die Magie**. Daraus folgt das
  Weltgesetz: **Fossile Energie infiziert reine Magie. Volle Wirkung gibt es nur mit erneuerbarer
  Kopplung.**
- **Der Krieg der Adern:** Beide Wege prallten aufeinander; die Magie wurde verwundet und zog
  sich fast ganz zurück. Technik stieg auf, Magie galt als Sage.
- **Der Runen-Kern:** Die Überlebenden des Lichts retteten ein Erbstück, in dem das reinste Licht
  eingeschlossen ruht. Es **schaltet Verzauberungen frei und reinigt fossile Infektion**. Wer ihn
  trägt, ist Verwahrer, nicht Besitzer. Der Stamm ging in den Untergrund.
- **Heute:** Der Konzern **NEBELWERK** herrscht aus der gläsernen Megacity **Ascheburg**. Seine
  Wurzeln liegen in jener fossilen Fraktion. Er weiß vom Kern und will ihn: nicht zum Heilen,
  sondern als **Monopol**. Erneuerbare Magie ist frei und dezentral (Sonne gehört niemandem), also
  gefährlich für NEBELWERK. Fossile Energie ist zentral besitzbar, also Kontrolle.

### 3.3 NEBELWERK

Eine **staatstragende Ordnungsmacht**, kein bloßer Konzern. Emblem: ein Zahnrad, durch das eine
ölig-schwarze Fackel bricht (Farben: Schwarz, Rostbraun, fahles Smog-Gelb). Sprachregelung:
fossile Energie heißt „Betriebsstoffe", Smog „Sicherheitsnebel", verseuchte Zonen „gesicherte
Areale". Glow-Farbe fossiler Technik ist gelb/schwarz oder Cyan (tot), **nie grün**; grün ist
rein. Vier Sektoren: **Militär**, **Technik**, **Forschung**, **Verwaltung/Garde**.
Herrschaftsmittel im Rosttal ist **Entzug**, nicht Gewalt: verdichteter Smog erzeugt die
**Graukrankheit** (Restmagie stirbt, Wesen altern schneller, wirken „minderwertig" und
rechtfertigen so die Ausgrenzung). Wer zu viel Magie wirkt, reißt die „Grauhaut" auf; **Sensoren
schlagen an, Maschinen werden geschickt** („Die Stille": die Unterdrückten unterdrücken sich aus
Angst selbst).

### 3.4 Energie und Wirtschaft (liefert die Spielwährung)

| | **Lumen** | **Glut** |
|---|---|---|
| Was | offizielle Währung, an NEBELWERKs Fossilnetz gebunden | gespeicherte **reine** Energie der Marginalisierten |
| Form | Geldröhren / Credits | **Glut-Zellen** (kleine Akkus mit reinem Licht) |
| Eigenschaft | stabil, aber abhängig vom Konzern; Smog-Steuer („Reinluft-Quote") | schwankend, lokal, **nicht infizierbar** |
| Wert | kauft **Lichtzeit** (die eine Stunde saubere Luft nach der Glocke) | eine Zelle ist mehr wert als viele Lumen; Schwarzmarkt |

Marktruf im Rosttal: *„Schrott für Lumen! Wer Lumen hat, kriegt Licht!"* Wer keine Lumen hat,
bekommt „die Glocke" (Smog, Grauwurf-Zone): **Währung = Überlebenszeit**. Reines Glut-Licht hält
die Infektion fern; NEBELWERK-Sensoren orten reine Glut („das grüne Leuchten") und führen
Razzien durch.

### 3.5 Magie-Zonen (der „Grau-Wurf")

| Zone | Magie | Beispiel |
|---|---|---|
| **REIN** (grün) | volle Kraft | Lichtquell, Reichweite des Begleiters Korro, Licht eines Kollektors |
| **INFIZIERT** (schwarz) | eingeschränkt, riskant | Rosttal, Smog, Ascheburg |
| **TOT** (grau) | Magie bricht zusammen, nur erneuerbare Kopplung wirkt | tiefe Schwarze Ader |

Im Brettspiel-Original ist das ein Würfelwurf (**Grau-Wurf**: W20 gegen 10 bzw. 12, bei
Fehlschlag halber Effekt plus Alarm). Im Videospiel wird es zu **Zonen-Effekten** (Abschnitt 5).

### 3.6 Völker (9)

Ein Volk ist **Kultur und Körper in einer Einheit**, unabhängig von Fraktion und Klasse. Keines
ist besser als ein anderes; alle haben Stärken und Schwächen.

| Volk | Herkunft | Stärke | Schwäche |
|---|---|---|---|
| **Funkengeborene** | Arbeiterviertel Ascheburg | Tech-Geräte kurz ohne Zelle betreiben, Elektro-Improvisation | Nässe/Überladung, Sensoren erkennen ihre Signatur |
| **Rußgezeichnete** | östlich der Schwarzen Ader | Vorteil in Infektionszonen, Ader-Ausdünstung schadet nicht | in reiner Magie benachteiligt, soziales Stigma |
| **Stahlhüter** | Ascheburg-nah, Außenring | Präzisions-Augmente, kaum ermüdbar | Korruptionsadern wachsen von den Implantatnähten |
| **Schattenfischer** | unterirdische Wasserläufe | Wasser-Sinn, Orientierung im Dunkeln | grelles Licht blendet, Trockenheit zehrt |
| **Glockenschläger** | Smog-Glocken-Routen | Filter-Expertise (Gift/Ruß), Glocken-Code | ohne Röhrennetz fehlt das Frühwarnsystem; Lärm |
| **Rost-Geborene** | Rosttal, Außenring (zahlenmäßig die Mehrheit) | zäh, schwere Arbeit mit Schrott-Werkzeug | verwachsene Gelenke heilen langsam |
| **Licht-Geweihte** | Lichtquell, Flüsterwald | Nähe zu reiner Magie | Glühen lässt sich nicht verbergen |
| **Echo-Wandler** | Grenze Rohrviertel/Flüsterwald | Echo einer gesehenen Person (Täuschung) | langes Echo lässt das eigene Original verblassen |
| **Rostsänger** | Trümmerfeld 7, Schrottfelder | hören Metall, erkennen Schwachstellen und Hohlräume | Lärm überwältigt, keine geborenen Kämpfer |

### 3.7 Fraktionen

**NEBELWERK** (Antagonist) · **Stamm vom Licht der Erde** (Hüter des Kerns, versteckt in
Lichtquell; Rollen: Hüter, Weber, Späher) · **Die Rost-Freien** (Yaras Widerstandsnetz im
Rosttal, zwielichtig, eigene Agenda) · **Maschinen-Chor** (defekte, vernetzte Drohnen, die sich
an die Zeit *vor* der Infektion erinnern und das als „uraltes Lied" tragen) · Staat/Garde ·
Nachhall · Glut-Schmiede · Rauch-Sammler (leben auf den Dächern).

### 3.8 Schlüsselfiguren

| Figur | Rolle |
|---|---|
| **Korro** | defekte, umprogrammierte NEBELWERK-Drohne (Fund auf Trümmerfeld 7). Hat eine „reine Zelle": in ihrer Reichweite gilt die Umgebung als REIN. Teil des Maschinen-Chors; Ziel des Sezier-Golems. |
| **Juno Lichtborn** | junger Tech-Magier, trägt den Runen-Kern; lehrt Korro Verzauberungen. Entwickelt einen radikalen Plan (das Netz fluten, siehe 4.). |
| **Yara „Rostherz"** | Rost-Geborene, Anführerin der Rost-Freien im Rosttal; ihr Bruder wurde an der Ader „verarbeitet". |
| **Vex** | ehem. NEBELWERK-Techniker, ausgestiegen; Insider im Rohrviertel. |
| **Brina** | kleinwüchsige Schmugglerin und Informationshändlerin; öffnet den Zugang zur Stadt. |
| **Kommandantin Riss** | Sicherung der Ader; zugleich das Gesicht zu Yaras Verlust. |
| **Doktor Asche** | NEBELWERK-Archivar/Forscher; klinisch fasziniert von Korros Lied, nicht fanatisch. Hinter Sezier-Golem und zweitem Exponat. |
| **Schwarzkittel** | automatisches Notfall-Konstrukt des Netzes („Reinigungs-Protokoll"); springt an, sobald der Kern ans fossile Netz gekoppelt wird. |
| Bezirks-NSCs | z. B. Selin (Propaganda), Cass (Fälschungen), Dett, Neris, Peris, Fenn, Ilv (Alte-Welt-Relikt-Zone), Sael (Verarbeitet), Skarn (Militär) |

---

## 4. Der Story-Bogen (Reinstrom-Akte → Level)

> **Wichtig:** Im Videospiel ist der Held **namenlos**. Die Pen&Paper-Gruppe und die Begleiter
> (Juno, Korro) liefern Welt und Anlässe, der Spieler spielt aber **eine einzelne Figur**.
> Abschnitte, die im Original „die Gruppe" tun, werden im Spiel zu Begegnungen des Helden.

### Akt 1 — „Der Ruf des Rostes" (Level 1–3)
*These:* **„Wer das Licht besitzt, braucht keine Mauern. Wer es nicht besitzt, baut welche."**
NEBELWERK herrscht im Rosttal durch Entzug, nicht durch Wachen. Der Spieler erlebt, dass er schwach
ist, weil jemand ihn schwach hält.
1. **Rosttal (L1):** Alltag im Grau, die Smog-Glocke, die Marktstände. Erster Kontakt zur Welt.
2. **Trümmerfeld 7:** das Summen: Fund von **Korro**, das erste „REIN-Moment" (erneuerbare Magie
   bricht durch den Smog).
3. **Yaras Unterschlupf:** die Rost-Freien; die These aus Sicht der Betroffenen; Hinweis auf die Ader.
4. **Rohrviertel (L2):** Vex' Versteck; er erklärt NEBELWERK, die Ader und den Kern. Schrott-Golem,
   dann das Verwerter-Konstrukt.
5. **Schwarze Ader (L3):** Klimax. Die Ader ist „ein Mund, aus dem die Nacht selbst quillt": ein
   Ring versteinerter Bäume, ein schwarzer, nicht spiegelnder Tümpel, zwei Sensor-Masten. Beweis,
   dass Licht die Infektion verletzt. Kommandantin Riss trägt das Bild von Yaras Bruder,
   gestempelt **VERARBEITET**. Löst sie den Failsafe aus, erwacht der Schlund-Wächter.

### Akt 2 — der Weg in die Stadt (Level 4)
*These:* **Ascheburg „besitzt das Licht".**
Die Ader-Region wird verlassen; im **Flüsterwald** (die erste REIN-Zone seit Akt 1) trifft man
**Juno** und pflanzt den Maschinen-Chor-Hook (Korros altes Lied resoniert im Wald). In
**Lichtquell** (Heimat des Stamms) zeigt man den Beweis, lernt den Runen-Kern kennen und nimmt den
Auftrag „Ader reinigen" an; Juno erzählt seinen Ascheburg-Plan und trennt sich. An der
**Rauchschanze** (Grenze, NEBELWERK-Abfang) ist **Brina** der Schlüssel. Am **Ascheburg-Tor**:
Die Stadt ist schön, die „reinen" Brunnen hängen aber am NEBELWERK-Netz („Leuchtgefängnis"). Doktor
Asche meldet sich als Hologramm/Stimme und schickt den **Sezier-Golem**, der Korro erbeuten soll.

### Akt 3 — Ascheburg (Level 5)
Freier Hub aus zehn Bezirken; kein Zwang, alle zu besuchen (fehlende Bezirke = fehlende Vorteile,
kein Blocker). Ilv (Relikt-Zone) liefert den Faden zum Klimax. Im **Hauptumspannwerk** koppelt Juno
den Runen-Kern an das fossile Netz; das löst **Schwarzkittel** aus. **Bewusster Cliffhanger:**
Junos Wahl bleibt offen: das Netz **fluten**, **zähmen** oder **stoppen**. Weder NEBELWERKs
Kontrolle noch Junos Flutung ist eine saubere Antwort.

### Level 6 — Finale unter der Stadt (nur im Spiel)
Im Spiel führt der Weg danach in Doktor Asches Labor. Das **Konzept**: Ein-Weg-Finale (wer reingeht,
kommt als Sieger oder tot heraus; ein einziger Speicherpunkt am Eingang), steigende Eskalation je
Raum, drei benannte NSCs mit unterschiedlicher Haltung zu Asche (**Sahl**, der Mechaniker;
**Rill**, die Archivarin; **Varrek**, die Wache), je drei Story-Slots pro Raum (NPC, Terminal-Log,
Lore-Gegenstand). Ab dem Kesselraum eine **Wahl mit Konsequenz**: *Gewalt-Pfad* (Schmiede: kürzer,
härter, viele Gegner) oder *Reinigungs-Pfad* (Kühlsektion: länger, ruhiger, mehr Lore, Zeitdruck,
liefert einen Glut-Resonanz-Kristall). Beide führen zum Archiv (Subjekt-Pods, erwachende Wachen)
und zur Reanimations-Kammer (Wandgemälde mit der ganzen Geschichte). **Boss in vier Phasen** mit
Story-Auflösung: Phase 1 *Diagnose* (obere Ebene, Glut-Strahl), Phase 2 *Eskalation* (die Ebene
bricht, Asche ruft zwei Assistenten), Phase 3 *Kollaps* (die Decke bricht ein), Phase 4
*Auflösung* je nach Pfad (Gewalt: finale Glut-Welle, Abschluss durch sauberen Parry;
Reinigung: Kristall-Wurf, Asche fängt ihn, „Es funktioniert. Endlich."). Die Geister der drei NSCs
erscheinen als Erinnerungen je Phase.

> *Hinweis zur Abweichung vom Original:* In der Pen&Paper-Kampagne tritt Asche nur als
> Hologramm/Stimme auf und wird nicht bekämpft. Dass das Spiel sie als Endgegner hat, ist eine
> bewusste Entscheidung für das Spiel. Der Wandel soll Asche trotzdem nicht zum Monster machen:
> klinische Faszination, „ich konnte sie nicht alle retten".

---

## 5. Kernmechaniken (jede mit Weltbegründung)

| Spieler-Erfahrung | Begründung in der Welt | Umsetzung |
|---|---|---|
| Ich sterbe und verliere meine Glut | Grau-Wurf frisst Leben ohne Licht | **Tod = die getragene Glut bleibt als Glut-Zelle am Todesort liegen.** Genau **ein** Bergungsversuch; stirbt man vorher erneut, ist sie weg. |
| Ich renne zum Kollektor | Licht hält den Grau-Wurf fern | **Kollektor = Rastpunkt**: heilt, füllt Ampullen, setzt den Wiedereinstieg, ermöglicht Aufwertungen, lässt Gegner zurückkehren. Sein Lichtkreis ist **sicher**; der gezeichnete Radius zeigt, wie weit „sicher" reicht. |
| Ich atme schwer im Smog | Smog = ungefilterte Abluft | **Atem statt Ausdauer**: Kampfressource; in Smog-Zonen regeneriert sie nur halb so schnell. |
| Ich weiche aus und schlage zurück | Ausweichen ist Überlebensstrategie | Rolle (i-Frames) + Telegraf + Trefferfenster |
| Ich öffne Abkürzungen | Kontrolle über die Infrastruktur | Hebel öffnen Tore und schließen Schleifen |
| Ich klettere auf die Dächer | Rauch-Sammler-Dächer = sichere Route | vertikales Level-Design, je höher, desto heller |
| Ich muss mich entscheiden, wie laut ich vorgehe | Ascheburgs Zugangs- und Kontrollsystem | **Heat** (siehe unten) |
| Ich fühle mich „angesteckt" | Grau-Wurf-Infektion | **Infektionsbalken** (optional): füllt sich *außerhalb* des Kollektorlichts, in Smog schneller; bei voll: HP-Verlust über Zeit, kein sofortiger Tod; heilt am Kollektor oder per Ampulle. |

**Die Glut** ist zugleich **Währung und Erfahrung**. Am Kollektor setzt man sie in Vitalität, Atem
und Kraft um. Ohne diese Senke wäre Sterben folgenlos; ohne den Verlust beim Tod wäre die Senke
nutzlos. **Die Glut-Ampulle** ist der Heiltrank (Startwert: heilt 55, Stapel bis 3), nur im Kampf
trinkbar und dabei verwundbar. Sie wird am Kollektor aufgefüllt (nicht durch Sofortheilung).

**Heat (nur Ascheburg):** Zähler 0–10 pro Run (**beginnt jeden Run bei 0**), steigt mit jedem
besiegten Gegner und mit lauten Aktionen, sinkt am Kollektor und mit der Zeit.
- ab **4**: Gegner erscheinen häufiger in Elite-Fassung
- ab **7**: der **Riot-Kommandeur** taucht als Jäger auf und folgt über Räume hinweg
- ab **9**: wer Ascheburg so verlässt, bekommt einen zusätzlichen Bosskampf samt Beute

Heat macht **Kämpfen zur Entscheidung**: mehr Glut jetzt gegen einen ruhigeren Ausgang. Das trägt
Wiederholung, ohne ein einziges neues Bild zu kosten.

---

## 6. Das Kampfsystem (Zielzustand)

Referenz: Salt & Sanctuary. Alles **datengetrieben**: Waffen, Bewegungsmuster und Gegner sind
Daten auf einem kleinen, neutralen Kern. Der Kern kennt keine Welt-Begriffe (Glut, Kollektor,
Atem); die Welt ist eine austauschbare Datenschicht (damit eine zweite Welt ohne Code-Änderung
möglich ist).

### 6.1 Held und Eingaben

Laufen, Sprung (variable Höhe), Rolle, Schlag, Blocken, Ampulle, Interagieren, Inventar,
Waffenwechsel, Waffen-Fähigkeit, Klassen-Fähigkeit. **Controller durchgängig**, kein Menü darf die
Maus brauchen.

### 6.2 Angriffe, Waffenklassen und Ketten

Eine **Waffenklasse** hat ein eigenes **Move-Set**: eine Kette von Angriffen mit
Vorlauf → aktiv → Erholung, Schaden, Poise-Schaden (Stagger), Rückstoß, Ausdauerkosten. Ein
kurzes Kombo-Fenster nach dem Treffer setzt die Kette fort; ein Input-Buffer (0,12 s) merkt sich
einen zu früh gedrückten Schlag. **Richtungsvarianten:** Hoch/Runter beim Schlag wählt
Aufwärts- bzw. Abwärtshieb, in der Luft einen Luft-Angriff; fehlt die Variante, fällt es auf den
Vorwärtsangriff zurück. **Halten** lädt einen Ladeschlag. Wirkungsarten: *Hieb* (breite Zone),
*Stich* (lang und schmal), *Wurf* (Bogen), *Schuss* (gerade), *Ladung*. Nichts bricht einen
aktiven Schlag ab; die Rolle bricht die Erholung erst ab der Hälfte ihrer Dauer ab. Während des
aktiven Schlags dreht sich der Held nicht um.

| Klasse | Waffen | Muster | Verteidigung |
|---|---|---|---|
| **Klinge** | Rost-Klinge, Asche-Schleier | 3er-Kette (Hieb–Hieb–Stich), Ladung = weiter Schnitt | Block 50 %, Parry-Fenster 0,20 s |
| **Hammer** | Verwerter-Hammer | 2er-Kette, **langsam, hoher Stagger**, Ladung = Bodenschlag, der auch auf Weltobjekte wirkt; stemmt den Helden zurück; Lauftempo 0,85 | **kein Block** |
| **Stab** | Lumen-Stab, Glut-Zepter | 3er-Kette Stich–Stich–Wirbel, **lange Reichweite** | Block 35 %, Parry 0,25 s |
| **Dolch** | Lumen-Dolch | 4er-Kette, **schnell, niedriger Stagger** | kein Block, Parry 0,15 s (Ausweich-Parry) |
| **Schuss** | Druckluft-Pistole, Schrott-Flinte | Projektil mit Ladezeit, Kolbenhieb im Nahkampf | kein Block |
| **Handschuh** | Schlacken-Hand | 3er-Kette kurz, Ladung = Griff | Block 70 %, Parry 0,30 s (Schild-Rolle) |

### 6.3 Poise, Stagger, Block, Parry

- **Poise** (Gegner-Haltung): jeder Treffer zieht Poise ab; bei 0 wird der Gegner für kurze Zeit
  **gestaggert** (kein Angriff, kein Laufen), danach ist Poise wieder voll. Nach 1,5 s Ruhe regeneriert sie.
- **Block** (Halten): reduziert Schaden um die Klassen-Reduktion und kostet Ausdauer je Treffer;
  Ausdauer 0 = **Guard-Break** (0,6 s verwundbar). Beim Block halbiert sich das Lauftempo.
- **Parry**: Das erste Zeitfenster eines Blocks. Trifft ein *parierbarer* Gegnerangriff exakt dann
  ein, wird der Gegner lang gestaggert, und der Held erhält ein **Riposte-Fenster** (1,2 s,
  Schaden ×2,5 auf den nächsten Treffer). Nicht parierbare Angriffe (Kriecher, Ratten, Wild)
  werden wie ein normaler Block behandelt. Humanoide und Konstrukte sind parierbar.
- **Hitstop** 0,04 s (leicht) bis 0,07 s (Stagger/Ladung): nur Held und getroffener Gegner frieren
  kurz ein. **Screenshake** 2–4 px nur bei Stagger/Ladung.

### 6.4 Fühlbarkeit (Pflichtwerte für „fühlt sich gut an")

Coyote-Zeit 0,10 s · Sprung-Buffer 0,12 s · variabler Sprung (Taste loslassen bei Aufstieg:
Geschwindigkeit ×0,45) · Sprunghöhe ca. 108 px (Level-Geometrie hängt daran) · Rückstoß auf den
Helden 0,15 s ohne Steuerung · Angriff-Input-Buffer 0,12 s.

### 6.5 Gegner

Gegner nutzen **dieselbe Angriffs-Datenform** wie der Held (Vorlauf/Aktiv/Erholung, Trefferzone,
Schaden). Kern ist der **Telegraf**: eine lesbare Vorwarnung, dann ein Trefferfenster. Gegner
haben Poise, Sichtweite (zwei Radien: Rückzug wird weiterverfolgt, damit ein Schritt zurück sie
nicht vergessen lässt), Patrouillen und teilweise Verstärkungsrufe. Bosse mit Phasen sind **ein**
Gegner, der ab 50 % Leben schneller und anders angreift (z. B. Telegraf um 40 % kürzer), kein
zweiter Statblock.

**Beispiele (Startwerte, ungetestet):**

| Gegner | HP | Schaden | Poise | Verhalten |
|---|---|---|---|---|
| Rost-Spinner (Lehr-Gegner Level 1) | ca. 40 | ca. 18 | 20 | patrouilliert, verfolgt auf Sicht, kurzer Telegraf, schneller Sprung-Angriff; Gruppe: einer flankiert |
| Rohr-Kriecher / Ratten | 16 / 40 | 8 / 20 | 15 | schwach, aber in Mengen; nicht parierbar |
| Ruß-Kriecher | 35 | 22 | 15 | lauert, springt aus Verstecken, hoher Einzelschaden |
| Teerbinder | 60 | 25 | 40 | zäher Auswurf, **verlangsamt und verklebt die Rolle** |
| Glut-Wild | 30 | 26 | 45 | hinterlässt beim Tod Feuer-/Rost-Effekt |
| NEBELWERK-Wache | 55 | 24 | 40 | Paare, rufen Verstärkung |
| Vorarbeiter | 45 | 20 | 40 | langsam, Gegner in der Nähe werden stärker |
| Schrott-Golem (Zwischenboss L2) | 70 | 28 | 80 | bewacht die Pumpstation |
| **Verwerter-Konstrukt** (Boss L2) | 130 | 42 | 90 | Phase 1: langsame, lesbare Angriffe, Telegraf 0,95 s; Phase 2 (≤ 50 %): Telegraf ×0,6; **Schwäche: Angriffe von oben/hinten** |
| **Kommandantin Riss** (Boss L3) | 60 | 26 | 160 | Failsafe → danach Schlund-Wächter-Welle |
| Schlund-Wächter | 110 | 38 | 200 | erwacht an der Ader |
| Öl-Leviathan (optional L3) | 90 | 34 | 250 | im Tümpel, wer dort gräbt/plündert |
| **Asches Sezier-Golem** (Boss L4) | 130 | 40 | 150 | Capture-Kampf um Korro |
| Asches zweites Exponat (Zwischenboss L5) | 100 | 36 | 180 | Schatten-Griff, Schatten-Ader |
| **Schwarzkittel** (Boss L5) | 150 | 44 | 170 | schienen-/kabelgebundenes Notfall-Konstrukt; „Defensiv-Haltung" bei niedrigem Leben |
| **Doktor Asche** (Boss L6) | 150 | 38 | 220 | vier Phasen (siehe 4.) |
| Riot-Kommandeur | 95 | 34 | 60 | nur bei hohem Heat, Jäger |

Elite-Fassungen (+30 % Leben, +40–50 % Schaden) stehen als Varianten bereit (z. B. *Frost*,
*Zorn*, *Asche*).

---

## 7. Held: drei getrennte Achsen

Drei Systeme, drei Vorbilder, drei verschiedene Wechsel-Rhythmen:

| Achse | Vorbild | Wechselt wann | Inhalt |
|---|---|---|---|
| **1. Figur = Volk × Klasse** | Smash-Roster | einmal beim Run-Start | feste Werte + **Signatur-Fähigkeit** |
| **2. Waffe** | Hades | jederzeit im Run (zwei Waffen-Slots, Durchschalten) | Grundangriff-Kette + bis zu zwei Waffen-Fähigkeiten |
| **3. Bewegungsfähigkeiten** | Hollow Knight | einmal freigeschaltet, für immer, **für jeden** | Wandsprung, Luft-Dash, Doppelsprung, Kantenklettern |

**Wichtig (Entscheidung):** Bewegungsfähigkeiten gehören **keiner Klasse**. Ein Held lernt sie
als Held („das sollte jeder können"). Kein Hauptpfad setzt je eine bestimmte Fähigkeit voraus; sie
öffnen nur **optionale Belohnungsbereiche** (Geheimgang-Muster). Mit Wandsprung, Dash und
Kantengriff sind sie als *Plattform-Elemente* im Spiel gewünscht (der ursprüngliche Plan „kein
Action-Platformer" wurde ausdrücklich aufgehoben).

### 7.1 Völker und Klassen

**Völker** (9, von Anfang an wählbar): siehe 3.6. **Klassen** (10, durch Missionen/Erfolge
freischaltbar, mechanisch **gleichwertig** zu Völkern, keine Premium-Stufe):

| Klasse | HP | Atem | Schaden | Freischaltung | Idee |
|---|---|---|---|---|---|
| Sparkguard | 125 | 90 | 28 | von Anfang an | steht vor anderen; Tank |
| Rootward | 115 | 95 | 30 | 2 Gebiete gesehen | steht, wo andere weichen |
| Junker | 135 | 80 | 32 | 1 Boss besiegt | „nichts ist Schrott"; Signatur: Jam-Bang |
| Klanker | 100 | 120 | 30 | 4 Runs | jedes Gelenk geflickt; Signatur: Furcht-Ton |
| Coremind | 95 | 115 | 30 | 5 Runs | Kern-Verständnis; Signatur: Purge-Burst |
| Lux | 80 | 110 | 34 | 2 Bosse | ein Licht, das nicht verlischt |
| Deepseeker | 85 | 125 | 32 | 4 Gebiete gesehen | steigt hinab; Signatur: Sog-Griff |
| Riftblade | 92 | 105 | 42 | 2 Runs | findet den Riss; Signatur: Runen-Anspruch |
| Duskrunner | 88 | 100 | 44 | 3 Gebiete gesehen | zwischen den Schichten unterwegs |
| Striker | 78 | 95 | 50 | 3 Bosse | ein Schlag, keine Erklärung; Glaskanone |

(Der Startheld ist ein namenloser Überlebender; Klassen sind Heldversionen auf demselben Volk.
Die Klassen-Signaturen von Sparkguard, Rootward, Lux, Duskrunner und Striker sind noch nicht
entworfen.)

### 7.2 Waffen

Vier Stufen der Aufwertung (Basis roh und sichtbar zusammengebaut → +1 Amber-Akzent → +2 Boss-Drop
oder Material mit Glut-Linien/Runen → +3 Endgame). **Keine Waffenhaltbarkeit, kein freies Crafting**
(rezeptbasiert, falls überhaupt).

| Waffe | Klasse | Schaden | Reichweite | Atem | Fähigkeit (Abklingzeit) | Charakter |
|---|---|---|---|---|---|---|
| Rost-Klinge | Klinge | 34 | 52 | 26 | **Rost-Splitter** (Fläche, 7 s) | „Nichts daran ist gut, alles verlässlich." |
| Asche-Schleier | Klinge | 28 | 58 | 21 | **Aschewand** (Schutz: 6 s halber Schaden, 12 s) | „Man merkt den Treffer erst am Nachhall." |
| Verwerter-Hammer | Hammer | 72 | 62 | 48 | **Schlagwelle** (Fläche, 10 s) | „Zwei Schläge leeren den Atem. Der dritte kommt nicht." |
| Lumen-Dolch | Dolch | 21 | 40 | 15 | **Licht-Schnitt** (Stoß, 5 s) | „Zweimal zustechen, bevor der Rost einmal fällt." |
| Lumen-Stab | Stab | 26 | 72 | 24 | **Lichtbahn** (Stoß, durchdringt, 6 s) | „Reichweite statt Wucht." |
| Glut-Zepter | Stab | 52 | 48 | 38 | **Zündpunkt** (Fläche, brennt nach, 9 s) | „Ein Käfig hält eine Glut, die nicht ausgeht." |
| Schlacken-Hand | Handschuh | 36 | 34 | 24 | **Glut-Griff** (Stoß, zieht heran, 8 s) | „Man muss nah heran. Sehr nah." |
| Druckluft-Pistole | Schuss | 24 | 60 | 18 | **Druckstoß** (Rückstoß) | „Nur Luft, hart genug, um jemanden umzuwerfen." |
| Schrott-Flinte | Schuss | 44 | 44 | 32 | **Streuschuss** (Fläche, 7 s) | „Genauigkeit ist nicht der Punkt." |

*Fähigkeitsarten:* **Fläche** (alle im Umkreis), **Stoß** (Linie nach vorn, durchdringt),
**Schutz** (Zeitfenster). Die zweite Waffen-Fähigkeit schaltet erst ab Aufwertungsstufe 2 frei:
Aufwerten gibt also eine **neue Möglichkeit**, nicht nur mehr Schaden. Weitere Waffen im Konzept:
Glut-Werfer (langsame Flächenexplosion), Lumen-Bogen (durch Wände).

### 7.3 Inventar

Zwei Waffen-Slots plus ein Verbrauchsgut-Schnellslot plus ein Vorrat („Truhe": Waffen und
Gegenstände). Slot-Tausch gegen die Truhe ist **nur im Licht eines Rastpunkts** erlaubt (sonst nur
ansehen). Ein Vergleichsbereich zeigt Schaden, Gesamtdauer, Atem-Kosten, Klasse, Fähigkeit.
Ein Charakterbogen zeigt Volk, Klasse, Werte und die Move-Liste der geführten Waffe.
Bewusst nicht geplant: Rüstungssystem, Talismane, Gewichts-System.

---

## 8. Fortschritt und Wiederspielwert

**Innerhalb des Runs:** Atem/HP/Heil-Stärke durch Glut am Kollektor; bessere Waffen durch Gegner und Geheimnisse; Kontrolle durch Hebel.

**Zwischen den Runs (Meta):**

| Was | Bleibt? |
|---|---|
| besiegte Bosse (Rohrtor dauerhaft offen, Boss-Glut) | **ja** |
| entdeckte Shortcuts und Geheimnisse | **ja** |
| freigeschaltete Klassen/Bewegungsfähigkeiten | **ja** |
| besiegte Gegner | **nein**, sie respawnen („die Welt lebt weiter") |
| Heat | **nein**, jeder Run startet bei 0 |

**Design-Philosophie:** Der Spieler wird durch **Investition und Wissen** stärker, nicht durch
permanente Macht. Die Welt bleibt gefährlich, aber der Spieler wird klüger.

**Glut-Grade** (Hebel für die Stunden 10 bis 50): Nach dem ersten Sieg über Doktor Asche wird
**Grad 1** frei, bis Grad 4. Jeder Grad ändert **Regeln, nicht nur Zahlen**:
Grad 1: Gegner +25 % Leben, Elite-Chance 18 → 30 %, Belohnung: neue Waffe im Pool ·
Grad 2: Kollektor heilt nur noch zur Hälfte, Belohnung: neue Klasse ·
Grad 3: Zonenschaden in **jedem** Gebiet, Belohnung: zweite Fähigkeit ab Stufe 1 ·
Grad 4: nur ein Rastplatz im ganzen Run, Belohnung: Endgame-Waffenstufe.

**Weitere Wiederspiel-Hebel:** Run-Modifikatoren (zu Run-Beginn eine von drei Karten wählen),
Tages-Saat (ein fester Run pro Tag für alle), Fundstücke mit Text, mindestens ein optionaler Pfad
je Level, versteckte Kollektoren, Patrouillen-Routen lernen, No-Hit-Runs gegen Bosse, Speedrun.

---

## 9. Level-Design-Prinzipien

**Lektion + Gefahr je Gebiet.** Jedes Gebiet bringt dem Spieler eine Sache bei und droht mit
genau einer Sache. Zwei Gebiete mit derselben Lektion und Gefahr sind eines zu viel.

| Gebiet | Lektion | Eigene Gefahr |
|---|---|---|
| Rostgürtel | Nahkampf: Telegraf lesen, ausweichen, zuschlagen | keine, hier lernt man |
| Grenzland (Flüsterwald, Lichtquell) | Erkundung lohnt sich | kein Kollektor |
| Rauchschanze/Ader | senkrecht denken, Wachen umgehen | Alarm: jeder Kampf ruft Verstärkung |
| Ascheburg | alles zusammen | **Heat** |
| Ascheburg-Kern | Ordnung als Gegner | Zonenschaden überall |
| Unter der Ordnung | was die Stadt verbirgt | Dunkelheit: Sicht nur um Lichtquellen |

**Neun Interaktions-Elemente** (pro Raum **höchstens zwei Sorten**: „ein Raum, der alles kann,
kann nichts besonders"):

| Element | Wirkung |
|---|---|
| Kletterrohr | senkrechte Bewegung, Schlüssel zur Vertikalität |
| Einbahn-Abstieg | von oben durchfallen, von unten fest; ermöglicht Schleifen |
| Wellblech-Wand | nur mit genug Waffenschaden (z. B. ≥ 50) zerstörbar; belohnt schwere Waffen; Zugang zur Kammer |
| Hebel + Tor | die Abkürzung |
| Rohr-Aufzug | verbindet Etagen |
| Dampfventil | Umgebungsschaden im Takt: Timing-Hindernis statt Gegner |
| Seil | Schwingen über Lücken |
| Kisten-Stapel | klettern + zerstörbar |
| Glut-Ampulle | aufheben, füllt Heil-Ladungen |

**Tote Zonen** sind kein Erkundungsraum, sondern ein **kurzer Wellen-Kessel** (Verteidigungswellen).
**Kamera:** Raum-Kamera mit eigenem Profil je Raumform (Schacht höher als breit: etwas weiter weg
und höher; Halle: mehr Vorlauf; Kammer: näher; Bossarena: Boss-Zoom). Vertikalität ist die
billigste Verdopplung eines Levels: ein Raum, der nach oben heller wird, ist ein Level-Entwurf
(„Je höher man steigt, desto dünner wird der Ruß").

**Darstellung (nur Prinzip, keine Assets):** Figuren als **Cutout-Rigs**: *ein* Bild wird an den
Gelenken zerschnitten, Bewegung entsteht aus Drehung, nicht aus gezeichneten Einzelframes. Kein
gemalter Schatten, kein gemaltes Glühen im Sprite (die Engine legt Licht als Overlay darüber).
Lesbarkeit zuerst: Silhouette, Kontrast Rand/Boden, dunkles Inneres.

---

## 10. Erzählung im Spiel (Text in der Welt)

Erzählt wird in **kurzen Texten**: Meldungen mittig (z. B. *„Das Rohrtor ist entriegelt. Der Weg
nach Rosttal ist kurz."*), **Areal-Untertitel** beim Betreten, kontextabhängige **Todestexte**,
**Kollektor-Texte**, die sich mit dem Fortschritt ändern, **Item-Texte** als Hinweis-Tutorial
(Tunic-Prinzip). Beispiele:

| Ort | Untertitel |
|---|---|
| Rosttal | „Wer Lumen hat, kriegt Licht." |
| Rohrviertel | „Alles hier führt irgendwohin zurück." |
| Unterrohre | „Unter dem Viertel läuft, was oben abgestellt wurde." |
| Ascheburg | „Die Stadt hat zehn Gesichter, und keins wartet auf dich." |

| Tod durch | Text |
|---|---|
| Sturz | „In die Tiefe gestürzt. Die Glut bleibt liegen." |
| Gegner | „Von einem Rost-Spinner erschlagen." |
| Boss | „Das Verwerter-Konstrukt hat dich zerbrochen." |
| in Ascheburg | „In Ascheburg stirbt man zweimal." |

Kollektor-Text beim ersten Besuch: *„Geheilt, Ampullen gefüllt, Gegner sind zurückgekehrt."*; später:
*„Die Glut-Zelle ist sicher. Der Weg ist frei."*

---

## 11. Gegenwärtige Spielregeln für Zonen und Atem (Werte-Übersicht)

- Atem (Ausdauer) kostet Schlag, Rolle (i-Frames), Block-Treffer und Fähigkeiten.
- Atem-Regeneration: voll ohne Smog in ca. 3 s, mit Smog ca. 6 s (Prototyp-Startwert).
- Smog-Areale halbieren die Atem-Regeneration; Infektion (optional) zählt nur außerhalb des Kollektorlichts.
- Prototyp-Kosten: Schlag ≈ 26 Atem, Rolle ≈ 22 Atem (inzwischen waffenabhängig, siehe 7.2).

---

## 12. Nicht-Ziele (bewusst nicht gebaut)

- Multiplayer / Co-op, Online-Bestenlisten
- Mobile / Touch-Steuerung
- Story-First mit langen Cutscenes (> 5–10 s)
- Skill-Bäume pro Waffe, freies Crafting, Tag-/Nacht-Zyklus, Wetter
- Rüstung, Talismane, Gewichts-System
- Fragmentarische Erzählweise (Souls-typisch) wurde bewusst *nicht* gewählt: Erzähltext darf hier direkt sein
- Elementar-Varianten von Gegnern (Eis, Schatten) ohne Kanon-Wurzel: Ersatz sind Ruß-Kriecher und Teerbinder aus dem Setting

---

## 13. Offene Punkte und Unsicherheiten (ehrlich)

1. **Zahlen sind ungetestet.** Alle HP-, Schaden-, Atem- und Poise-Werte sind Prototyp-Annahmen.
   Ob sich der Kampf gut anfühlt, lässt sich nur spielend entscheiden.
2. **Genre-Etikett:** Die Quellen sagen „Soulslike" *und* „Roguelike". Konsens: **Soulslike-Kampf
   mit Run-Struktur und Meta-Fortschritt**, aber ohne Permadeath. Den Grad, wie stark Räume pro Run
   gewürfelt werden, kann der Umsetzer festlegen; die handgebaute Kampagne ist der Standard.
3. **Atem-Details** (genaue Regeneration/Kosten) und **Schwierigkeitsgrad** sind nicht festgelegt.
4. **Level 3 und 4 gelten als weniger ausgearbeitet** als Level 1–2; die Ascheburg-Bezirke sind das
   größte Inhaltsfeld und waren ausdrücklich „Zielbild, nicht erster Bauschritt".
5. **Fünf Klassen-Signaturen** (Sparkguard, Rootward, Lux, Duskrunner, Striker) fehlen.
6. **Gegner-Angriffsmuster** sind nur für die Gegner der Level 1–2 ausgearbeitet; Level 3–6 sind
   offen.
7. **Heat-Schwellen** (4/7/9) und **Glut-Grade** sind Entwürfe, noch nicht im Spiel gemessen.
8. **Pen&Paper-Brüche:** Der Held ist im Spiel namenlos; die Gruppe gibt es nicht. Doktor Asche wird
   hier bekämpft (im Original nicht). Wo das Original „die Gruppe" sagt, ist im Spiel *eine*
   Figur gemeint.
9. **Lizenz/Rechte:** Alles Welt-Material ist **eigene Entwicklung** (Kampagnentexte, Namen,
   Figuren). Die Referenzspiele werden nur im Prinzip genutzt („im Stil von", nicht „1:1 wie").

---

## 14. Vorschlag für den Einstieg der Umsetzung

1. **Zuerst nur das Kampfgefühl** in einem einzigen Raum prüfen: Held (Lauf, Sprung, Rolle),
   *eine* Klasse (Klinge) mit Kette + Block + Parry, *ein* Gegner mit Telegraf und Poise,
   Hitstop. Erst wenn das trägt, weiter.
2. **Dann Tod und Rastpunkt**: Glut-Zelle am Todesort (genau ein Bergungsversuch), Kollektor mit
   Heilung und Gegner-Respawn.
3. **Dann Level 1 (Rosttal)** komplett spielbar, danach Level 2 mit dem ersten Boss und der
   Hebel-Schleife.
4. **Danach** Hammer-Klasse als Gegenbeweis, dass sich Klassen blind unterscheiden lassen.
5. Erst dann Inventar/Charakterbogen, Heat und Meta-Fortschritt.

**Abnahmekriterien** (Maßstab für „gut genug"): (a) Level 1 mit *einer* Waffe komplett
durchspielbar und es fühlt sich gut an; (b) zwei Waffenklassen fühlen sich *klar verschieden*
an; (c) ein Gegner staggert sichtbar und ein Parry gelingt *reproduzierbar*; (d) durchgängig mit
Controller spielbar.

**Technische Randbedingungen aus dem Prototyp:** Kern strikt welt-neutral halten (jede
Welt-Aussage nur in Daten); Räume als Raster-/Rechteck-Geometrie (Boden/Plattformen) mit
daraus abgeleiteter Darstellung; Waffen, Angriffe, Gegner und Level als **Daten**, nicht als
Code; ein automatisierter Test, der die Konsistenz der Daten prüft (z. B. jede Angriffs-Kette
ohne Zyklus, Parry-Fenster < 0,35 s, Hammer langsamer als Klinge).
