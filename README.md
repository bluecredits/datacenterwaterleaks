# Data Center Water Leaks

Public transparency platform for data center water use — https://www.datacenterwaterleaks.com
Hosted on GitHub Pages from this repository (custom domain in `CNAME`).

## Layout
| Path | What it is |
|---|---|
| `index.html` | Landing page (must stay at the root for GitHub Pages) |
| `404.html` | "Page not found" page; also forwards old links (e.g. /map.html) to their new folders |
| `pages/` | `map.html` (Water Map), `usage.html`, `offsets.html`, `law.html`, `terms.html` |
| `js/` | `account.js` (sign-in + Pro Supporter), `newsletter.js` (newsletter pop-up) |
| `data/` | Data files the pages load, plus `usdatacentermap.kmz` (map download) |
| `docs/` | Public documents: report PDFs, FOIA opinion, FOIA template, model bills |
| `logo.png`, `CNAME`, `LICENSE` | Logo, custom domain, license |

## Updating data
Replace the file in `data/` with the same name and column headers, then commit. Pages pick it up on the next load.
