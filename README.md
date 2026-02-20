# Spanish Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/spanish-law-mcp)](https://www.npmjs.com/package/@ansvar/spanish-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/spanish-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/spanish-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/spanish-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/spanish-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Spanish legislation, including data protection (LOPDGDD), national security framework (ENS), cybercrime (Codigo Penal), e-commerce (LSSI), company law, and NIS2 transposition with Spanish full-text search.

**MCP Registry:** `eu.ansvar/spanish-law-mcp`
**npm:** `@ansvar/spanish-law-mcp`
**License:** Apache-2.0

---

## Deployment Tier

**MEDIUM** -- dual tier, free database bundled in npm package.

| Tier | Platform | Database | Content |
|------|----------|----------|---------|
| **Free** | Vercel (Hobby) / npm (stdio) | Core legislation (~120-200 MB) | Key laws (LOPDGDD, ENS, Codigo Penal cybercrime, LSSI, Ley de Sociedades de Capital, NIS2 transposition), FTS search, EU cross-references |
| **Professional** | Azure Container Apps / Docker / Local | Full database (~700 MB - 1.1 GB) | + All leyes organicas and ordinarias, AEPD decisions and guidance, Tribunal Supremo/Constitucional summaries, reales decretos, autonomous community cross-references |

The full database is larger due to the comprehensive scope of Spanish legislation and the extensive body of AEPD enforcement decisions. The free tier contains all key data protection, cybersecurity, cybercrime, e-commerce, and company law legislation from BOE.

---

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [BOE](https://www.boe.es) | Agencia Estatal Boletin Oficial del Estado | XML Download / API | Daily | Government Open Data (Ley 37/2007) | All national legislation, codes, reales decretos, and official publications |

> Full provenance metadata: [`sources.yml`](./sources.yml)

---

## Quick Start

### Claude Desktop / Cursor (stdio)

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

### Vercel Streamable HTTP (ChatGPT / Claude.ai)

Once deployed, the public endpoint will be available at:

```
https://spanish-law-mcp.vercel.app/api/mcp
```

---

## Tools

| Tool | Description | Free Tier | Professional |
|------|-------------|-----------|-------------|
| `get_provision` | Retrieve a specific article from a Spanish law or code | Yes | Yes |
| `search_legislation` | Full-text search across all Spanish legislation (Spanish) | Yes | Yes |
| `list_laws` | List all available laws with metadata | Yes | Yes |
| `get_law_structure` | Get table of contents / structure of a law or code | Yes | Yes |
| `get_provision_eu_basis` | Cross-reference Spanish law to EU directives/regulations | Yes | Yes |
| `search_reales_decretos` | Search reales decretos and regulatory instruments | No (upgrade) | Yes |
| `get_aepd_guidance` | Retrieve AEPD decisions and guidance | No (upgrade) | Yes |

---

## Key Legislation Covered

| Law | Identifier | Domain | Key Topics |
|-----|-----------|--------|------------|
| **LOPDGDD** | Ley Organica 3/2018 | Data Protection | Personal data processing, digital rights, AEPD oversight, consent, GDPR implementation, international transfers |
| **ENS** | Real Decreto 311/2022 | Cybersecurity | National security framework for public sector, security categories, CCN-CERT, mandatory controls, certification |
| **NIS2 Transposition** | Ley 2024-xxx | Cybersecurity | Essential/important entity obligations, incident reporting, supply chain security |
| **Codigo Penal (cybercrime)** | Art. 197 ff. | Cybercrime | Discovery and disclosure of secrets, unauthorized access, data interception, system interference |
| **Ley de Sociedades de Capital** | Real Decreto Legislativo 1/2010 | Company Law | SA and SL companies, corporate governance, directors' duties, capital requirements |
| **LSSI** | Ley 34/2002 | e-Commerce | Information society services, hosting provider liability, electronic contracts, commercial communications |

---

## Database Estimates

| Component | Free Tier | Full (Professional) |
|-----------|-----------|---------------------|
| Core codes and key laws | ~80-140 MB | ~80-140 MB |
| All leyes and reales decretos | -- | ~400-600 MB |
| AEPD decisions and guidance | -- | ~100-200 MB |
| Case law summaries | -- | ~80-150 MB |
| Cross-references and metadata | ~5 MB | ~15 MB |
| **Total** | **~120-200 MB** | **~700 MB - 1.1 GB** |

**Delivery strategy:** Free-tier DB bundled in npm package (Strategy A -- fits within Vercel 250 MB function limit). If final size exceeds 250 MB after ingestion, switch to Strategy B (runtime download from GitHub Releases).

---

## Regulatory Context

- **Supervisory Authority:** AEPD (Agencia Espanola de Proteccion de Datos) -- issues massive fines, among the highest in the EU (EUR 8.15M to CaixaBank, EUR 6M to BBVA)
- **LOPDGDD** is a Ley Organica (requiring absolute majority in Congress), giving it enhanced constitutional status above ordinary laws
- **ENS** (Esquema Nacional de Seguridad) is Spain's comprehensive national security framework for the public sector, updated in 2022 with new security controls and certification requirements
- **CCN-CERT** (Centro Criptologico Nacional) handles public sector cybersecurity incidents under the ENS framework
- **INCIBE-CERT** handles private sector and citizen cybersecurity incidents
- Spain has **17 Autonomous Communities** with their own legislative powers; BOE covers national legislation
- **Four co-official languages:** Castilian (es), Catalan (ca), Basque (eu), Galician (gl)
- Spain is an EU founding member and GDPR/RGPD compliance is a core regulatory requirement

---

## Development

```bash
# Clone the repository
git clone https://github.com/Ansvar-Systems/spanish-law-mcp.git
cd spanish-law-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Build database (requires raw data in data/ directory)
npm run build:db

# Build free-tier database
npm run build:db:free

# Run drift detection
npm run drift:detect

# Full validation
npm run validate
```

---

## Architecture

```
spanish-law-mcp/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Test + lint + security scan
│   │   ├── publish.yml               # npm publish on version tags
│   │   ├── check-source-updates.yml  # Data freshness monitoring
│   │   └── drift-detect.yml          # Upstream drift detection
│   ├── SECURITY.md
│   ├── SECURITY-SETUP.md
│   └── ISSUE_TEMPLATE/
│       └── data-error.md
├── data/
│   └── .gitkeep
├── fixtures/
│   ├── golden-tests.json             # 12 contract tests
│   ├── golden-hashes.json            # 6 drift detection anchors
│   └── README.md
├── scripts/
│   ├── build-db.ts
│   ├── build-db-free.ts
│   ├── download-free-db.sh
│   ├── ingest.ts
│   ├── drift-detect.ts
│   └── check-source-updates.ts
├── src/
│   ├── server.ts
│   ├── db.ts
│   └── tools/
│       ├── get-provision.ts
│       ├── search-legislation.ts
│       ├── list-laws.ts
│       ├── get-law-structure.ts
│       ├── get-provision-eu-basis.ts
│       ├── search-reales-decretos.ts
│       └── get-aepd-guidance.ts
├── __tests__/
│   ├── unit/
│   ├── contract/
│   │   └── golden.test.ts
│   └── integration/
├── sources.yml
├── server.json
├── package.json
├── tsconfig.json
├── vercel.json
├── CHANGELOG.md
├── LICENSE
└── README.md
```

---

## Notes on Spanish Data Protection Landscape

**LOPDGDD** (Ley Organica 3/2018) has several distinctive features:

- **Ley Organica status** -- constitutional-grade legislation requiring absolute majority to amend
- **Digital rights** title (Title X) -- unique among EU member states, guaranteeing rights such as digital disconnection at work, digital education, and digital testament
- **Age of digital consent** set at 14 (lowest in the EU, vs. GDPR default of 16)
- **AEPD** is one of the most active and aggressive DPAs in Europe with significant fine history

**ENS** (Esquema Nacional de Seguridad) is comprehensive:
- Mandatory for all public sector entities and their supply chain
- Three security categories (BASIC, MEDIUM, HIGH) with increasing requirements
- **CCN-STIC** guidelines provide detailed technical implementation guidance
- ENS certification is increasingly required for government IT contracts

Spain is the **EU's fourth largest economy** and the distinctive combination of LOPDGDD digital rights provisions with ENS security requirements creates a unique compliance landscape.

---

## Related Documents

- [MCP Quality Standard](../../mcp-quality-standard.md) -- quality requirements for all Ansvar MCPs
- [MCP Infrastructure Blueprint](../../mcp-infrastructure-blueprint.md) -- infrastructure implementation templates
- [MCP Deployment Tiers](../../mcp-deployment-tiers.md) -- free vs. professional tier strategy
- [MCP Server Registry](../../mcp-server-registry.md) -- operational registry of all MCPs
- [MCP Remote Access](../../mcp-remote-access.md) -- public Vercel endpoint URLs

---

## Security

Report vulnerabilities to **security@ansvar.eu** (48-hour acknowledgment SLA).

See [SECURITY.md](.github/SECURITY.md) for full disclosure policy.

---

**Maintained by:** Ansvar Systems Engineering
**Contact:** hello@ansvar.eu
