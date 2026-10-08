import { describe, expect, it, vi, afterEach } from 'vitest'

import { expandDotNotationKeys } from '../src/language/transformer'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('expandDotNotationKeys', () => {
  it('expands dotted keys into nested objects', () => {
    expect(expandDotNotationKeys({}, { 'a.b': 1, c: 2 })).toEqual({ a: { b: 1 }, c: 2 })
  })

  it('skips __proto__ keys with a warning instead of corrupting the output', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const target = expandDotNotationKeys({}, { '__proto__.x': 1, 'a.b': 2 }) as Record<
      string,
      unknown
    >

    expect(target).toEqual({ a: { b: 2 } })
    expect(warn).toHaveBeenCalledOnce()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
