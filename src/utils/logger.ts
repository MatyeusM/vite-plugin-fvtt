type LogLevel = 'info' | 'warn' | 'error'

interface LoggerOptions {
  namespace?: string
}

class Logger {
  private namespace: string

  private colors: Record<LogLevel, string> = {
    info: '\x1b[32m', // green
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
  }

  constructor({ namespace = 'vite-plugin-fvtt' }: LoggerOptions = {}) {
    this.namespace = namespace
  }

  private format(level: LogLevel, message: unknown): string {
    const color = this.colors[level] ?? ''
    const reset = '\x1b[0m'
    return `${color}[${this.namespace}] [${level.toUpperCase()}]${reset} ${message}`
  }

  info(message: unknown): void {
    console.log(this.format('info', message))
  }

  warn(message: unknown): void {
    console.warn(this.format('warn', message))
  }

  error(message: unknown): void {
    console.error(this.format('error', message))
  }

  fail(message: unknown): never {
    this.error(message)
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message, null, 2))
  }
}

// Default shared instance
export default new Logger()
