# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arabic letter generator for Marefah Association (جمعية معرفة). Static web app (vanilla HTML/CSS/JS, no framework, no build step) that produces formal A4 letters with Hijri/Gregorian dates, digital signatures, and PDF export. Supports three letter types: general, custody request, and close-custody request.

## Development

```bash
# Serve locally (must run from project root where index.html lives)
python3 -m http.server 8080
# Open http://localhost:8080/
```

No build tools, no npm, no TypeScript. Edit files directly and reload the browser. There are no tests or linting configured. Deployed via GitHub Pages (push to `main` triggers `.github/workflows/static.yml`).

## Architecture

**Entry point:** `index.html` — single-page app with a dual-pane layout (form + live A4 preview). Login overlay blocks the app until the user authenticates with a 9-digit account code.

**Script load order matters** (no ES modules; scripts attach to `window`):
1. Supabase CDN (`@supabase/supabase-js@2`) → `auth.js` (self-initializes on DOMContentLoaded)
2. `hijri-converter.js` → `utils.js` → `date-picker.js` → `signature-enhanced.js` → `theme.js`
3. `templates.js` → `pagination.js` → `canvas-renderer.js` → `print.js` → `mobile-preview.js`
4. `app.js` (initializes everything on `DOMContentLoaded`)

**Core data flow:**
- Form input events → `refresh()` in `app.js`
- `collectState()` gathers all form data into a single state object
- `renderLetterBlocks(state)` in `templates.js` produces content blocks
- `buildPages(state, blocks)` in `pagination.js` splits across A4 pages
- Desktop: DOM preview in `#printRoot` | Mobile (<640 px): canvas preview via `mobile-preview.js`
- PDF export: `canvas-renderer.js` renders pages to canvas at 300/240 DPI → JPEG → download

**Key modules:**
- `app.js` — main controller, state management, cost center data (hardcoded `PF_OPTIONS`/`PRG_OPTIONS` arrays), draft save/load via localStorage (key: `marefah-letter-draft-v4`)
- `auth.js` — Supabase authentication via `lookup_employee` RPC; stores session in localStorage (key: `marefah-auth-session-v1`); pre-fills applicantName/jobTitle as read-only on login
- `templates.js` — letter content generation per type, signature block rendering
- `pagination.js` — dynamic A4 page splitting with header/footer overlays
- `canvas-renderer.js` — custom canvas-based PDF renderer handling Arabic RTL text wrapping
- `hijri-converter.js` — Gregorian ↔ Hijri date conversion (Julian day algorithm)
- `date-picker.js` — dual calendar picker (Gregorian + Hijri sync)
- `signature-enhanced.js` — canvas drawing with undo/redo stack
- `print.js` — PDF export with iOS memory-aware DPI fallback (300→240)
- `utils.js` — shared date helpers (`toLocalISODate`, `parseISOToLocalDate`), number formatting, HTML escaping
- `theme.js` — light/dark mode with Material Design 3 color tokens
- `mobile-preview.js` — 150 DPI JPEG preview with pinch-to-zoom and swipe pagination

**Cross-module communication:** modules expose globals on `window` (e.g., `window.collectState()`, `window.exportPDF()`, `window.hijriConverter`, `window.signatureManager`, `window.authSession`, `window.refresh()`).

## Key Technical Considerations

- **Timezone handling:** Always use local ISO dates (`YYYY-MM-DD`) with noon local time (`new Date(y, mo-1, d, 12, 0, 0, 0)`) to prevent UTC off-by-one bugs. Never rely on `new Date(string)` parsing.
- **RTL text in canvas:** `canvas-renderer.js` has custom Arabic text wrapping logic — standard canvas `fillText` doesn't handle RTL correctly. LTR snippets (cost center codes, numbers) use Unicode bidi isolation markers (LRE/PDF).
- **iOS memory limits:** PDF export attempts 300 DPI first, falls back to 240 DPI on OOM. Mobile preview uses 150 DPI JPEG. iOS detection checks both UA string and `maxTouchPoints > 1` for iPadOS.
- **Fonts must load first:** Letter rendering depends on IBM Plex Sans Arabic (bundled in `assets/fonts/`). Fonts are preloaded in `index.html`. PDF export waits for `document.fonts.ready` before rendering.
- **Vendor directory:** `js/vendor/` contains only a README placeholder — PDF generation uses the custom canvas renderer, not external libraries.
- **Authentication:** `auth.js` loads the Supabase JS client from CDN and calls `lookup_employee(p_account_code)` RPC. The login overlay blocks the form until authenticated. Session persists in localStorage; logout clears fields and re-shows the overlay.

## CSS Customization

Header field positions are controlled by CSS variables in `css/app.css` (in mm units):
- `--ov-hijri-top/left`, `--ov-greg-top/left`, `--ov-att-top/left`
- `--ov-date-shift-x` for horizontal date offset (default: `-5px`)

Theming uses `--md-sys-color-*` custom properties. Mobile breakpoint: `max-width: 640px`.

## Letterhead Assets

- `assets/letterhead.png` — preview (light)
- `assets/letterhead-300.jpg` — PDF export at 300 DPI (A4 = 2482×3510 px)
- `assets/letterhead-240.jpg` — mobile/fallback
- `assets/letterhead-150.jpg` — low-DPI preview
