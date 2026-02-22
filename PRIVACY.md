# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Spanish bar association rules and the LOPDGDD.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Spanish bar rules (Consejo General de la Abogacía Española / Colegios de Abogados) require strict data processing controls under the secreto profesional

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/spanish-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/spanish-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://spanish-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text, provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Spain)

### Spanish Bar Association Rules

Spanish lawyers (abogados/as) are bound by strict confidentiality rules under the Ley Orgánica del Poder Judicial, the Estatuto General de la Abogacía Española (Real Decreto 135/2021), and the Código Deontológico de la Abogacía Española.

#### Secreto Profesional

- All client communications are privileged under the secreto profesional
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Breach of professional secrecy may result in disciplinary and criminal sanctions (Article 199 Código Penal)

### LOPDGDD and GDPR Compliance

Under **GDPR Article 28** and Spain's **Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD)**, when using services that process client data:

- You are the **Data Controller** (Responsable del Tratamiento)
- AI service providers (Anthropic, Vercel) may be **Data Processors** (Encargados del Tratamiento)
- A **Data Processing Agreement (DPA)** / Contrato de Encargado del Tratamiento may be required
- The **AEPD** (Agencia Española de Protección de Datos) is the supervisory authority
- Ensure adequate technical and organizational measures are in place

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does the Ley de Enjuiciamiento Civil say about digital evidence?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties for tax fraud under the Código Penal?"
```

- Query pattern may reveal you are working on a tax fraud matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases (Aranzadi, Tirant lo Blanch, La Ley Digital) with proper DPAs

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms (Despachos individuales)

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (Aranzadi, Tirant lo Blanch, La Ley Digital)

### For Large Firms / Corporate Legal (Grandes despachos)

1. Negotiate DPAs with AI service providers
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns
4. Ensure compliance with LOPDGDD and Código Deontológico

### For Government / Public Sector (Administración Pública)

1. Use self-hosted deployment, no external APIs
2. Follow Esquema Nacional de Seguridad (ENS) requirements
3. Air-gapped option available for classified matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/spanish-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **Spanish Bar Guidance**: Consult CGAE or your Colegio de Abogados ethics guidance
- **Data Protection Authority**: AEPD (aepd.es)

---

**Last Updated**: 2026-02-22
**Tool Version**: 1.0.0
