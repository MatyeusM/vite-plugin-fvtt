type LogLevel = 'info' | 'warn' | 'error'

class Logger {
  private static namespace: string = 'vite-plugin-fvtt'

  private static colors: Record<LogLevel, string> = {
    info: '\x1b[36m', // cyan
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
  }
  private static reset = '\x1b[0m'

  initialize(namespace = 'vite-plugin-fvtt') {
    Logger.namespace = namespace
  }

  private static format(level: LogLevel, message: unknown): string {
    const color = Logger.colors[level] ?? ''
    return `${color}[${Logger.namespace}] [${level.toUpperCase()}]${Logger.reset} ${message}`
  }

  static info(message: unknown): void {
    console.log(Logger.format('info', message))
  }

  static warn(message: unknown): void {
    console.warn(Logger.format('warn', message))
  }

  static error(message: unknown): void {
    console.error(Logger.format('error', message))
  }

  static fail(message: unknown): never {
    const formatted = Logger.format('error', Logger.stringify(message))
    console.error(formatted)
    throw new Error(formatted)
  }

  private static stringify(message: unknown): string {
    if (message instanceof Error) return message.stack ?? message.message
    return typeof message === 'string' ? message : JSON.stringify(message, null, 2)
  }
}

export default Logger
