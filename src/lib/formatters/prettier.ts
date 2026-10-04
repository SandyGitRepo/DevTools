/**
 * Lazy Prettier loader: each parser's plugin is fetched only when first needed (NFR-1).
 * Uses prettier/standalone, which runs entirely in the browser.
 */
import type { Plugin, Options } from 'prettier';

export type PrettierParser = 'babel' | 'typescript' | 'html' | 'css' | 'scss' | 'less' | 'yaml' | 'markdown' | 'graphql' | 'java';

const asPlugins = (mods: unknown[]) => mods as Plugin[];

async function pluginsFor(parser: PrettierParser): Promise<Plugin[]> {
  switch (parser) {
    case 'babel':
      return asPlugins(await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]));
    case 'typescript':
      return asPlugins(await Promise.all([import('prettier/plugins/typescript'), import('prettier/plugins/estree')]));
    case 'html':
      // HTML may embed <script> and <style>
      return asPlugins(
        await Promise.all([
          import('prettier/plugins/html'),
          import('prettier/plugins/postcss'),
          import('prettier/plugins/babel'),
          import('prettier/plugins/estree'),
        ]),
      );
    case 'css':
    case 'scss':
    case 'less':
      return asPlugins([await import('prettier/plugins/postcss')]);
    case 'yaml':
      return asPlugins([await import('prettier/plugins/yaml')]);
    case 'markdown':
      return asPlugins([await import('prettier/plugins/markdown')]);
    case 'graphql':
      return asPlugins([await import('prettier/plugins/graphql')]);
    case 'java':
      return [await loadJavaPlugin()];
  }
}

let javaPlugin: Promise<Plugin> | null = null;

/**
 * prettier-plugin-java parses with tree-sitter (WebAssembly). We initialise web-tree-sitter with
 * the bundled .wasm URL before the plugin module evaluates, so nothing is fetched from elsewhere.
 */
function loadJavaPlugin(): Promise<Plugin> {
  javaPlugin ??= (async () => {
    const [{ Parser }, { default: wasmUrl }] = await Promise.all([import('web-tree-sitter'), import('web-tree-sitter/web-tree-sitter.wasm?url')]);
    await Parser.init({ locateFile: () => wasmUrl });
    const mod = (await import('prettier-plugin-java')) as unknown as { default?: Plugin } & Plugin;
    return mod.default ?? mod;
  })();
  javaPlugin.catch(() => (javaPlugin = null));
  return javaPlugin;
}

export async function prettierFormat(code: string, parser: PrettierParser, options: Options = {}): Promise<string> {
  const [{ format }, plugins] = await Promise.all([import('prettier/standalone'), pluginsFor(parser)]);
  return format(code, { parser, plugins, ...options });
}
