# Privacy Policy — Chi Transit

**Last updated:** May 26, 2026

Chi Transit ("the App") is a free, open-source Chicago transit tracker.

## Data We Collect

**None.** The App does not collect, store, or transmit any personal data. Specifically:

- **No account or login** — the App has no user accounts.
- **No location tracking** — the App never requests access to your device's location. It displays public transit vehicle positions provided by the Chicago Transit Authority (CTA), not your position.
- **No analytics or advertising** — the App contains no analytics SDKs, ad networks, or tracking pixels.
- **No cookies or fingerprinting** — the App does not use cookies, device fingerprints, or any other persistent identifiers beyond a locally stored route-selection preference (see below).

## Local Storage

The App saves your selected bus/train route preferences in on-device storage (`UserDefaults`) so they persist between sessions. This data never leaves your device.

## Network Requests

The App makes the following network requests, all to first-party or public endpoints:

| Destination | Purpose |
|---|---|
| `cta-transit-tracker.pages.dev` | Fetch real-time CTA bus and train positions, route metadata, and route shapes |
| `api.open-meteo.com` | Fetch current Chicago weather (temperature and conditions) |

No personal data is included in these requests. Standard HTTP headers (IP address, user agent) are transmitted as part of normal internet communication but are not logged or retained by us.

## Third-Party Services

- **CTA Bus Tracker & Train Tracker APIs** — public transit data provided by the Chicago Transit Authority under their developer terms. No user data is shared with CTA.
- **Open-Meteo** — free weather API. No API key or user data is transmitted.
- **Apple MapKit** — map tiles are loaded by Apple's MapKit framework. Apple's own privacy policy governs map tile requests.

## Children's Privacy

The App does not knowingly collect any information from anyone, including children under 13.

## Changes

If this policy changes, the updated version will be posted at this URL. Since we collect no data, material changes are unlikely.

## Contact

Questions? Open an issue at [github.com/Mzhang008/cta-transit-tracker](https://github.com/Mzhang008/cta-transit-tracker) or email mzhang008@gmail.com.
