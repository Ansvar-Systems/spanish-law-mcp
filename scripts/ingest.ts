#!/usr/bin/env tsx
/**
 * Spanish Law MCP — Ingestion Pipeline
 *
 * Fetches Spanish legislation from BOE (boe.es).
 * BOE is Spain's official gazette and provides open access to consolidated
 * legislation texts.
 *
 * Strategy:
 * 1. For each act, fetch the consolidated HTML from boe.es
 * 2. Parse articles (artículos) from the structured HTML
 * 3. Write seed JSON files for the database builder
 *
 * If fetching from BOE fails (access issues, timeouts), the pipeline
 * generates minimal seed files with metadata so the database can still
 * be built with document records.
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached pages
 *
 * Data is sourced from Spain's official gazette (public government data).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import { parseSpanishHtml, KEY_SPANISH_ACTS, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

interface IngestionResult {
  act: ActIndexEntry;
  provisions: number;
  definitions: number;
  status: 'success' | 'skipped' | 'failed' | 'fallback';
  error?: string;
}

/**
 * Create a minimal seed file with just metadata when fetching fails.
 * This ensures build-db.ts can still create document records.
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

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<IngestionResult[]> {
  console.log(`\nProcessing ${acts.length} Spanish laws...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  const results: IngestionResult[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      console.log(`  SKIP ${act.shortName} (${act.id}) — cached`);
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        results.push({
          act,
          provisions: existing.provisions?.length ?? 0,
          definitions: existing.definitions?.length ?? 0,
          status: 'skipped',
        });
      } catch {
        results.push({
          act,
          provisions: 0,
          definitions: 0,
          status: 'skipped',
        });
      }
      continue;
    }

    try {
      let html: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
      } else {
        process.stdout.write(`  Fetching ${act.shortName} (${act.id})...`);

        const fetchResult = await fetchWithRateLimit(act.url);

        if (fetchResult.status !== 200) {
          console.log(` HTTP ${fetchResult.status}`);
          // Create fallback seed with metadata only
          const fallback = createFallbackSeed(act);
          fs.writeFileSync(seedFile, JSON.stringify(fallback, null, 2));
          console.log(`    -> fallback seed (metadata only)`);
          results.push({
            act,
            provisions: 0,
            definitions: 0,
            status: 'fallback',
            error: `HTTP ${fetchResult.status}`,
          });
          continue;
        }

        html = fetchResult.body;

        // Verify we got actual legislation content
        if (html.length < 1000 || (!html.includes('art') && !html.includes('Art'))) {
          console.log(` WARNING: response may not contain legislation`);
        } else {
          console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
        }

        fs.writeFileSync(sourceFile, html);
      }

      const parsed = parseSpanishHtml(html, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);

      // If parsing yielded no provisions, that's unusual but not fatal
      if (parsed.provisions.length === 0) {
        console.log(`    NOTE: no provisions extracted — HTML structure may differ from expected BOE format`);
      }

      results.push({
        act,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'success',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${act.shortName}: ${msg}`);

      // Create fallback seed even on error
      const fallback = createFallbackSeed(act);
      fs.writeFileSync(seedFile, JSON.stringify(fallback, null, 2));
      console.log(`    -> fallback seed (metadata only)`);

      results.push({
        act,
        provisions: 0,
        definitions: 0,
        status: 'failed',
        error: msg,
      });
    }
  }

  return results;
}

function printReport(results: IngestionResult[]): void {
  console.log(`\n${'='.repeat(72)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(72));

  const succeeded = results.filter(r => r.status === 'success');
  const skipped = results.filter(r => r.status === 'skipped');
  const fallbacks = results.filter(r => r.status === 'fallback');
  const failed = results.filter(r => r.status === 'failed');
  const totalProvisions = results.reduce((sum, r) => sum + r.provisions, 0);
  const totalDefinitions = results.reduce((sum, r) => sum + r.definitions, 0);

  if (succeeded.length > 0) {
    console.log(`\nSuccessfully ingested: ${succeeded.length}`);
    for (const r of succeeded) {
      console.log(`  ${r.act.shortName.padEnd(12)} (${r.act.id.padEnd(20)}) ${r.provisions.toString().padStart(4)} provisions, ${r.definitions.toString().padStart(3)} definitions`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (cached): ${skipped.length}`);
    for (const r of skipped) {
      console.log(`  ${r.act.shortName.padEnd(12)} (${r.act.id.padEnd(20)}) ${r.provisions.toString().padStart(4)} provisions`);
    }
  }

  if (fallbacks.length > 0) {
    console.log(`\nFallback (metadata only): ${fallbacks.length}`);
    for (const r of fallbacks) {
      console.log(`  ${r.act.shortName.padEnd(12)} (${r.act.id.padEnd(20)}) — ${r.error}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}`);
    for (const r of failed) {
      console.log(`  ${r.act.shortName.padEnd(12)} (${r.act.id.padEnd(20)}) — ${r.error}`);
    }
  }

  console.log(`\nTotal provisions: ${totalProvisions}`);
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log(`Seed files: ${SEED_DIR}`);
  console.log('='.repeat(72));
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('Spanish Law MCP — Ingestion Pipeline');
  console.log('=====================================\n');
  console.log(`  Source: BOE (boe.es) — Boletín Oficial del Estado`);
  console.log(`  License: Public government data (Open Data)`);
  console.log(`  Strategy: Fetch consolidated HTML -> parse artículos -> seed JSON`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const acts = limit ? KEY_SPANISH_ACTS.slice(0, limit) : KEY_SPANISH_ACTS;
  const results = await fetchAndParseActs(acts, skipFetch);
  printReport(results);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
