/*
Purpose: Provide simple structured logging for the Electron main process during MVP development.
Out of scope: Persisted logs, remote telemetry, and log rotation.
*/
export interface DevLogger {
  debug(scope: string, message: string, meta?: Record<string, unknown>): void;
  error(scope: string, message: string, meta?: Record<string, unknown>): void;
  info(scope: string, message: string, meta?: Record<string, unknown>): void;
}

function write(level: string, scope: string, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";

  console.log(`[${timestamp}] [${level}] [${scope}] ${message}${suffix}`);
}

export function createDevLogger(): DevLogger {
  return {
    debug(scope, message, meta) {
      write("debug", scope, message, meta);
    },
    error(scope, message, meta) {
      write("error", scope, message, meta);
    },
    info(scope, message, meta) {
      write("info", scope, message, meta);
    }
  };
}
