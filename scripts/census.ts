#!/usr/bin/env tsx
/**
 * Spanish Law MCP — Census Script
 *
 * Enumerates ALL consolidated legislation from BOE (Boletín Oficial del Estado)
 * using the official Open Data API.
 *
 * Strategy:
 * 1. Fetch the full catalog from the BOE consolidated legislation API
 *    (paginated — API caps at 10,000 results per call)
 * 2. Classify each norm as ingestable/not_ingestable
 * 3. Cross-reference with existing seed files to mark already-ingested items
 * 4. Write data/census.json following golden-standard schema
 *
 * The BOE API returns all consolidated legislation including:
 * - Leyes, Leyes Orgánicas, Reales Decretos, Reales Decretos-ley, etc.
 * - Both Estatal (national) and Autonómico (regional) scope
 *
 * BOE API documentation: https://www.boe.es/datosabiertos/documentos/APIconsolidada.pdf
 *
 * Endpoints used:
 *   GET /datosabiertos/api/legislacion-consolidada?limit=-1&offset=N
 *       Accept: application/json
 *       Returns: { status: { code, text }, data: [ ... items ] }
 *
 * Usage:
 *   npx tsx scripts/census.ts              # Full census (all items)
 *   npx tsx scripts/census.ts --limit 100  # First 100 items only
 *   npx tsx scripts/census.ts --estatal    # National scope only
 *
 * Data source: BOE (Agencia Estatal Boletín Oficial del Estado)
 * License: Public government data — reuse permitted under BOE reuse conditions
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const BOE_API_BASE = 'https://boe.es/datosabiertos/api/legislacion-consolidada';
const PAGE_SIZE = 10000; // BOE API max per call
const MIN_DELAY_MS = 500;

// ── Types ───────────────────────────────────────────────────────────────────

interface BoeApiResponse {
  status: { code: string; text: string };
  data: BoeItem[] | Record<string, never>;
}

interface BoeItem {
  fecha_actualizacion: string;
  identificador: string;
  ambito: { codigo: string; texto: string };
  departamento: { codigo: string; texto: string };
  rango: { codigo: string; texto: string };
  fecha_disposicion?: string;
  numero_oficial?: string;
  titulo: string;
  diario: string;
  fecha_publicacion: string;
  diario_numero: string;
  fecha_vigencia?: string;
  vigencia_agotada: string;
  estado_consolidacion: { codigo: string; texto: string };
  url_eli?: string;
  url_html_consolidada: string;
}

interface CensusEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: string;
  category: string;
  classification: 'ingestable' | 'not_ingestable' | 'skip';
  skip_reason?: string;
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
  rango_codigo: string;
  rango: string;
  ambito_codigo: string;
  ambito: string;
  departamento: string;
  fecha_disposicion: string;
  fecha_publicacion: string;
  fecha_vigencia: string;
  vigencia_agotada: string;
  estado_consolidacion_codigo: string;
  estado_consolidacion: string;
  url_eli: string;
  url_html_consolidada: string;
}

interface Census {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  portal_url: string;
  generated: string;
  summary: {
    total_laws: number;
    total_ingestable: number;
    total_not_ingestable: number;
    total_skip: number;
    total_ingested: number;
    total_provisions: number;
    scope_breakdown: Record<string, number>;
    rango_breakdown: Record<string, number>;
  };
  laws: CensusEntry[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs(): { limit: number | null; estatalOnly: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let estatalOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--estatal') {
      estatalOnly = true;
    }
  }

  return { limit, estatalOnly };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a page from the BOE API with rate limiting.
 */
async function fetchPage(offset: number): Promise<BoeItem[]> {
  await sleep(MIN_DELAY_MS);

  const url = `${BOE_API_BASE}?limit=-1&offset=${offset}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Spanish-Law-MCP/1.0 (https://github.com/Ansvar-Systems/spanish-law-mcp; hello@ansvar.ai)',
    },
  });

  if (!response.ok) {
    throw new Error(`BOE API returned HTTP ${response.status} for offset ${offset}`);
  }

  const body: BoeApiResponse = await response.json() as BoeApiResponse;
  if (body.status.code !== '200') {
    throw new Error(`BOE API error: ${body.status.text}`);
  }

  // data can be an empty object {} when no results
  if (!Array.isArray(body.data)) {
    return [];
  }

  return body.data;
}

/**
 * Map BOE consolidation status + vigencia_agotada to our standard status.
 *
 * estado_consolidacion codes:
 *   3 = Finalizado (consolidated text is complete and up to date)
 *   4 = Desactualizado (consolidated text is outdated — pending update)
 *
 * vigencia_agotada:
 *   N = Still in force
 *   S = Vigencia agotada (expired / repealed)
 */
function mapStatus(item: BoeItem): string {
  if (item.vigencia_agotada === 'S') return 'repealed';
  if (item.estado_consolidacion.codigo === '4') return 'amended';
  return 'in_force';
}

/**
 * Map BOE rango to a human-readable category for the census.
 */
function mapCategory(rango: string): string {
  return rango; // Already human-readable from BOE API
}

/**
 * Format a BOE date (YYYYMMDD) to ISO 8601 (YYYY-MM-DD).
 */
function formatDate(boeDate?: string): string {
  if (!boeDate || boeDate.length < 8) return '';
  return `${boeDate.slice(0, 4)}-${boeDate.slice(4, 6)}-${boeDate.slice(6, 8)}`;
}

/**
 * Check whether a seed file already exists for this item (already ingested).
 */
function checkIngested(id: string): { ingested: boolean; provisionCount: number; ingestionDate: string | null } {
  const seedFile = path.join(SEED_DIR, `${id}.json`);
  if (fs.existsSync(seedFile)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
      return {
        ingested: true,
        provisionCount: seed.provisions?.length ?? 0,
        ingestionDate: seed.ingestion_date ?? null,
      };
    } catch {
      return { ingested: false, provisionCount: 0, ingestionDate: null };
    }
  }
  return { ingested: false, provisionCount: 0, ingestionDate: null };
}

/**
 * Classify an item as ingestable or not.
 *
 * Ingestable if:
 * - Has a url_html_consolidada (consolidated HTML available)
 * - Consolidation status is Finalizado (code 3)
 * - Has a valid BOE identifier
 *
 * Not ingestable if:
 * - Consolidation is Desactualizado (outdated) — we skip these
 * - No HTML URL available
 */
function classifyItem(item: BoeItem): { classification: CensusEntry['classification']; skipReason?: string } {
  if (!item.url_html_consolidada) {
    return { classification: 'not_ingestable', skipReason: 'No consolidated HTML URL' };
  }

  if (!item.identificador) {
    return { classification: 'not_ingestable', skipReason: 'No BOE identifier' };
  }

  if (item.estado_consolidacion.codigo === '4') {
    // Desactualizado — still ingestable but flagged
    return { classification: 'ingestable' };
  }

  return { classification: 'ingestable' };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, estatalOnly } = parseArgs();

  console.log('Spanish Law MCP — Census');
  console.log('========================\n');
  console.log('  Source: BOE Open Data API (boe.es/datosabiertos/)');
  console.log('  API:    /datosabiertos/api/legislacion-consolidada');
  console.log('  Scope:  All consolidated legislation');
  if (estatalOnly) console.log('  Filter: Estatal (national) only');
  if (limit) console.log(`  Limit:  ${limit} items`);
  console.log('');

  // Step 1: Fetch all items (paginated)
  console.log('Fetching consolidated legislation catalog from BOE...\n');

  let allItems: BoeItem[] = [];
  let offset = 0;
  let pageNum = 0;

  while (true) {
    pageNum++;
    process.stdout.write(`  Page ${pageNum} (offset ${offset})...`);

    const items = await fetchPage(offset);
    if (items.length === 0) {
      console.log(' empty — done');
      break;
    }

    allItems = allItems.concat(items);
    console.log(` ${items.length} items (total: ${allItems.length})`);

    if (items.length < PAGE_SIZE) {
      // Last page — fewer than max items means we've reached the end
      break;
    }

    offset += PAGE_SIZE;
  }

  console.log(`\n  Total items from BOE API: ${allItems.length}\n`);

  // Step 2: Filter if estatal only
  if (estatalOnly) {
    const before = allItems.length;
    allItems = allItems.filter(item => item.ambito.codigo === '1');
    console.log(`  Filtered to estatal: ${allItems.length} (removed ${before - allItems.length} autonómico)\n`);
  }

  // Step 3: Apply limit if specified
  if (limit && allItems.length > limit) {
    allItems = allItems.slice(0, limit);
    console.log(`  Limited to: ${allItems.length} items\n`);
  }

  // Step 4: Build census entries
  console.log('Building census entries...\n');

  const entries: CensusEntry[] = [];
  const rangoBreakdown: Record<string, number> = {};
  const scopeBreakdown: Record<string, number> = {};

  for (const item of allItems) {
    const { classification, skipReason } = classifyItem(item);
    const { ingested, provisionCount, ingestionDate } = checkIngested(item.identificador);

    const rango = item.rango.texto;
    const ambito = item.ambito.texto;
    rangoBreakdown[rango] = (rangoBreakdown[rango] ?? 0) + 1;
    scopeBreakdown[ambito] = (scopeBreakdown[ambito] ?? 0) + 1;

    entries.push({
      id: item.identificador,
      title: item.titulo,
      identifier: item.identificador,
      url: item.url_html_consolidada,
      status: mapStatus(item),
      category: mapCategory(rango),
      classification,
      skip_reason: skipReason,
      ingested,
      provision_count: provisionCount,
      ingestion_date: ingestionDate,
      rango_codigo: item.rango.codigo,
      rango,
      ambito_codigo: item.ambito.codigo,
      ambito,
      departamento: item.departamento.texto,
      fecha_disposicion: formatDate(item.fecha_disposicion),
      fecha_publicacion: formatDate(item.fecha_publicacion),
      fecha_vigencia: formatDate(item.fecha_vigencia),
      vigencia_agotada: item.vigencia_agotada,
      estado_consolidacion_codigo: item.estado_consolidacion.codigo,
      estado_consolidacion: item.estado_consolidacion.texto,
      url_eli: item.url_eli ?? '',
      url_html_consolidada: item.url_html_consolidada,
    });
  }

  // Sort by fecha_disposicion descending (most recent first), then by identifier
  entries.sort((a, b) => {
    const dateA = a.fecha_disposicion || '0000-00-00';
    const dateB = b.fecha_disposicion || '0000-00-00';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return a.id.localeCompare(b.id);
  });

  // Step 5: Write census.json
  const ingestable = entries.filter(e => e.classification === 'ingestable').length;
  const notIngestable = entries.filter(e => e.classification === 'not_ingestable').length;
  const skip = entries.filter(e => e.classification === 'skip').length;
  const ingested = entries.filter(e => e.ingested).length;
  const totalProvisions = entries.reduce((sum, e) => sum + e.provision_count, 0);

  const census: Census = {
    schema_version: '1.0',
    jurisdiction: 'ES',
    jurisdiction_name: 'Spain',
    portal: 'boe-open-data-api',
    portal_url: 'https://www.boe.es/datosabiertos/',
    generated: new Date().toISOString().slice(0, 10),
    summary: {
      total_laws: entries.length,
      total_ingestable: ingestable,
      total_not_ingestable: notIngestable,
      total_skip: skip,
      total_ingested: ingested,
      total_provisions: totalProvisions,
      scope_breakdown: scopeBreakdown,
      rango_breakdown: rangoBreakdown,
    },
    laws: entries,
  };

  const dataDir = path.dirname(CENSUS_PATH);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  // Step 6: Report
  console.log(`${'='.repeat(64)}`);
  console.log('CENSUS REPORT');
  console.log('='.repeat(64));
  console.log(`\n  Total items:        ${entries.length}`);
  console.log(`  Ingestable:         ${ingestable}`);
  console.log(`  Not ingestable:     ${notIngestable}`);
  console.log(`  Skip:               ${skip}`);
  console.log(`  Already ingested:   ${ingested}`);
  console.log(`  Total provisions:   ${totalProvisions}`);

  console.log('\n  By scope (ámbito):');
  for (const [k, v] of Object.entries(scopeBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(20)} ${v}`);
  }

  console.log('\n  By type (rango):');
  for (const [k, v] of Object.entries(rangoBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(30)} ${v}`);
  }

  console.log(`\n  Output: ${CENSUS_PATH}`);
  console.log(`  Size:   ${(fs.statSync(CENSUS_PATH).size / 1024).toFixed(0)} KB\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
