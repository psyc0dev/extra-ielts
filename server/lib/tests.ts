import type { TestDetail } from './types'
// Tests are bundled at build time — import all JSON files from data/tests
// Add new test imports here as needed
import quickPractice from '../data/tests/quick-practice.json'

const raw: unknown[] = [quickPractice]

const normalizeTest = (r: unknown): TestDetail => {
  const t = r as TestDetail
  return { ...t, published: t.published ?? false, sections: t.sections ?? [] }
}

const flatten = (items: unknown[]): TestDetail[] => {
  const out: TestDetail[] = []
  for (const item of items) {
    if (Array.isArray(item)) { item.forEach((i) => out.push(normalizeTest(i))); continue }
    const obj = item as Record<string, unknown>
    if (Array.isArray(obj.tests)) { (obj.tests as unknown[]).forEach((i) => out.push(normalizeTest(i))); continue }
    if (obj.test) { out.push(normalizeTest(obj.test)); continue }
    out.push(normalizeTest(item))
  }
  return out
}

export const getTests = (publishedOverrides?: Map<string, boolean>): TestDetail[] =>
  flatten(raw).map((t) => publishedOverrides?.has(t.id) ? { ...t, published: publishedOverrides.get(t.id)! } : t)

export const getTestById = (id: string, publishedOverrides?: Map<string, boolean>) =>
  getTests(publishedOverrides).find((t) => t.id === id) ?? null
