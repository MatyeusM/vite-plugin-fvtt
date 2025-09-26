declare module '@foundryvtt/foundryvtt-cli' {
  export interface CompilePackOptions {
    nedb?: boolean
    yaml?: boolean
    log?: boolean
    recursive?: boolean
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    transformEntry?: (entry: Record<string, unknown>) => Promise<false | void>
  }

  export function compilePack(
    source: string,
    destination: string,
    options?: CompilePackOptions,
  ): Promise<void>
}
