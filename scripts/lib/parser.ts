/**
 * HTML parser for Spanish legislation from BOE (boe.es).
 *
 * Parses consolidated legislation HTML served by boe.es into structured
 * seed JSON. The BOE HTML uses:
 *
 * - <div class="articulo"> for individual articles (artículos)
 * - <div class="titulo"> for title headings (títulos)
 * - <div class="capitulo"> for chapter headings (capítulos)
 * - <h5> inside .articulo for article number/title
 * - <p> elements for article body text
 * - <div class="disposicion"> for additional/final/transitional provisions
 *
 * BOE URLs follow the pattern:
 *   https://www.boe.es/buscar/act.php?id=BOE-A-XXXX-XXXXX (HTML)
 *   https://www.boe.es/buscar/act.php?id=BOE-A-XXXX-XXXXX&tn=1&p=YYYYMMDD (XML)
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Strip HTML tags and decode common entities, normalising whitespace.
 */
function stripHtml(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ordm;/g, 'º')
    .replace(/&ordf;/g, 'ª')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&#\d+;/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the current chapter/title heading by scanning backwards from a position.
 * BOE uses <div class="titulo"> and <div class="capitulo"> for section groupings.
 */
function findChapterHeading(html: string, articlePos: number): string {
  const beforeArticle = html.substring(Math.max(0, articlePos - 10000), articlePos);

  // Look for the last título or capítulo heading before this article
  // BOE patterns: <div class="titulo">...<p class="titulo_nivel">Título X. Name</p>...</div>
  //               <div class="capitulo">...<p class="capitulo_nivel">Capítulo X. Name</p>...</div>
  const headingPatterns = [
    // Match <p> or <h4>/<h3> with title/chapter text
    /<(?:p|h[34])[^>]*class="(?:titulo|capitulo)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|h[34])>/gi,
    // Broader match for div.titulo or div.capitulo content
    /<div[^>]*class="(?:titulo|capitulo)"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  let lastHeading = '';

  for (const pattern of headingPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(beforeArticle)) !== null) {
      const text = stripHtml(match[1]);
      if (text.length > 3 && text.length < 300) {
        lastHeading = text;
      }
    }
    if (lastHeading) break;
  }

  return lastHeading;
}

/**
 * Parse BOE HTML to extract provisions from a Spanish statute page.
 *
 * BOE consolidated texts have a structured layout with:
 * - <div class="articulo" id="..."> for each article
 * - <h5> elements containing article number and title
 * - <p> elements with the article text
 * - Larger structural divisions via <div class="titulo">, <div class="capitulo">
 */
export function parseSpanishHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Strategy 1: Find <div class="articulo"> blocks (standard BOE format)
  const articuloRegex = /<div[^>]*class="articulo"[^>]*(?:id="([^"]*)")?[^>]*>/gi;
  const articuloStarts: { id: string; pos: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = articuloRegex.exec(html)) !== null) {
    articuloStarts.push({ id: match[1] ?? '', pos: match.index });
  }

  // Strategy 2: If no .articulo divs found, try matching article headings directly
  // BOE sometimes uses different structures (e.g., Artículo N. Title in <h5>/<p>)
  if (articuloStarts.length === 0) {
    const artHeadingRegex = /<(?:h[3-6]|p)[^>]*>\s*(?:<[^>]+>)*\s*Art[ií]culo\s+(\d+[a-zA-Z]*(?:\s+(?:bis|ter|quater|quinquies|sexies|septies|octies))?)\b[.\s]*([\s\S]*?)<\/(?:h[3-6]|p)>/gi;
    const headingMatches: { num: string; title: string; pos: number }[] = [];

    while ((match = artHeadingRegex.exec(html)) !== null) {
      headingMatches.push({
        num: match[1].trim().replace(/\s+/g, ''),
        title: stripHtml(match[2]),
        pos: match.index,
      });
    }

    for (let i = 0; i < headingMatches.length; i++) {
      const hm = headingMatches[i];
      const startPos = hm.pos;
      const endPos = i + 1 < headingMatches.length
        ? headingMatches[i + 1].pos
        : html.length;

      const blockHtml = html.substring(startPos, endPos);
      // Remove the heading itself to get just the body
      const bodyHtml = blockHtml.replace(/<(?:h[3-6]|p)[^>]*>[\s\S]*?<\/(?:h[3-6]|p)>/, '');
      const content = stripHtml(bodyHtml);

      if (content.length < 5) continue;

      const chapter = findChapterHeading(html, startPos);
      const normalizedNum = hm.num.toLowerCase().replace(/\s+/g, '');
      const provisionRef = `art${normalizedNum}`;

      provisions.push({
        provision_ref: provisionRef,
        chapter: chapter || undefined,
        section: normalizedNum,
        title: hm.title,
        content: content.substring(0, 12000),
      });

      // Check for definitions
      if (hm.title.toLowerCase().includes('definicion') || hm.title.toLowerCase().includes('definición')) {
        extractDefinitions(blockHtml, provisionRef, definitions);
      }
    }

    return buildResult(act, provisions, definitions);
  }

  // Process .articulo divs (standard path)
  for (let i = 0; i < articuloStarts.length; i++) {
    const artStart = articuloStarts[i];
    const startPos = artStart.pos;
    const endPos = i + 1 < articuloStarts.length
      ? articuloStarts[i + 1].pos
      : html.indexOf('</body>', startPos);
    const actualEnd = endPos > startPos ? endPos : html.length;
    const articleHtml = html.substring(startPos, actualEnd);

    // Extract article number and title from <h5> or similar heading
    // BOE patterns:
    //   <h5>Artículo 1. Objeto de la ley</h5>
    //   <h5><a ...>Artículo 1.</a> Objeto de la ley</h5>
    const headingMatch = articleHtml.match(
      /<h[45][^>]*>([\s\S]*?)<\/h[45]>/i
    );

    let articleNum = '';
    let title = '';

    if (headingMatch) {
      const headingText = stripHtml(headingMatch[1]);

      // Extract article number: "Artículo 1" or "Artículo 1 bis"
      const numMatch = headingText.match(
        /Art[ií]culo\s+(\d+[a-zA-Z]*(?:\s+(?:bis|ter|quater|quinquies|sexies|septies|octies))?)/i
      );
      if (numMatch) {
        articleNum = numMatch[1].trim().replace(/\s+/g, '');
      }

      // Extract title: everything after "Artículo N." or "Artículo N bis."
      const titleMatch = headingText.match(
        /Art[ií]culo\s+\d+[a-zA-Z]*(?:\s+(?:bis|ter|quater|quinquies|sexies|septies|octies))?\.?\s*(.*)/i
      );
      if (titleMatch) {
        title = titleMatch[1].trim().replace(/^[.\s]+/, '');
      }
    }

    // Fallback: try to extract from the id attribute
    if (!articleNum && artStart.id) {
      const idMatch = artStart.id.match(/a(?:rt[ií]culo)?[-_]?(\d+[a-zA-Z]*)/i);
      if (idMatch) {
        articleNum = idMatch[1];
      }
    }

    // Skip if we couldn't determine the article number
    if (!articleNum) continue;

    // Extract the body content (everything after the heading)
    let contentHtml = articleHtml;
    if (headingMatch) {
      const headingEnd = articleHtml.indexOf(headingMatch[0]) + headingMatch[0].length;
      contentHtml = articleHtml.substring(headingEnd);
    }
    const content = stripHtml(contentHtml);

    // Skip articles with very little content
    if (content.length < 5) continue;

    // Find the chapter heading for context
    const chapter = findChapterHeading(html, startPos);

    const normalizedNum = articleNum.toLowerCase().replace(/\s+/g, '');
    const provisionRef = `art${normalizedNum}`;

    provisions.push({
      provision_ref: provisionRef,
      chapter: chapter || undefined,
      section: normalizedNum,
      title,
      content: content.substring(0, 12000), // Cap at 12K chars
    });

    // Extract definitions if this is a definitions article
    if (
      title.toLowerCase().includes('definicion') ||
      title.toLowerCase().includes('definición') ||
      title.toLowerCase().includes('conceptos') ||
      content.toLowerCase().includes('a los efectos de') ||
      content.toLowerCase().includes('se entenderá por')
    ) {
      extractDefinitions(articleHtml, provisionRef, definitions);
    }
  }

  return buildResult(act, provisions, definitions);
}

/**
 * Build the ParsedAct result object.
 */
function buildResult(
  act: ActIndexEntry,
  provisions: ParsedProvision[],
  definitions: ParsedDefinition[],
): ParsedAct {
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
    provisions,
    definitions,
  };
}

/**
 * Extract term definitions from a definitions article.
 *
 * Spanish legal definitions typically follow patterns like:
 * - a) Término: definición.
 * - «Término»: definición.
 * - "Término": definición.
 * - N. Término: definición.
 *
 * Also handles "A los efectos de esta ley, se entenderá por:" preambles.
 */
function extractDefinitions(
  articleHtml: string,
  sourceProvision: string,
  definitions: ParsedDefinition[],
): void {
  const text = stripHtml(articleHtml);

  // Pattern 1: Lettered definitions: a) Term: definition. / b) Term: definition.
  const letteredPattern = /[a-zñ]\)\s*([^:]+):\s*([^.]+(?:\.[^a-zñ\)]+)*\.)/gi;
  let match: RegExpExecArray | null;

  while ((match = letteredPattern.exec(text)) !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();
    if (term.length > 1 && term.length < 100 && definition.length > 10) {
      definitions.push({ term, definition, source_provision: sourceProvision });
    }
  }

  // Pattern 2: Quoted terms: «Término» or "Término": definición
  const quotedPattern = /[«"]([^»"]+)[»"]:\s*([^.]+(?:\.[^«"]+)*\.)/g;
  while ((match = quotedPattern.exec(text)) !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();
    if (term.length > 1 && term.length < 100 && definition.length > 10) {
      // Avoid duplicates
      const exists = definitions.some(
        d => d.term.toLowerCase() === term.toLowerCase() && d.source_provision === sourceProvision
      );
      if (!exists) {
        definitions.push({ term, definition, source_provision: sourceProvision });
      }
    }
  }

  // Pattern 3: Numbered definitions: 1. Term: definition.
  const numberedPattern = /\d+\.\s*([^:]+):\s*([^.]+(?:\.[^0-9]+)*\.)/g;
  while ((match = numberedPattern.exec(text)) !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();
    if (term.length > 1 && term.length < 100 && definition.length > 10) {
      const exists = definitions.some(
        d => d.term.toLowerCase() === term.toLowerCase() && d.source_provision === sourceProvision
      );
      if (!exists) {
        definitions.push({ term, definition, source_provision: sourceProvision });
      }
    }
  }
}

/**
 * Pre-configured list of key Spanish laws to ingest.
 *
 * Source: BOE (boe.es) - Spain's official gazette.
 * URLs use the consolidated text portal:
 *   https://www.boe.es/buscar/act.php?id=BOE-A-XXXX-XXXXX
 *
 * These are the most important laws for cybersecurity, data protection,
 * digital services, and general compliance use cases.
 */
export const KEY_SPANISH_ACTS: ActIndexEntry[] = [
  {
    id: 'BOE-A-2018-16673',
    title: 'Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales',
    shortName: 'LOPDGDD',
    status: 'in_force',
    issuedDate: '2018-12-05',
    inForceDate: '2018-12-07',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673',
    description: 'Spain\'s data protection law implementing GDPR. Establishes AEPD as supervisory authority and digital rights.',
  },
  {
    id: 'BOE-A-2022-7191',
    title: 'Real Decreto 311/2022, de 3 de mayo, por el que se regula el Esquema Nacional de Seguridad',
    shortName: 'ENS',
    status: 'in_force',
    issuedDate: '2022-05-03',
    inForceDate: '2022-05-04',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191',
    description: 'National Security Framework (ENS) for public sector information systems. Mandatory security measures and controls.',
  },
  {
    id: 'BOE-A-2002-13758',
    title: 'Ley 34/2002, de 11 de julio, de servicios de la sociedad de la información y de comercio electrónico',
    shortName: 'LSSI-CE',
    status: 'in_force',
    issuedDate: '2002-07-11',
    inForceDate: '2002-10-12',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758',
    description: 'E-commerce and information society services law. Regulates online service providers, spam, cookies, and electronic contracts.',
  },
  {
    id: 'BOE-A-1978-31229',
    title: 'Constitución Española',
    shortName: 'CE',
    status: 'in_force',
    issuedDate: '1978-12-29',
    inForceDate: '1978-12-29',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229',
    description: 'Spanish Constitution. Article 18 guarantees right to privacy and data protection. Foundation of all Spanish law.',
  },
  {
    id: 'BOE-A-1995-25444',
    title: 'Ley Orgánica 10/1995, de 23 de noviembre, del Código Penal',
    shortName: 'CP',
    status: 'in_force',
    issuedDate: '1995-11-23',
    inForceDate: '1996-05-24',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-25444',
    description: 'Spanish Criminal Code. Includes cybercrime offences, data protection violations, and computer fraud.',
  },
  {
    id: 'BOE-A-2010-10544',
    title: 'Real Decreto Legislativo 1/2010, de 2 de julio, por el que se aprueba el texto refundido de la Ley de Sociedades de Capital',
    shortName: 'LSC',
    status: 'in_force',
    issuedDate: '2010-07-02',
    inForceDate: '2010-09-01',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-10544',
    description: 'Companies Act (Capital Companies Law). Corporate governance, directors\' duties, and corporate compliance obligations.',
  },
  {
    id: 'BOE-A-1882-6036',
    title: 'Real decreto de 14 de septiembre de 1882 por el que se aprueba la Ley de Enjuiciamiento Criminal',
    shortName: 'LECrim',
    status: 'in_force',
    issuedDate: '1882-09-14',
    inForceDate: '1882-09-17',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1882-6036',
    description: 'Criminal Procedure Act. Covers digital evidence, electronic surveillance, and investigative powers.',
  },
  {
    id: 'BOE-A-2022-10757',
    title: 'Ley 11/2022, de 28 de junio, General de Telecomunicaciones',
    shortName: 'LGTel',
    status: 'in_force',
    issuedDate: '2022-06-28',
    inForceDate: '2022-06-30',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-10757',
    description: 'General Telecommunications Act. Transposes EU Electronic Communications Code. Network security and incident reporting.',
  },
  {
    id: 'BOE-A-2020-14046',
    title: 'Ley 6/2020, de 11 de noviembre, reguladora de determinados aspectos de los servicios electrónicos de confianza',
    shortName: 'Ley eIDAS',
    status: 'in_force',
    issuedDate: '2020-11-11',
    inForceDate: '2020-11-13',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2020-14046',
    description: 'Electronic trust services law implementing eIDAS Regulation. Electronic signatures, seals, timestamps, and certificates.',
  },
  {
    id: 'BOE-A-2007-18243',
    title: 'Ley 25/2007, de 18 de octubre, de conservación de datos relativos a las comunicaciones electrónicas y a las redes públicas de comunicaciones',
    shortName: 'LCD',
    status: 'in_force',
    issuedDate: '2007-10-18',
    inForceDate: '2007-10-20',
    url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-18243',
    description: 'Communications data retention law. Obligations for telecom operators to retain metadata for law enforcement purposes.',
  },
];
