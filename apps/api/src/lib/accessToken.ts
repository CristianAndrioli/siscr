/** Token Bearer do header Authorization ou, para WebSocket no browser, query `token`. */
export function readAccessToken(headerValue: string | undefined, queryToken: string | undefined): string | null {
  if (headerValue?.startsWith('Bearer ')) {
    const token = headerValue.slice(7).trim()
    if (token) return token
  }
  const q = queryToken?.trim()
  return q || null
}
