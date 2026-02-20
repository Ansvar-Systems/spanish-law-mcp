# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-XX-XX
### Added
- Initial release of Spanish Law MCP
- `search_legislation` tool for full-text search across all Spanish legislation (Spanish)
- `get_provision` tool for retrieving specific articles
- `get_provision_eu_basis` tool for EU cross-references (LOPDGDD to GDPR/RGPD)
- `list_laws` tool for browsing available legislation
- `get_law_structure` tool for law table of contents
- `search_reales_decretos` tool for reales decretos and regulatory instruments (Professional tier)
- `get_aepd_guidance` tool for AEPD decisions and guidance (Professional tier)
- Contract tests with 12 golden test cases
- Drift detection with 6 stable provision anchors
- Health and version endpoints
- Vercel deployment (dual tier bundled free)
- npm package with stdio transport
- MCP Registry publishing
- Spanish language full-text search support
- BOE XML open data integration

[Unreleased]: https://github.com/Ansvar-Systems/spanish-law-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Ansvar-Systems/spanish-law-mcp/releases/tag/v1.0.0
