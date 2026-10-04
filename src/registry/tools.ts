import type { ComponentType } from 'react';
import { Braces, Binary, KeyRound, FileText, ArrowLeftRight, Wrench, Ruler, BookOpen, type LucideIcon } from 'lucide-react';

export type ModuleId = 'formatters' | 'encoding' | 'crypto' | 'pdf' | 'converters' | 'utilities' | 'units' | 'cheatsheets';

export interface ModuleMeta {
  id: ModuleId;
  name: string;
  section: string;
  icon: LucideIcon;
  blurb: string;
}

export interface ToolMeta {
  id: string;
  frId: string;
  name: string;
  module: ModuleId;
  description: string;
  keywords: string[];
  runsOn: 'browser' | 'server';
  /** Delivery phase from requirements section 9. */
  phase: number;
  /** Lazy component loader; absent while the tool is still planned. */
  load?: () => Promise<{ default: ComponentType }>;
}

export const modules: ModuleMeta[] = [
  { id: 'formatters', name: 'Formatters', section: '3.1', icon: Braces, blurb: 'Format, minify and validate code and data' },
  { id: 'encoding', name: 'Encoding', section: '3.2', icon: Binary, blurb: 'Encode, decode and inspect tokens and certificates' },
  { id: 'crypto', name: 'Crypto & Keys', section: '3.3', icon: KeyRound, blurb: 'Hashes, HMAC, encryption and key generation' },
  { id: 'pdf', name: 'PDF Tools', section: '3.4', icon: FileText, blurb: 'Merge, split, reorder, watermark and protect PDFs' },
  { id: 'converters', name: 'Converters', section: '3.5', icon: ArrowLeftRight, blurb: 'CSV, JSON, YAML, XML, Excel and code generation' },
  { id: 'utilities', name: 'Dev Utilities', section: '3.6', icon: Wrench, blurb: 'Regex, timestamps, cron, QR, masking and more' },
  { id: 'units', name: 'Unit Converters', section: '3.7', icon: Ruler, blurb: 'Length, height, area and Indian land units' },
  { id: 'cheatsheets', name: 'Cheat Sheets', section: '3.8', icon: BookOpen, blurb: 'Offline quick-reference library' },
];

const t = (meta: Omit<ToolMeta, 'runsOn' | 'phase'> & Partial<Pick<ToolMeta, 'runsOn' | 'phase'>>): ToolMeta => ({
  runsOn: 'browser',
  phase: 1,
  ...meta,
});

export const tools: ToolMeta[] = [
  // 3.1 Formatters and validators
  t({
    id: 'json',
    frId: 'FR-F1',
    name: 'JSON Formatter',
    module: 'formatters',
    description: 'Format, minify, validate, sort keys, tree view, JSONPath and JSON Schema.',
    keywords: ['json', 'beautify', 'validate', 'jsonpath', 'schema', 'pretty'],
    load: () => import('../tools/formatters/JsonTool'),
  }),
  t({
    id: 'sql',
    frId: 'FR-F2',
    name: 'SQL Formatter',
    module: 'formatters',
    description: 'Format or minify SQL for Oracle, MySQL, PostgreSQL, T-SQL and MariaDB.',
    keywords: ['sql', 'oracle', 'plsql', 'postgres', 'mysql', 'tsql'],
    load: () => import('../tools/formatters/SqlTool'),
  }),
  t({
    id: 'java',
    frId: 'FR-F3',
    name: 'Java Formatter',
    module: 'formatters',
    description: 'Format Java source and report syntax errors.',
    keywords: ['java', 'beautify'],
    load: () => import('../tools/formatters/JavaTool'),
  }),
  t({
    id: 'javascript',
    frId: 'FR-F4',
    name: 'JavaScript / TypeScript',
    module: 'formatters',
    description: 'Format with Prettier or minify with Terser.',
    keywords: ['js', 'ts', 'typescript', 'javascript', 'minify', 'prettier', 'terser'],
    load: () => import('../tools/formatters/JsTool'),
  }),
  t({
    id: 'html-css',
    frId: 'FR-F5',
    name: 'HTML / CSS / SCSS',
    module: 'formatters',
    description: 'Format and minify markup and stylesheets.',
    keywords: ['html', 'css', 'scss', 'less', 'minify'],
    load: () => import('../tools/formatters/HtmlCssTool'),
  }),
  t({
    id: 'xml',
    frId: 'FR-F6',
    name: 'XML / SOAP',
    module: 'formatters',
    description: 'Format, minify, check well-formedness and run XPath queries.',
    keywords: ['xml', 'soap', 'xpath', 'wsdl'],
    load: () => import('../tools/formatters/XmlTool'),
  }),
  t({
    id: 'yaml-md',
    frId: 'FR-F7',
    name: 'YAML / Markdown / GraphQL',
    module: 'formatters',
    description: 'Format and validate, with live Markdown preview.',
    keywords: ['yaml', 'yml', 'markdown', 'md', 'graphql', 'gql'],
    load: () => import('../tools/formatters/YamlMdTool'),
  }),
  t({
    id: 'diff',
    frId: 'FR-F8',
    name: 'Text Diff',
    module: 'formatters',
    description: 'Side-by-side or inline diff of text, or semantic JSON diff.',
    keywords: ['diff', 'compare', 'json diff'],
    load: () => import('../tools/formatters/DiffTool'),
  }),

  // 3.2 Encoding and decoding
  t({
    id: 'base64',
    frId: 'FR-E1',
    name: 'Base64',
    module: 'encoding',
    description: 'Text and files to and from Base64, URL-safe variant, image preview.',
    keywords: ['base64', 'b64', 'encode', 'decode'],
    load: () => import('../tools/encoding/Base64Tool'),
  }),
  t({
    id: 'url',
    frId: 'FR-E2',
    name: 'URL Encode / Decode',
    module: 'encoding',
    description: 'Component and full-URL modes, with a query parameter table.',
    keywords: ['url', 'uri', 'percent', 'query'],
    load: () => import('../tools/encoding/UrlTool'),
  }),
  t({
    id: 'html-entities',
    frId: 'FR-E3',
    name: 'HTML Entities',
    module: 'encoding',
    description: 'Encode and decode named and numeric HTML entities.',
    keywords: ['html', 'entity', 'escape'],
    load: () => import('../tools/encoding/HtmlEntitiesTool'),
  }),
  t({
    id: 'base-n',
    frId: 'FR-E4',
    name: 'Hex / Binary / Base32 / Base58',
    module: 'encoding',
    description: 'Convert text to and from hex, binary, Base32 and Base58.',
    keywords: ['hex', 'binary', 'base32', 'base58'],
    load: () => import('../tools/encoding/BaseNTool'),
  }),
  t({
    id: 'unicode',
    frId: 'FR-E5',
    name: 'Unicode Escape',
    module: 'encoding',
    description: '\\uXXXX escape and unescape, with a code point inspector.',
    keywords: ['unicode', 'utf8', 'utf-8', 'escape', 'codepoint'],
    load: () => import('../tools/encoding/UnicodeTool'),
  }),
  t({
    id: 'jwt',
    frId: 'FR-E6',
    name: 'JWT Decoder',
    module: 'encoding',
    description: 'Decode header and payload, show expiry in IST, verify signatures.',
    keywords: ['jwt', 'token', 'jws', 'bearer'],
    load: () => import('../tools/encoding/JwtTool'),
  }),
  t({
    id: 'cert',
    frId: 'FR-E7',
    name: 'Certificate / PEM Decoder',
    module: 'encoding',
    description: 'Inspect X.509 certificates and CSRs: subject, SAN, validity, fingerprints.',
    keywords: ['x509', 'pem', 'certificate', 'csr', 'ssl', 'tls'],
    load: () => import('../tools/encoding/CertTool'),
  }),
  t({
    id: 'gzip',
    frId: 'FR-E8',
    name: 'Gzip / Deflate',
    module: 'encoding',
    description: 'Compress and decompress text and Base64 payloads.',
    keywords: ['gzip', 'deflate', 'zlib', 'compress'],
    load: () => import('../tools/encoding/GzipTool'),
  }),

  // 3.3 Hashing, encryption and keys
  t({
    id: 'hash',
    frId: 'FR-K1',
    name: 'Hash Generator',
    module: 'crypto',
    description: 'MD5, SHA-1/2/3 and CRC32 for text and files; compare to an expected hash.',
    keywords: ['hash', 'md5', 'sha', 'sha256', 'crc32', 'checksum'],
    load: () => import('../tools/crypto/HashTool'),
  }),
  t({
    id: 'hmac',
    frId: 'FR-K2',
    name: 'HMAC',
    module: 'crypto',
    description: 'HMAC-SHA256/384/512 with text, hex or Base64 keys.',
    keywords: ['hmac', 'signature', 'mac'],
    load: () => import('../tools/crypto/HmacTool'),
  }),
  t({
    id: 'password-hash',
    frId: 'FR-K3',
    name: 'Password Hashing',
    module: 'crypto',
    description: 'Generate and verify bcrypt, Argon2id and PBKDF2 hashes.',
    keywords: ['bcrypt', 'argon2', 'pbkdf2', 'password'],
    load: () => import('../tools/crypto/PasswordHashTool'),
  }),
  t({
    id: 'aes',
    frId: 'FR-K4',
    name: 'Symmetric Encryption',
    module: 'crypto',
    description: 'AES-GCM, AES-CBC and AES-CTR with passphrase or raw key.',
    keywords: ['aes', 'encrypt', 'decrypt', 'gcm', 'cbc'],
    load: () => import('../tools/crypto/AesTool'),
  }),
  t({
    id: 'rsa',
    frId: 'FR-K5',
    name: 'Asymmetric Crypto',
    module: 'crypto',
    description: 'RSA-OAEP encrypt/decrypt, RSA-PSS and ECDSA sign/verify.',
    keywords: ['rsa', 'ecdsa', 'sign', 'verify', 'oaep', 'pss'],
    load: () => import('../tools/crypto/RsaTool'),
  }),
  t({
    id: 'keygen',
    frId: 'FR-K6',
    name: 'Key & Secret Generator',
    module: 'crypto',
    description: 'RSA/EC key pairs, random secrets, passwords and UUID v4/v7.',
    keywords: ['key', 'uuid', 'password', 'secret', 'generate', 'jwk'],
    load: () => import('../tools/crypto/KeygenTool'),
  }),
  t({
    id: 'file-encrypt',
    frId: 'FR-K7',
    name: 'File Encryption',
    module: 'crypto',
    description: 'Encrypt or decrypt any file with a password (AES-256-GCM).',
    keywords: ['file', 'encrypt', 'decrypt', 'enc'],
    load: () => import('../tools/crypto/FileEncryptTool'),
  }),

  // 3.4 PDF tools (Phase 2)
  t({
    id: 'pdf-merge',
    frId: 'FR-P1',
    name: 'Merge PDFs',
    module: 'pdf',
    phase: 2,
    description: 'Combine 2–50 PDFs and reorder before merging.',
    keywords: ['pdf', 'merge', 'combine'],
    load: () => import('../tools/pdf/MergeTool'),
  }),
  t({
    id: 'pdf-split',
    frId: 'FR-P2',
    name: 'Split PDF',
    module: 'pdf',
    phase: 2,
    description: 'Split by range, every N pages, or one file per page.',
    keywords: ['pdf', 'split'],
    load: () => import('../tools/pdf/SplitTool'),
  }),
  t({
    id: 'pdf-delete',
    frId: 'FR-P3',
    name: 'Delete Pages',
    module: 'pdf',
    phase: 2,
    description: 'Remove pages by thumbnail or range.',
    keywords: ['pdf', 'delete', 'remove'],
    load: () => import('../tools/pdf/DeleteTool'),
  }),
  t({
    id: 'pdf-insert',
    frId: 'FR-P4',
    name: 'Insert Pages',
    module: 'pdf',
    phase: 2,
    description: 'Insert blank pages, pages from another PDF, or images.',
    keywords: ['pdf', 'insert', 'add'],
    load: () => import('../tools/pdf/InsertTool'),
  }),
  t({
    id: 'pdf-reorder',
    frId: 'FR-P5',
    name: 'Reorder & Rotate',
    module: 'pdf',
    phase: 2,
    description: 'Drag to reorder; rotate per page or all pages.',
    keywords: ['pdf', 'reorder', 'rotate'],
    load: () => import('../tools/pdf/ReorderTool'),
  }),
  t({
    id: 'pdf-extract',
    frId: 'FR-P6',
    name: 'Extract Pages',
    module: 'pdf',
    phase: 2,
    description: 'Save selected pages as a new PDF.',
    keywords: ['pdf', 'extract'],
    load: () => import('../tools/pdf/ExtractTool'),
  }),
  t({
    id: 'pdf-image',
    frId: 'FR-P7',
    name: 'Image ↔ PDF',
    module: 'pdf',
    phase: 2,
    description: 'JPG/PNG to PDF, or PDF pages to PNG.',
    keywords: ['pdf', 'image', 'jpg', 'png'],
    load: () => import('../tools/pdf/ImagePdfTool'),
  }),
  t({
    id: 'pdf-watermark',
    frId: 'FR-P8',
    name: 'Watermark & Page Numbers',
    module: 'pdf',
    phase: 2,
    description: 'Text watermark and page numbering.',
    keywords: ['pdf', 'watermark', 'page numbers'],
    load: () => import('../tools/pdf/WatermarkTool'),
  }),
  t({
    id: 'pdf-metadata',
    frId: 'FR-P9',
    name: 'PDF Metadata',
    module: 'pdf',
    phase: 2,
    description: 'View and strip author, title and producer metadata.',
    keywords: ['pdf', 'metadata'],
    load: () => import('../tools/pdf/MetadataTool'),
  }),
  t({
    id: 'pdf-protect',
    frId: 'FR-P10',
    name: 'Protect / Unlock PDF',
    module: 'pdf',
    phase: 2,
    runsOn: 'server',
    description: 'Add or remove a PDF password.',
    keywords: ['pdf', 'password', 'protect', 'unlock', 'encrypt'],
    load: () => import('../tools/pdf/ProtectTool'),
  }),
  t({
    id: 'pdf-compress',
    frId: 'FR-P11',
    name: 'Compress PDF',
    module: 'pdf',
    phase: 2,
    runsOn: 'server',
    description: 'Structural compression and image downsampling.',
    keywords: ['pdf', 'compress', 'shrink'],
    load: () => import('../tools/pdf/CompressTool'),
  }),

  // 3.5 Data converters (Phase 2)
  t({
    id: 'csv-json',
    frId: 'FR-D1',
    name: 'CSV ↔ JSON',
    module: 'converters',
    phase: 2,
    description: 'Convert with delimiter and header options.',
    keywords: ['csv', 'json'],
    load: () => import('../tools/converters/CsvJsonTool'),
  }),
  t({
    id: 'json-yaml-xml',
    frId: 'FR-D2',
    name: 'JSON ↔ YAML ↔ XML',
    module: 'converters',
    phase: 2,
    description: 'Round-trip conversion between formats.',
    keywords: ['json', 'yaml', 'xml', 'convert'],
    load: () => import('../tools/converters/FormatConvertTool'),
  }),
  t({
    id: 'excel',
    frId: 'FR-D3',
    name: 'Excel → CSV / JSON',
    module: 'converters',
    phase: 2,
    description: 'Pick a sheet and export.',
    keywords: ['excel', 'xlsx', 'csv'],
    load: () => import('../tools/converters/ExcelTool'),
  }),
  t({
    id: 'json-code',
    frId: 'FR-D4',
    name: 'JSON → Code Classes',
    module: 'converters',
    phase: 2,
    description: 'Generate Java, TypeScript or C# types from JSON.',
    keywords: ['pojo', 'interface', 'class', 'quicktype'],
    load: () => import('../tools/converters/CodegenTool'),
  }),
  t({
    id: 'sql-insert',
    frId: 'FR-D5',
    name: 'SQL INSERT Generator',
    module: 'converters',
    phase: 2,
    description: 'CSV or JSON to INSERT statements.',
    keywords: ['sql', 'insert', 'csv'],
    load: () => import('../tools/converters/SqlInsertTool'),
  }),

  // 3.6 Developer utilities (Phase 3)
  t({
    id: 'regex',
    frId: 'FR-U1',
    name: 'Regex Tester',
    module: 'utilities',
    phase: 3,
    description: 'Live matching, groups and replace, with a ReDoS guard.',
    keywords: ['regex', 'regexp', 'pattern'],
    load: () => import('../tools/utilities/RegexTool'),
  }),
  t({
    id: 'timestamp',
    frId: 'FR-U2',
    name: 'Timestamp Converter',
    module: 'utilities',
    phase: 3,
    description: 'Epoch to date in IST, UTC or any zone.',
    keywords: ['epoch', 'unix', 'time', 'date'],
    load: () => import('../tools/utilities/TimestampTool'),
  }),
  t({
    id: 'cron',
    frId: 'FR-U3',
    name: 'Cron Explainer',
    module: 'utilities',
    phase: 3,
    description: 'Human-readable cron and the next 10 runs.',
    keywords: ['cron', 'schedule', 'quartz'],
    load: () => import('../tools/utilities/CronTool'),
  }),
  t({
    id: 'text-tools',
    frId: 'FR-U4',
    name: 'Case & Text Tools',
    module: 'utilities',
    phase: 3,
    description: 'Change case, trim, dedupe, sort and count.',
    keywords: ['case', 'camel', 'snake', 'text'],
    load: () => import('../tools/utilities/TextTools'),
  }),
  t({
    id: 'number-base',
    frId: 'FR-U5',
    name: 'Number Base',
    module: 'utilities',
    phase: 3,
    description: 'Decimal, hex, octal, binary and byte sizes.',
    keywords: ['hex', 'decimal', 'binary', 'octal'],
    load: () => import('../tools/utilities/NumberBaseTool'),
  }),
  t({
    id: 'qr',
    frId: 'FR-U6',
    name: 'QR Code',
    module: 'utilities',
    phase: 3,
    description: 'Generate or read QR codes.',
    keywords: ['qr', 'barcode'],
    load: () => import('../tools/utilities/QrTool'),
  }),
  t({
    id: 'colour',
    frId: 'FR-U7',
    name: 'Colour Converter',
    module: 'utilities',
    phase: 3,
    description: 'HEX/RGB/HSL with contrast checker.',
    keywords: ['color', 'colour', 'hex', 'rgb', 'contrast'],
    load: () => import('../tools/utilities/ColourTool'),
  }),
  t({
    id: 'masker',
    frId: 'FR-U8',
    name: 'Data Masker',
    module: 'utilities',
    phase: 3,
    description: 'Mask PAN, Aadhaar, mobile, email and account numbers.',
    keywords: ['mask', 'pii', 'aadhaar', 'pan', 'redact'],
    load: () => import('../tools/utilities/MaskerTool'),
  }),
  t({
    id: 'test-data',
    frId: 'FR-U9',
    name: 'Test Data Generator',
    module: 'utilities',
    phase: 3,
    description: 'Fake Indian names, addresses and PAN-format strings.',
    keywords: ['fake', 'lorem', 'test data', 'faker'],
    load: () => import('../tools/utilities/TestDataTool'),
  }),

  // 3.7 Unit converters (Phase 3)
  t({
    id: 'length',
    frId: 'FR-M1',
    name: 'Length',
    module: 'units',
    phase: 3,
    description: 'Feet/inches, cm, m, mm, yards; accepts 5\' 8".',
    keywords: ['length', 'feet', 'cm', 'inch'],
    load: () => import('../tools/units/LengthTool'),
  }),
  t({
    id: 'height',
    frId: 'FR-M2',
    name: 'Height Quick View',
    module: 'units',
    phase: 3,
    description: 'Feet/inches ↔ cm with reference table.',
    keywords: ['height', 'feet', 'cm'],
    load: () => import('../tools/units/HeightTool'),
  }),
  t({
    id: 'area',
    frId: 'FR-M3',
    name: 'Area & Land Units',
    module: 'units',
    phase: 3,
    description: 'sq ft, sq m, acre, hectare, guntha, cent, bigha.',
    keywords: ['area', 'land', 'bigha', 'guntha', 'acre'],
    load: () => import('../tools/units/AreaTool'),
  }),
  t({
    id: 'carpet-area',
    frId: 'FR-M4',
    name: 'Carpet / Built-up Area',
    module: 'units',
    phase: 3,
    description: 'Estimate carpet, built-up and super built-up area.',
    keywords: ['carpet', 'built-up', 'loading'],
    load: () => import('../tools/units/CarpetAreaTool'),
  }),
  t({
    id: 'other-units',
    frId: 'FR-M5',
    name: 'Other Units',
    module: 'units',
    phase: 3,
    description: 'Weight, temperature, data size and volume.',
    keywords: ['weight', 'temperature', 'kg', 'lb'],
    load: () => import('../tools/units/OtherUnitsTool'),
  }),

  // 3.8 Cheat sheets (Phase 3)
  t({
    id: 'cheatsheets',
    frId: 'FR-H1',
    name: 'Cheat Sheet Library',
    module: 'cheatsheets',
    phase: 3,
    description: 'Searchable offline quick-reference sheets.',
    keywords: ['cheat sheet', 'reference', 'python', 'git', 'docker'],
    load: () => import('../tools/cheatsheets/CheatSheetTool'),
  }),
];

export const toolById = (id: string | undefined) => tools.find((x) => x.id === id);
export const moduleById = (id: string | undefined) => modules.find((m) => m.id === id);
export const toolsInModule = (id: ModuleId) => tools.filter((x) => x.module === id);

/** Simple ranked search across name, keywords, description and FR-ID. */
export function searchTools(query: string): ToolMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return tools;
  const terms = q.split(/\s+/);
  return tools
    .map((tool) => {
      const name = tool.name.toLowerCase();
      const hay = [name, tool.keywords.join(' '), tool.description.toLowerCase(), tool.frId.toLowerCase(), tool.module].join(' ');
      if (!terms.every((term) => hay.includes(term))) return { tool, score: -1 };
      let score = 0;
      if (name.startsWith(q)) score += 10;
      if (name.includes(q)) score += 5;
      if (tool.keywords.some((k) => k === q)) score += 8;
      if (tool.load) score += 1;
      return { tool, score };
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.tool);
}
