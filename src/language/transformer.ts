import * as Logger from 'src/utils/logger'

export function flattenKeys(object: object, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(object)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value, fullKey))
    } else {
      result[fullKey] = value
    }
  }
  return result
}

export function expandDotNotationKeys(
  target: Record<string, unknown>,
  source: object,
  depth = 0,
): unknown {
  if (depth > 32) Logger.fail('Max object expansion depth exceeded.')
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return source
  }

  for (const [key, value] of Object.entries(source)) {
    let current = target
    const parts = key.split('.')
    const lastKey = parts.pop() as string

    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    if (lastKey in current) {
      console.warn(`Warning: Overwriting key "${lastKey}" during transformation.`)
    }

    current[lastKey] = expandDotNotationKeys({}, value, depth + 1)
  }

  return target
}

export function transform(dataMap: Map<string, unknown>): object {
  const mergedData: Record<string, unknown> = {}
  for (const data of dataMap.values()) {
    expandDotNotationKeys(mergedData, data as object)
  }

  return mergedData
}
