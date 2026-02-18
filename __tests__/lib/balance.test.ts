import { calculatePairBalance } from '@/lib/balance'

describe('calculatePairBalance', () => {
  it('returns positive when others owe the user', () => {
    // 用户A支付了100，应付50，则A被欠50
    const result = calculatePairBalance({
      userId: 'A',
      participants: [
        { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
      ],
      settlements: [],
    })
    expect(result.get('B')).toBe(50)
  })

  it('reduces balance after settlement', () => {
    const result = calculatePairBalance({
      userId: 'A',
      participants: [
        { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
      ],
      settlements: [
        { fromUserId: 'B', toUserId: 'A', amount: '30' },
      ],
    })
    expect(result.get('B')).toBe(20)
  })
})
