import core from '../../../data/core.json'

export type Rng = () => number

export type Degree = 'triumph' | 'strong' | 'success' | 'cost' | 'failure' | 'fumble'

export interface TestInput {
  attribute: number
  skill: number
  dc: number
  boons: number
  banes: number
}

export interface TestResult {
  natural: number
  /** Net modifier die: positive = Boon, negative = Bane, null = none. */
  modDie: { sides: number; roll: number; sign: 1 | -1 } | null
  total: number
  dc: number
  margin: number
  degree: Degree
  momentumGained: number
}

export const MAX_STEPS = core.boonDice.length

/** Roll one die with `sides` faces using an injectable RNG returning [0, 1). */
export function roll(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1
}

/**
 * Boons and Banes cancel one-for-one; the net count picks the die
 * (1 → d4, 2 → d6, 3+ → d8). Returns signed die size, or 0 for none.
 */
export function netModifierDie(boons: number, banes: number): number {
  const net = boons - banes
  if (net === 0) return 0
  const steps = Math.min(Math.abs(net), MAX_STEPS)
  return Math.sign(net) * core.boonDice[steps - 1]
}

/** Degree of result from rules §2.1. Natural 20/1 override the total. */
export function degreeOf(natural: number, total: number, dc: number): Degree {
  if (natural === 20) return 'triumph'
  if (natural === 1) return 'fumble'
  const margin = total - dc
  if (margin >= core.degrees.strongMargin) return 'strong'
  if (margin >= 0) return 'success'
  if (margin >= -core.degrees.costMissMax) return 'cost'
  return 'failure'
}

export function momentumFor(degree: Degree): number {
  return degree === 'triumph' || degree === 'strong' ? 1 : 0
}

/** Party Momentum after a scene ends (rules §6.7, v0.2: the pool empties to 0). */
export function endScene(momentum: number): number {
  return core.momentum.resetsAtSceneEnd ? 0 : Math.max(0, momentum - 1)
}

export function rollTest(input: TestInput, rng: Rng = Math.random): TestResult {
  const natural = roll(20, rng)
  const signed = netModifierDie(input.boons, input.banes)
  const modDie = signed === 0
    ? null
    : { sides: Math.abs(signed), roll: roll(Math.abs(signed), rng), sign: (signed > 0 ? 1 : -1) as 1 | -1 }
  const total = natural + input.attribute + input.skill + (modDie ? modDie.sign * modDie.roll : 0)
  const degree = degreeOf(natural, total, input.dc)
  return { natural, modDie, total, dc: input.dc, margin: total - input.dc, degree, momentumGained: momentumFor(degree) }
}

export const DEGREE_LABEL: Record<Degree, string> = {
  triumph: 'Triumph!',
  strong: 'Strong success',
  success: 'Success',
  cost: 'Success at a cost',
  failure: 'Failure',
  fumble: 'Fumble',
}

export const DEGREE_HINT: Record<Degree, string> = {
  triumph: 'Strong success plus something extra. +1 Momentum.',
  strong: 'You succeed and gain 1 Momentum.',
  success: 'You do it.',
  cost: 'You succeed, but the GM adds a Complication (or gains 1 Dread).',
  failure: "It doesn't work, and the situation changes.",
  fumble: 'Failure plus a Complication.',
}
