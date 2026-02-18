import { signToken, verifyToken } from '@/lib/auth'

describe('auth utils', () => {
  it('signs and verifies a token', async () => {
    const payload = { userId: 'user-1', username: 'alice' }
    const token = await signToken(payload)
    expect(typeof token).toBe('string')

    const decoded = await verifyToken(token)
    expect(decoded?.userId).toBe('user-1')
    expect(decoded?.username).toBe('alice')
  })

  it('returns null for invalid token', async () => {
    const result = await verifyToken('invalid-token')
    expect(result).toBeNull()
  })
})
