# Spanish Law MCP Server

**The BOE (Boletín Oficial del Estado) alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fspanish-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/spanish-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/spanish-law-mcp?style=social)](https://github.com/Ansvar-Systems/spanish-law-mcp)
[![CI](https://github.com/Ansvar-Systems/spanish-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/spanish-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/spanish-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/spanish-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-297%2C760-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **12,181 Spanish statutes** -- from la LOPDGDD y el RGPD, el Código Penal, and el Estatuto de los Trabajadores to el Código Civil, la Ley de Sociedades de Capital, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Spanish legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Spanish legal research means navigating the Boletín Oficial del Estado, regional BOCAs, and EUR-Lex, then manually reconciling between national and EU law. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking LOPDGDD obligations or ENS requirements
- A **legal tech developer** building tools on Spanish law
- A **researcher** tracing legislative provisions across 12,181 national statutes

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Spanish law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-es/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add spanish-law --transport http https://mcp.ansvar.eu/law-es/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "spanish-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-es/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "spanish-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-es/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/spanish-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "spanish-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/spanish-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "spanish-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/spanish-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"¿Qué dice el artículo 6 de la LOPDGDD sobre el tratamiento de datos personales?"*
- *"Búsqueda 'protección de datos' en el derecho español (LOPDGDD, RGPD)"*
- *"¿Qué artículos del Código Penal regulan los delitos informáticos?"*
- *"Encuentra disposiciones sobre despido improcedente en el Estatuto de los Trabajadores"*
- *"What EU directives does the LOPDGDD implement?"*
- *"Which Spanish laws implement the NIS2 Directive?"*
- *"Valida la cita 'Art. 197 CP' (Código Penal)"*
- *"Busca 'responsabilidad civil' en el Código Civil español"*
- *"Compare incident notification requirements under NIS2 and the Spanish transposition"*
- *"¿Está en vigor el Real Decreto-ley 14/2019 sobre medidas urgentes de administración digital?"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 12,181 statutes | Comprehensive Spanish legislation from BOE |
| **Provisions** | 297,760 articles | Full-text searchable with FTS5 |
| **Preparatory Works** | 12,193 documents | Premium tier -- exposiciones de motivos, proyectos de ley |
| **Case Law** | 0 (free tier) | Reserved for future ingestion |
| **Agency Guidance** | 0 (free tier) | Reserved for future ingestion |
| **Database Size** | ~849 MB | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against BOE |

**Verified data only** -- every citation is validated against official sources (BOE, boe.es). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from the BOE Datos Abiertos API (boe.es/datosabiertos)
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by statute identifier + article number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
BOE Datos Abiertos API --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                            ^                        ^
                     Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search BOE by statute name | Search by plain Spanish: *"protección datos personales"* |
| Navigate multi-title statutes manually | Get the exact article with context |
| Manual cross-referencing between codes | `build_legal_stance` aggregates across sources |
| "¿Está este artículo vigente?" -> check manually | `check_currency` tool -> answer in seconds |
| Find EU basis -> dig through EUR-Lex | `get_eu_basis` -> linked EU directives instantly |
| Check BOE, EUR-Lex, AEPD separately | Daily automated freshness checks |
| No API, no integration | MCP protocol -> AI-native |

**Traditional:** Search BOE -> Download PDF -> Ctrl+F -> Cross-reference with RGPD -> Check EUR-Lex -> Repeat

**This MCP:** *"¿Qué normativa europea da base al artículo 22 de la LOPDGDD sobre decisiones automatizadas?"* -> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 297,760 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by statute identifier + article number |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from statutes, preparatory works, and case law |
| `format_citation` | Format citations per Spanish conventions (full/short/pinpoint) |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations underlying a Spanish statute |
| `get_spanish_implementations` | Find Spanish laws implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Spanish implementation counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check implementation status against EU directives |

---

## EU Law Integration

Spain is a full EU member state. Spanish law has systematic EU cross-references across data protection, cybersecurity, financial regulation, and consumer rights.

| Metric | Value |
|--------|-------|
| **EU Integration** | Full EU member (accession 1986) |
| **GDPR Implementation** | LOPDGDD (Ley Orgánica 3/2018, AEPD oversight) |
| **NIS2 Transposition** | Real Decreto-ley + Ley de Seguridad de las Redes y Sistemas de Información |
| **AI Act** | Direct application (EU regulation, no transposition needed) |
| **ENS** | Esquema Nacional de Seguridad (Real Decreto 311/2022) |
| **EUR-Lex Integration** | Automated metadata fetching |

### Key EU Acts with Spanish Implementations

1. **GDPR** (2016/679) -- LOPDGDD (Ley Orgánica 3/2018) + AEPD decisions
2. **NIS2 Directive** (2022/2555) -- Ley de Ciberseguridad (transposition pending as of 2026)
3. **eIDAS Regulation** (910/2014) -- Ley 6/2020 (firma y certificados electrónicos)
4. **AI Act** (2024/1689) -- Direct application
5. **DORA** (2022/2554) -- Direct application in financial sector

See [EU_INTEGRATION_GUIDE.md](docs/EU_INTEGRATION_GUIDE.md) for detailed documentation.

---

## Data Sources & Freshness

All content is sourced from authoritative Spanish legal databases:

- **[BOE Datos Abiertos](https://www.boe.es/datosabiertos)** -- Boletín Oficial del Estado open data API
- **[EUR-Lex](https://eur-lex.europa.eu/)** -- Official EU law database (metadata only)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Agencia Estatal Boletín Oficial del Estado |
| **Retrieval method** | BOE Datos Abiertos REST API |
| **Languages** | Spanish (official language of law) |
| **License** | BOE open data (Reutilización de la información del sector público) |
| **Coverage** | 12,181 consolidated statutes (national + regional) |
| **Last ingested** | 2026-02-25 |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors all data sources:

| Source | Check | Method |
|--------|-------|--------|
| **Statute amendments** | BOE API date comparison | All 12,181 statutes checked |
| **New statutes** | BOE publications (90-day window) | Diffed against database |
| **Preparatory works** | BOE proyecto de ley API (30-day window) | New texts detected |
| **EU reference staleness** | Git commit timestamps | Flagged if >90 days old |

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official BOE publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** in the free tier -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **EU cross-references** are extracted from Spanish statute text, not EUR-Lex full text
> - **Regional legislation** (Comunidades Autónomas) may not be fully covered

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. For guidance on professional obligations, consult the Consejo General de la Abogacía Española. See [PRIVACY.md](PRIVACY.md) for compliance guidance.

---

## Documentation

- **[EU Integration Guide](docs/EU_INTEGRATION_GUIDE.md)** -- Detailed EU cross-reference documentation
- **[EU Usage Examples](docs/EU_USAGE_EXAMPLES.md)** -- Practical EU lookup examples
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/spanish-law-mcp
cd spanish-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest statutes from BOE Datos Abiertos
npm run build:db                  # Rebuild SQLite database
npm run drift:detect              # Run drift detection against anchors
npm run check-updates             # Check for amendments and new statutes
npm run census                    # Generate coverage census report
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~849 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate across 12,181 statutes

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### @ansvar/spanish-law-mcp (This Project)
**Query 12,181 Spanish statutes directly from Claude** -- LOPDGDD, Código Penal, Estatuto de los Trabajadores, Código Civil, and more. Full provision text with EU cross-references. `npx @ansvar/spanish-law-mcp`

### [@ansvar/french-law-mcp](https://github.com/Ansvar-Systems/France-law-mcp)
**Query 3,958 French statutes** -- Code civil, Code pénal, loi Informatique et Libertés, and more. `npx @ansvar/french-law-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Tribunal Supremo, Audiencia Nacional)
- AEPD decisions and guidance ingestion
- Historical statute versions and amendment tracking
- Autonomous community legislation coverage

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (12,181 statutes, 297,760 provisions)
- [x] EU law integration tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [x] Premium preparatory works (12,193 documents)
- [ ] Tribunal Supremo case law coverage
- [ ] AEPD guidance documents
- [ ] Historical statute versions (amendment tracking)
- [ ] Autonomous community legislation

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{spanish_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Spanish Law MCP Server: Production-Grade Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/spanish-law-mcp},
  note = {12,181 Spanish statutes with 297,760 provisions and EU law cross-references}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Agencia Estatal BOE (open data -- reutilización sector público)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server started as our internal reference tool for Spanish law -- turns out everyone building for the Spanish and EU markets has the same research frustrations.

So we're open-sourcing it. Navigating 12,181 statutes shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
