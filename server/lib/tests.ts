import type { TestDetail } from './types'

export const getDbTests = async (db: D1Database): Promise<TestDetail[]> => {
  const rows = await db.prepare('SELECT id, published, data_json FROM tests WHERE data_json IS NOT NULL').all<{ id: string; published: number; data_json: string }>()
  return (rows.results ?? []).map((r) => {
    const t = JSON.parse(r.data_json) as TestDetail
    return { ...t, id: r.id, published: r.published === 1 }
  })
}

export const getTestById = async (db: D1Database, id: string): Promise<TestDetail | null> => {
  const row = await db.prepare('SELECT id, published, data_json FROM tests WHERE id = ? AND data_json IS NOT NULL').bind(id).first<{ id: string; published: number; data_json: string }>()
  if (!row) return null
  const t = JSON.parse(row.data_json) as TestDetail
  return { ...t, id: row.id, published: row.published === 1 }
}
