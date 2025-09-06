declare module '@foundryvtt/foundryvtt-cli' {
  export interface CompilePackOptions {
    nedb?: boolean
    yaml?: boolean
    log?: boolean
    recursive?: boolean
    transformEntry?: (entry: Record<string, unknown>) => Promise<false | void>
  }

  export function compilePack(
    src: string,
    dest: string,
    options?: CompilePackOptions,
  ): Promise<void>
}
