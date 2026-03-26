import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TestDetail } from './types'

const testsDir = process.env.TESTS_DIR ?? join(import.meta.dir, '..', 'data', 'tests')

let testsCache: TestDetail[] = []
let persistPublished: ((testId: string, published: boolean) => void) | null = null

const ensureTestsDir = () => {
  mkdirSync(testsDir, { recursive: true })
}

const normalizeTest = (raw: TestDetail): TestDetail => ({
  ...raw,
  published: false,
  sections: raw.sections ?? [],
})

export const setPersistPublished = (fn: (testId: string, published: boolean) => void) => {
  persistPublished = fn
}

export const loadTestsFromDisk = (publishedOverrides?: Map<string, boolean>) => {
  ensureTestsDir()

  const files = readdirSync(testsDir).filter((file) => file.endsWith('.json')).sort()
  const tests: TestDetail[] = []

  for (const file of files) {
    const filePath = join(testsDir, file)
    const raw = JSON.parse(readFileSync(filePath, 'utf8'))

    const push = (item: TestDetail) => {
      const test = normalizeTest(item)
      if (publishedOverrides?.has(test.id)) {
        test.published = publishedOverrides.get(test.id)!
      }
      tests.push(test)
    }

    if (Array.isArray(raw)) { raw.forEach((item) => push(item as TestDetail)); continue }
    if (raw && Array.isArray(raw.tests)) { raw.tests.forEach((item: TestDetail) => push(item)); continue }
    if (raw && raw.test) { push(raw.test as TestDetail); continue }
    push(raw as TestDetail)
  }

  testsCache = tests
  return testsCache
}

export const getTestsCache = () => testsCache

export const getTests = () => (testsCache.length ? testsCache : loadTestsFromDisk())

export const getTestById = (testId: string) => getTests().find((test) => test.id === testId) ?? null

export const setTestsCache = (tests: TestDetail[]) => {
  testsCache = tests.map(normalizeTest)
}

export const updateTestPublished = (testId: string, published: boolean) => {
  const test = testsCache.find((t) => t.id === testId)
  if (!test) return null
  test.published = published
  persistPublished?.(testId, published)
  return test
}

export const getTestsDir = () => testsDir
