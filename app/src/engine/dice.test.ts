import { describe, expect, it } from 'vitest'
import { degreeOf, momentumFor, netModifierDie, roll, rollTest, type Rng } from './dice'

/** RNG that makes roll(sides) return the given faces in order. */
function faces(...values: Array<[face: number, sides: number]>): Rng {
  const queue = values.map(([face, sides]) => (face - 1) / sides + 1e-9)
  return () => {
    const v = queue.shift()
    if (v === undefined) throw new Error('RNG exhausted')
    return v
  }
}

describe('roll', () => {
  it('stays within 1..sides', () => {
    expect(roll(20, () => 0)).toBe(1)
    expect(roll(20, () => 0.999999)).toBe(20)
  })
})

describe('netModifierDie (Boons/Banes, rules §2.2)', () => {
  it.each([
    [0, 0, 0], [1, 0, 4], [2, 0, 6], [3, 0, 8], [5, 0, 8],
    [0, 1, -4], [0, 2, -6], [0, 4, -8],
    [2, 1, 4], [1, 1, 0], [1, 3, -6],
  ])('%i boons, %i banes → %i', (boons, banes, expected) => {
    expect(netModifierDie(boons, banes)).toBe(expected)
  })
})

describe('degreeOf (rules §2.1)', () => {
  const dc = 12
  it.each([
    [10, 17, 'strong'],   // beat by 5
    [10, 16, 'success'],  // beat by 4
    [10, 12, 'success'],  // meet
    [10, 11, 'cost'],     // miss by 1
    [10, 9, 'cost'],      // miss by 3
    [10, 8, 'failure'],   // miss by 4
  ] as const)('natural %i, total %i → %s', (nat, total, expected) => {
    expect(degreeOf(nat, total, dc)).toBe(expected)
  })

  it('natural 20 is a Triumph even if the total misses', () => {
    expect(degreeOf(20, 5, 24)).toBe('triumph')
  })

  it('natural 1 is a Fumble even if the total beats the DC', () => {
    expect(degreeOf(1, 30, 8)).toBe('fumble')
  })
})

describe('momentumFor', () => {
  it('awards 1 Momentum only on strong success or Triumph', () => {
    expect(momentumFor('triumph')).toBe(1)
    expect(momentumFor('strong')).toBe(1)
    for (const d of ['success', 'cost', 'failure', 'fumble'] as const) expect(momentumFor(d)).toBe(0)
  })
})

describe('rollTest', () => {
  it('adds attribute + skill with no modifier die', () => {
    const r = rollTest({ attribute: 3, skill: 2, dc: 12, boons: 0, banes: 0 }, faces([10, 20]))
    expect(r).toMatchObject({ natural: 10, modDie: null, total: 15, margin: 3, degree: 'success', momentumGained: 0 })
  })

  it('adds a Boon die', () => {
    const r = rollTest({ attribute: 1, skill: 1, dc: 12, boons: 2, banes: 0 }, faces([11, 20], [6, 6]))
    expect(r.modDie).toEqual({ sides: 6, roll: 6, sign: 1 })
    expect(r.total).toBe(19)
    expect(r.degree).toBe('strong')
    expect(r.momentumGained).toBe(1)
  })

  it('subtracts a Bane die', () => {
    const r = rollTest({ attribute: 2, skill: 0, dc: 12, boons: 0, banes: 1 }, faces([12, 20], [3, 4]))
    expect(r.modDie).toEqual({ sides: 4, roll: 3, sign: -1 })
    expect(r.total).toBe(11)
    expect(r.degree).toBe('cost')
  })
})
