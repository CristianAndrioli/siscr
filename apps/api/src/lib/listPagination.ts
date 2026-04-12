/** Query params comuns para listas paginadas (page 0-based). */

export function parseListPagination(c: { req: { query: (k: string) => string | undefined } }): {
  limit: number
  page: number
  offset: number
} {
  const limitRaw = c.req.query('limit')
  const pageRaw = c.req.query('page')
  const limit = Math.min(Math.max(Number.parseInt(limitRaw ?? '10', 10) || 10, 1), 200)
  const page = Math.max(Number.parseInt(pageRaw ?? '0', 10) || 0, 0)
  return { limit, page, offset: page * limit }
}
