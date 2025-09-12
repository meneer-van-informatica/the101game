pwa = ‘progressive web app’. het is een website die zich gedraagt als een app: start schermvullend, werkt (deels) offline, kan geïnstalleerd worden en blijft snel dankzij slimme caching.

kort hoe het werkt

* service worker: een kleine achtergrond-helper die netwerkverkeer onderschept, offline-cache regelt en updates pusht.
* manifest: een json met naam, iconen, thema en start-url zodat je ‘toevoegen aan beginscherm’ krijgt.
* https verplicht: voor veiligheid en toegang tot pwa-features.
* app-shell: minimalistische html/js/css die snel laadt en content daarna bijwerkt.

waarom jij het wilt

* mobile = default: fullscreen, safe-areas netjes, voelt als native.
* snel en veerkrachtig: laad direct uit cache, update stilletjes op de achtergrond.
* installable: icoon op je home-screen zonder app store.
* offline/poor-network: basis blijft bruikbaar, later synchroniseren.

grenzen om te kennen

* ios is strenger: sommige api’s zijn beperkt en audio moet eerst ‘ontgrendeld’ worden door een tik (hebben we ingebouwd).
* opslag is beperkt en door de browser beheerd.
* push/notifications vragen expliciete toestemming en zijn op ios soberder.

voor the101game

* we hebben manifest + service worker + auto-refresh + versie-busting gezet.
* taps geven ‘tik’ via webaudio (na eerste tik ontgrendeld).
* stippy (rode dot) en 10-taps → `/w0l0.html` werken nu ook mobiel.

clippy-modus (pwa)

* betekenis: progressive web app.
* simpel nl: website die als app werkt.
* voorbeeldzin: ‘we maken the101game een pwa zodat het ook offline opent.’
* uitspraak: pie-djoe-ee (engels: ‘pi-double-u-ei’).
* context: webontwikkeling, mobile-first.
* false friend: geen echte app store-app, maar lijkt er wel op.
* ezelsbrug: ‘p’ van ‘progressive’: het wordt steeds beter na eerst laden.

keuzemenu
\[a] zo laten, pwa is klaar
\[b] ‘install app’ knop tonen als de browser installatie toelaat
\[c] offline fallback-pagina + ‘je bent offline’ toast
\[d] unit-check die sw-versie en js-versie vergelijkt en een groen label toont

```bash
git add -A
git commit -m 'docs: uitleg pwa + next steps voor the101game'
git push
```
