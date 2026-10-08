/** Dotted-key helpers for the JSON language files both HMR swaps share. */
export function languageValue(source: string, key: string): string {
  const json = JSON.parse(source) as Record<string, unknown>
  return String(readKey(json, key) ?? '')
}

export function languageWith(source: string, key: string, value: string): string {
  const json = JSON.parse(source) as Record<string, unknown>
  const parts = key.split('.')
  const last = parts.pop() as string
  let node = json
  for (const part of parts) node = (node[part] ?? {}) as Record<string, unknown>
  node[last] = value
  return JSON.stringify(json, undefined, 4)
}

function readKey(node: unknown, key: string): unknown {
  for (const part of key.split('.')) node = (node as Record<string, unknown>)?.[part]
  return node
}
