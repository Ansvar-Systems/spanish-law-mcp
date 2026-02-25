#!/usr/bin/env tsx
/**
 * Spanish Law MCP — Census-Driven Ingestion Pipeline
 *
 * Fetches ALL Spanish consolidated legislation from BOE (boe.es) based on
 * the census.json manifest. Census-first: run scripts/census.ts first to
 * enumerate the full corpus.
 *
 * Strategy:
 * 1. Read data/census.json for the full list of ingestable laws
 * 2. For each law not yet ingested, fetch consolidated HTML from boe.es
 * 3. Parse articles (artículos) using the BOE HTML parser
 * 4. Write seed JSON files for the database builder
 * 5. Update census.json with ingestion results
 *
 * Resume support: skips laws that already have seed files (unless --force).
 * Progress is saved to census.json after each batch.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts                    # Full ingestion (resume)
 *   npx tsx scripts/ingest.ts --limit 50         # Ingest 50 pending laws
 *   npx tsx scripts/ingest.ts --skip-fetch       # Reparse from cached HTML
 *   npx tsx scripts/ingest.ts --force            # Re-ingest everything
 *   npx tsx scripts/ingest.ts --batch-size 500   # Save census every N laws
 *
 * Data is sourced from Spain's official gazette (public government data).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import { parseSpanishHtml, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');
const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── Args ────────────────────────────────────────────────────────────────────

function parseArgs(): {
  limit: number | null;
  skipFetch: boolean;
  force: boolean;
  batchSize: number;
} {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let force = false;
  let batchSize = 500;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--force') {
      force = true;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { limit, skipFetch, force, batchSize };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a census entry to an ActIndexEntry for the parser.
 */
function censusEntryToAct(entry: CensusEntry): ActIndexEntry {
  return {
    id: entry.id,
    title: entry.title,
    shortName: entry.id, // Use identifier as short name for census-driven ingestion
    status: entry.status as ActIndexEntry['status'],
    issuedDate: entry.fecha_disposicion,
    inForceDate: entry.fecha_vigencia || entry.fecha_disposicion,
    url: entry.url_html_consolidada || entry.url,
    description: `${entry.rango} — ${entry.departamento}`,
  };
}

/**
 * Create a minimal seed file with just metadata when fetching fails.
 */
function createFallbackSeed(act: ActIndexEntry): ParsedAct {
  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: '',
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions: [],
    definitions: [],
  };
}

/**
 * Save updated census.json with current ingestion state.
 */
function saveCensus(census: Census): void {
  // Recalculate summary
  census.summary.total_ingested = census.laws.filter(l => l.ingested).length;
  census.summary.total_provisions = census.laws.reduce((sum, l) => sum + l.provision_count, 0);

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));
}

interface IngestionResult {
  id: string;
  provisions: number;
  definitions: number;
  status: 'success' | 'skipped' | 'failed' | 'fallback';
  error?: string;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, skipFetch, force, batchSize } = parseArgs();

  console.log('Spanish Law MCP — Census-Driven Ingestion Pipeline');
  console.log('===================================================\n');
  console.log('  Source:   BOE (boe.es) — Boletín Oficial del Estado');
  console.log('  License:  Public government data (Open Data)');
  console.log('  Strategy: Census -> fetch HTML -> parse artículos -> seed JSON');
  console.log('');

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log('  --skip-fetch (reuse cached HTML)');
  if (force) console.log('  --force (re-ingest all)');
  console.log(`  --batch-size ${batchSize}`);
  console.log('');

  // Step 1: Load census
  if (!fs.existsSync(CENSUS_PATH)) {
    console.error('ERROR: No census.json found. Run `npx tsx scripts/census.ts` first.');
    process.exit(1);
  }

  const census: Census = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8'));
  console.log(`  Census: ${census.summary.total_laws} laws, ${census.summary.total_ingested} already ingested`);

  // Step 2: Build work list (ingestable laws not yet ingested)
  let pending: CensusEntry[];
  if (force) {
    pending = census.laws.filter(l => l.classification === 'ingestable');
  } else {
    pending = census.laws.filter(l => l.classification === 'ingestable' && !l.ingested);
  }

  if (limit && pending.length > limit) {
    pending = pending.slice(0, limit);
  }

  console.log(`  Pending: ${pending.length} laws to ingest\n`);

  if (pending.length === 0) {
    console.log('Nothing to ingest — all ingestable laws are already ingested.');
    return;
  }

  // Step 3: Ensure directories exist
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  // Step 4: Process laws
  const results: IngestionResult[] = [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let fallbacks = 0;
  let skipped = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  const startTime = Date.now();

  // Build a lookup map for census entries by id
  const censusMap = new Map<string, CensusEntry>();
  for (const entry of census.laws) {
    censusMap.set(entry.id, entry);
  }

  for (const entry of pending) {
    processed++;
    const act = censusEntryToAct(entry);
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Resume: skip if seed exists and not in force mode
    if (!force && fs.existsSync(seedFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        const provCount = existing.provisions?.length ?? 0;

        // Update census entry
        const censusEntry = censusMap.get(entry.id);
        if (censusEntry) {
          censusEntry.ingested = true;
          censusEntry.provision_count = provCount;
          censusEntry.ingestion_date = censusEntry.ingestion_date || new Date().toISOString().slice(0, 10);
        }

        skipped++;
        totalProvisions += provCount;
        results.push({ id: act.id, provisions: provCount, definitions: 0, status: 'skipped' });
      } catch {
        skipped++;
        results.push({ id: act.id, provisions: 0, definitions: 0, status: 'skipped' });
      }
      continue;
    }

    // Progress display
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = (pending.length - processed) / Math.max(rate, 0.1);
    process.stdout.write(
      `  [${processed}/${pending.length}] ${act.id} ` +
      `(${rate.toFixed(1)}/s, ~${Math.ceil(remaining / 60)}min left)...`
    );

    try {
      let html: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
        process.stdout.write(' cached...');
      } else {
        const fetchResult = await fetchWithRateLimit(act.url);

        if (fetchResult.status !== 200) {
          console.log(` HTTP ${fetchResult.status}`);
          const fallback = createFallbackSeed(act);
          fs.writeFileSync(seedFile, JSON.stringify(fallback, null, 2));

          const censusEntry = censusMap.get(entry.id);
          if (censusEntry) {
            censusEntry.ingested = true;
            censusEntry.provision_count = 0;
            censusEntry.ingestion_date = new Date().toISOString().slice(0, 10);
          }

          fallbacks++;
          results.push({ id: act.id, provisions: 0, definitions: 0, status: 'fallback', error: `HTTP ${fetchResult.status}` });
          continue;
        }

        html = fetchResult.body;
        fs.writeFileSync(sourceFile, html);
      }

      const parsed = parseSpanishHtml(html, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));

      console.log(` ${parsed.provisions.length} provisions, ${parsed.definitions.length} defs`);

      // Update census entry
      const censusEntry = censusMap.get(entry.id);
      if (censusEntry) {
        censusEntry.ingested = true;
        censusEntry.provision_count = parsed.provisions.length;
        censusEntry.ingestion_date = new Date().toISOString().slice(0, 10);
      }

      succeeded++;
      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      results.push({ id: act.id, provisions: parsed.provisions.length, definitions: parsed.definitions.length, status: 'success' });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(` ERROR: ${msg}`);

      // Create fallback seed
      const fallback = createFallbackSeed(act);
      fs.writeFileSync(seedFile, JSON.stringify(fallback, null, 2));

      const censusEntry = censusMap.get(entry.id);
      if (censusEntry) {
        censusEntry.ingested = true;
        censusEntry.provision_count = 0;
        censusEntry.ingestion_date = new Date().toISOString().slice(0, 10);
      }

      failed++;
      results.push({ id: act.id, provisions: 0, definitions: 0, status: 'failed', error: msg });
    }

    // Save census periodically
    if (processed % batchSize === 0) {
      saveCensus(census);
      console.log(`  --- Census saved (batch ${Math.floor(processed / batchSize)}) ---`);
    }
  }

  // Final census save
  saveCensus(census);

  // Report
  const totalElapsed = (Date.now() - startTime) / 1000;
  console.log(`\n${'='.repeat(72)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(72));
  console.log(`\n  Processed:    ${processed}`);
  console.log(`  Succeeded:    ${succeeded}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Fallback:     ${fallbacks}`);
  console.log(`  Failed:       ${failed}`);
  console.log(`  Provisions:   ${totalProvisions}`);
  console.log(`  Definitions:  ${totalDefinitions}`);
  console.log(`  Duration:     ${(totalElapsed / 60).toFixed(1)} min`);
  console.log(`  Rate:         ${(processed / totalElapsed).toFixed(1)} laws/sec`);
  console.log(`\n  Census state: ${census.summary.total_ingested}/${census.summary.total_ingestable} ingested`);
  console.log(`  Provisions in census: ${census.summary.total_provisions}`);
  console.log(`\n  Seed files: ${SEED_DIR}`);
  console.log(`  Census: ${CENSUS_PATH}`);
  console.log('='.repeat(72));

  // Show failures if any
  const failures = results.filter(r => r.status === 'failed');
  if (failures.length > 0) {
    console.log(`\nFailed items (${failures.length}):`);
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.id}: ${f.error}`);
    }
    if (failures.length > 20) {
      console.log(`  ... and ${failures.length - 20} more`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
