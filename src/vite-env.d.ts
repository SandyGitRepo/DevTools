/// <reference types="vite/client" />
declare const __APP_VERSION__: string;

interface Window {
  MonacoEnvironment?: { getWorker(id: string, label: string): Worker };
}
// eslint-disable-next-line no-var
declare var MonacoEnvironment: Window['MonacoEnvironment'];
