/**
 * Response metadata utilities for Spanish Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
  _citation?: import('./citation.js').CitationMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Boletín Oficial del Estado (boe.es) — Spanish Government Official State Gazette',
    jurisdiction: 'ES',
    disclaimer:
      'This data is sourced from the Boletín Oficial del Estado. The authoritative versions are maintained by the Spanish government. Always verify with the official BOE portal (boe.es).',
    freshness,
  };
}
