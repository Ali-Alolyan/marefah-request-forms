# Codex App Understanding Note

Date captured: 2026-02-06
Workspace: /Users/alialolyan/Downloads/websites/letter-tool

## 1) What this app is

Static single-page Arabic letter generator for Marefah Association.

- Stack: plain `index.html` + `css/*.css` + `js/*.js` (no build tool, no npm).
- Output: A4 letter preview + downloadable PDF.
- Letter types:
  - `general` (custom letter)
  - `custody` (financial custody request)
  - `close_custody` (financial custody closing request)
- Auth gate: login overlay with 9-digit account code via Supabase RPC.

## 2) Entry point and script order

Entry file: `index.html`

Runtime script load order (global `window` APIs, non-module pattern):

1. Supabase CDN UMD
2. `js/auth.js`
3. `js/hijri-converter.js`
4. `js/utils.js`
5. `js/date-picker.js`
6. `js/signature-enhanced.js`
7. `js/theme.js`
8. `js/templates.js`
9. `js/pagination.js`
10. `js/canvas-renderer.js`
11. `js/pdf-loader.js`
12. `js/print.js`
13. `js/mobile-preview.js`
14. `js/app.js` (main initialization on `DOMContentLoaded`)

## 3) Main runtime flow

Main controller: `js/app.js`

- `init()` binds date picker, form/watchers, mobile tabs, attachments UI.
- Reads `window.authSession` and applies it (name/title + project list).
- Builds project dropdown from session projects.
- Sets defaults (today date, letter type, UI mode).
- Calls `refresh()`.

`refresh()` pipeline:

1. Sync UI mode (`applyLetterTypeUI`, `applySignatureModeUI`).
2. Build current state via `collectState()`.
3. Schedule mobile canvas preview (`window.mobilePreview.schedule(state)`).
4. If phone (`max-width: 640px`) and mobile preview enabled: stop there.
5. Else:
   - `renderLetterBlocks(state)` from `templates.js`
   - `buildPages(state, blocks)` from `pagination.js`
   - render pages into `#printRoot`
   - apply scaling with `--page-scale`

## 4) Authentication and identity behavior

Auth module: `js/auth.js`

- Supabase project: `https://rlftalctuaybztrgegnb.supabase.co`
- RPC used: `lookup_employee(p_account_code)`
- Session key: `marefah-auth-session-v2`
- Session TTL: 24 hours (`_savedAt` timestamp)
- Overlay blocks app until login success.
- On login success:
  - fills `applicantName` (readonly)
  - fills `jobTitle`; if secondary title exists, replaces input with a select
  - loads user projects and rebuilds project dropdown
- On logout:
  - clears session and identity fields
  - restores `jobTitle` to input if it had been converted to select
  - clears project options

## 5) Project / cost center model

No hardcoded PF/PRG arrays in current code.

- Projects come from auth session (`session.projects`).
- Each project option carries:
  - `project_id`
  - `project_name`
  - `program_name`
  - `cost_center`
  - `portfolio_name`
- For `general` type, cost center section is hidden and not used.
- If user has no projects, `custody` and `close_custody` options are disabled.

## 6) State shape (effective)

Produced by `collectState()` in `js/app.js`:

- Core: `type`, `subject`, `details`, `applicantName`, `jobTitle`
- Amounts: `custodyAmount`, `usedAmount`, `remainingAmount`
- Attachments:
  - `attachments` (numeric page total)
  - `attachmentsText` (string for header overlay)
  - `attachmentFiles` (array of in-memory file metadata)
- Agreement: `agreedToTerms`
- Signature: `signatureDataUrl`
- Project metadata: `projectName`, `costCenter`, `programNameAr`, `pfName`
- Dates: `dateISO`, `dateHijri`, `dateGregorian`

## 7) Date system

Files: `js/hijri-converter.js`, `js/date-picker.js`, `js/utils.js`

- Hidden ISO input: `#date`
- Visible display input: `#dateDisplay`
- Dual calendar picker supports Gregorian + Hijri views.
- Date formatting used in letter header: numeric Hijri + numeric Gregorian.
- Important timezone discipline:
  - parse ISO using local noon (`new Date(y, m-1, d, 12, 0, 0, 0)`)
  - avoid `new Date("YYYY-MM-DD")` UTC-shift issues

## 8) Signature system

File: `js/signature-enhanced.js`

- Canvas drawing with undo/redo history (max 50 states).
- Adjustable pen size + color.
- Emits `signatureChanged` event consumed by `app.js`.
- Alternate mode: upload image signature (`#signatureFile`), max 5 MB.

## 9) Attachment system

Primary logic: `js/app.js`

- In-memory only; not saved to localStorage.
- Supported types: PNG, JPEG, WebP, PDF.
- Max file size: 10 MB per file.
- Duplicate check: same `name` + `size`.
- PDF page count obtained through `pdf.js` loaded on demand (`js/pdf-loader.js`).
- UI shows thumbnail preview + remove action.
- Attachment count in letter header is total pages:
  - images count as 1
  - PDFs count as number of pages

## 10) Rendering systems (two paths)

### A) DOM preview for desktop/tablet

- `templates.js`: builds semantic content blocks.
- `pagination.js`: paginates to A4 shells and splits long splittable text by binary search.
- Background image in page shell:
  - `assets/letterhead.png`
  - `srcset` includes `assets/letterhead-300.jpg`

### B) Canvas rendering for mobile preview and PDF

File: `js/canvas-renderer.js`

- Generates deterministic A4 canvases with:
  - background letterhead
  - exact header overlay coordinates
  - rendered content with RTL wrapping
  - signature placement
  - page number text
- Uses mm-based geometry:
  - page 210x297 mm
  - margins top 44, right 5, bottom 21, left 11

## 11) Mobile preview viewer

File: `js/mobile-preview.js`

- Active on phones (`max-width: 640px`).
- Renders pages at 150 DPI to JPEG blob URLs.
- One-page viewer with:
  - next/prev navigation
  - pinch zoom + pan
  - swipe page change at near-fit zoom

## 12) PDF export

File: `js/print.js`

- Export button calls `window.exportPDF()`.
- Waits for font readiness.
- Canvas generation attempts:
  - iOS: 300 DPI then fallback 240 DPI
  - non-iOS: 300 DPI
- If attachments exist:
  - image attachments converted to A4-fitted pages
  - PDF attachments rendered page-by-page via `pdf.js`
- Builds PDF with custom minimal writer (JPEG XObjects), then downloads blob.

## 13) Storage keys and persistence

- Draft: `marefah-letter-draft-v4`
  - stores form state without signature and without file objects
- Auth session: `marefah-auth-session-v2`
  - expires after 24 hours
- Theme: `arabic-letter-theme` (`light` / `dark`)

## 14) Styling and layout contracts

Primary stylesheet: `css/app.css`

- Desktop layout: form + preview grid.
- Mobile behavior:
  - form/preview tabs
  - fixed bottom tab bar on phone widths
  - `#printRoot` hidden on phone; canvas viewer used instead
- A4 overlay position CSS variables:
  - `--ov-hijri-top/left`
  - `--ov-greg-top/left`
  - `--ov-att-top/left`
  - `--ov-date-shift-x`
- Print CSS hides all UI except `#printRoot`.
- Login overlay applies blur/disabled interaction to app background.

## 15) Security and deployment

- CSP in `index.html`:
  - `script-src 'self' https://cdn.jsdelivr.net`
  - `connect-src 'self' https://rlftalctuaybztrgegnb.supabase.co`
  - `img-src 'self' data: blob:`
  - `font-src 'self'`
  - `worker-src 'self' blob:`
- GitHub Pages deploy workflow: `.github/workflows/static.yml`
  - copies `index.html`, `css`, `js`, `assets`, icons into `_site`

## 16) Non-runtime files observed

These are present but not referenced in frontend runtime:

- `users.xlsx`
- `files/all_names_copy.xlsx`
- `files/link_names_with_projects.xlsx`
- `files/info.docx`

Likely operational/reference data for team workflows, not browser code.

## 17) Practical risks and watch-outs

- This app is highly coupled via global `window` APIs and script order.
- `auth.js` mutates DOM shape (`jobTitle` input may become `select`); listeners must tolerate that.
- Rendering constants exist in both DOM pagination and canvas renderer; keep them synchronized.
- Attachment PDF rendering depends on dynamic `pdf.js` loading from CDN and CSP compatibility.

