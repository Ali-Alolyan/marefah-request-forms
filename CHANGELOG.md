# Changelog

## v10
- Improved header date rendering: compact numeric format and better styling for dual dates.
- Shifted header dates ~5px to the left to avoid overlapping template text.
- Added GitHub-ready project files: .gitignore, LICENSE, CHANGELOG.

## v11
- Improved mobile PDF export reliability and layout consistency:
  - Fixed export document viewport to A4-like width (794px) to prevent mobile auto-scaling.
  - Mobile-safe shrink on print to avoid footer spilling into a second page.
  - Wait for fonts and image decode before calling print.
  - Disabled iOS text auto-sizing in the export document.

## v9
- English numeric dates, portfolio abbreviations, improved exports.
