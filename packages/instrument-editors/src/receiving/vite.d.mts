/** The minimal Vite hook shape keeps the source adapter usable by the existing
 * Vite5 and Vite6 receivers without importing a second Vite type runtime. */
export interface InstrumentEditorBundlerOptions { reactRoot?: string }
export interface InstrumentEditorBundlerPlugin {
  name: string;
  enforce: 'pre';
  config(config: {
    root?: string;
    resolve?: {alias?: Record<string, string> | readonly {find: string | RegExp; replacement: string}[]};
  }): {
    resolve: {alias: {find: string | RegExp; replacement: string}[]; dedupe: string[]};
  };
}
export declare function instrumentEditorBundler(options?: InstrumentEditorBundlerOptions): InstrumentEditorBundlerPlugin;
