/** FR-D4: JSON sample → Java POJO / TypeScript interface / C# class, using quicktype-core (Apache-2.0). */
export type CodeLang = 'typescript' | 'java' | 'csharp';

export interface CodegenOptions {
  lang: CodeLang;
  topLevel: string;
  /** Java package or C# namespace. */
  namespace: string;
  /** Java only: use Lombok @Data instead of getters/setters. */
  lombok: boolean;
  /** TypeScript only: emit `type` aliases? No — interfaces, optionally with runtime converters off. */
  justTypes: boolean;
}

export async function generateCode(json: string, o: CodegenOptions): Promise<string> {
  // Validate first so the user gets a positioned JSON error rather than a quicktype stack
  const { parseJson } = await import('../formatters/jsonError');
  parseJson(json);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(o.topLevel)) throw new Error('The class name must be a valid identifier (letters, digits, underscore)');
  const { quicktype, InputData, jsonInputForTargetLanguage } = await import('quicktype-core');
  const input = jsonInputForTargetLanguage(o.lang);
  await input.addSource({ name: o.topLevel, samples: [json] });
  const data = new InputData();
  data.addInput(input);
  const rendererOptions: Record<string, string> =
    o.lang === 'java'
      ? { package: o.namespace || 'com.example.model', 'just-types': String(o.justTypes), lombok: String(o.lombok), 'datetime-provider': 'java8' }
      : o.lang === 'csharp'
        ? {
            namespace: o.namespace || 'Example.Models',
            'just-types': String(o.justTypes),
            framework: 'SystemTextJson',
            'csharp-version': '6',
            'array-type': 'list',
          }
        : { 'just-types': String(o.justTypes), 'prefer-unions': 'true' };
  const result = await quicktype({ inputData: data, lang: o.lang, rendererOptions, inferDateTimes: true, inferUuids: true, inferIntegerStrings: false });
  return result.lines.join('\n').trim() + '\n';
}
