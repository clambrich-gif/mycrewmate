# PWA Installation & App-Shortcuts Dokumentation

## Status der Umsetzung
1. PWA-Manifest (`client/public/manifest.json`):
   - `name`: "RSC Helferplanung"
   - `short_name`: "Helferplanung"
   - `display`: "standalone"
   - `theme_color`: "#1e3a5f"
   - `background_color`: "#f8fafc"
   - `icons`:
     - `/icons/rsc-helferplanung-192.png` (192x192)
     - `/icons/rsc-helferplanung-512.png` (512x512)
     - `/icons/rsc-helferplanung-maskable-512.png` (512x512, maskable)
   - `shortcuts`:
     - Einsatzplan: `/einsatzplan` (Icon: `/icons/shortcut-einsatzplan-192.png`)
     - Helferkartei: `/helfer` (Icon: `/icons/shortcut-helferkartei-192.png`)
     - Orga-Chat: `/dashboard?chat=open` (Icon: `/icons/shortcut-orga-chat-192.png`)

2. App Routing (`client/src/App.tsx` & `client/src/components/Layout.tsx`):
   - Route `/dashboard` aliasiert auf das Dashboard.
   - Wenn `/dashboard?chat=open` aufgerufen wird, öffnet sich der Orga-Chat automatisch.

3. Mobile Navigation & Installationsdialog (`client/src/components/Layout.tsx`):
   - Fester Button `📱 Als App auf Handy speichern` in der mobilen Seitenleiste.
   - Dialog mit Tabs für:
     - `iOS (iPhone/iPad)`:
       1. Teilen-Symbol in Safari (Quadrat mit Pfeil nach oben).
       2. „Zum Home-Bildschirm“.
     - `Android`:
       1. 3 Punkte in Chrome.
       2. „App installieren“ oder „Zum Startbildschirm hinzufügen“.
   - Unterstützt der Browser das native `beforeinstallprompt`-Ereignis, wird die native Installation ausgelöst.

4. Service Worker (`client/public/service-worker.js`):
   - Version `rsc-helferplanung-pwa-v2`.
   - Cacht ausschließlich Manifest und PWA-Icon-Dateien.
   - Planungs- und Anmeldedaten bleiben immer netzwerkbasiert geschützt.
