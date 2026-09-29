import { afterEach, describe, expect, it } from 'vitest'
import { _setLangState } from '../lib/i18n-core.js'
import { ft, count, ruForm, _RU_FOR_TESTS as RU } from './strings.js'

afterEach(() => _setLangState('en', {}, null, null))

describe('fork strings', () => {
  it('are English by default and Russian in Russian, placeholders filled either way', () => {
    expect(ft('Last backup: {0}', 'today')).toBe('Last backup: today')
    _setLangState('ru', {}, null, null)
    expect(ft('Last backup: {0}', 'сегодня')).toBe('Последний бэкап: сегодня')
    expect(ft('not in the table')).toBe('not in the table')
  })

  it('keep every placeholder of the English key in the Russian text', () => {
    for (const [en, ru] of Object.entries(RU)) {
      const ph = s => (s.match(/\{\d\}/g) || []).sort().join()
      expect(ph(ru), en).toBe(ph(en))
    }
  })

  it('pick the Russian plural form', () => {
    expect([1, 2, 5, 11, 12, 14, 21, 22, 25, 101, 111, 0].map(ruForm)).toEqual([0, 1, 2, 2, 2, 2, 0, 1, 2, 0, 2, 2])
    _setLangState('ru', {}, null, null)
    expect(count(1, 'workout')).toBe('1 тренировка')
    expect(count(3, 'workout')).toBe('3 тренировки')
    expect(count(214, 'workout')).toBe('214 тренировок')
    expect(count(12, 'day')).toBe('12 дней')
  })

  it('and the English one', () => {
    expect(count(1, 'workout')).toBe('1 workout')
    expect(count(2, 'routine')).toBe('2 routines')
  })
})
