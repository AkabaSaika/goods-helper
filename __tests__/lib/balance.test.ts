import { calculatePairBalance } from '@/lib/balance'

describe('calculatePairBalance', () => {
  it('returns positive when others owe the user', () => {
    // 用户A支付了100，应付50，则A被欠50
    const result = calculatePairBalance({
      userId: 'A',
      bills: [[
        { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
      ]],
      settlements: [],
    })
    expect(result.get('B')).toBe(50)
  })

  it('reduces balance after settlement', () => {
    const result = calculatePairBalance({
      userId: 'A',
      bills: [[
        { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
      ]],
      settlements: [
        { fromUserId: 'B', toUserId: 'A', amount: '30' },
      ],
    })
    expect(result.get('B')).toBe(20)
  })

  it('reduces debt when payer creates settlement', () => {
    // B owes A 50; B pays A 30; B should still owe A 20
    const result = calculatePairBalance({
      userId: 'B',
      bills: [[
        { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
      ]],
      settlements: [
        { fromUserId: 'B', toUserId: 'A', amount: '30' },
      ],
    })
    expect(result.get('A')).toBe(-20) // B still owes A 20
  })

  it('ADVANCE: non-payer sees correct debt (payer.shouldPayAmount = 0)', () => {
    // A垫付100元给B：A paid=100, should=0；B paid=0, should=100
    // 从B的视角：B欠A 100元
    const resultB = calculatePairBalance({
      userId: 'B',
      bills: [[
        { userId: 'A', paidAmount: '100', shouldPayAmount: '0' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '100' },
      ]],
      settlements: [],
    })
    expect(resultB.get('A')).toBe(-100) // B owes A 100

    // 从A的视角：B欠A 100元（正数）
    const resultA = calculatePairBalance({
      userId: 'A',
      bills: [[
        { userId: 'A', paidAmount: '100', shouldPayAmount: '0' },
        { userId: 'B', paidAmount: '0', shouldPayAmount: '100' },
      ]],
      settlements: [],
    })
    expect(resultA.get('B')).toBe(100) // A is owed 100 by B
  })

  it('correctly handles multiple bills without diluting balances', () => {
    // Bill 1: A pays for A+B
    // Bill 2: A pays for A+C (B not involved)
    // B should only owe A from Bill 1
    const result = calculatePairBalance({
      userId: 'B',
      bills: [
        [
          { userId: 'A', paidAmount: '100', shouldPayAmount: '50' },
          { userId: 'B', paidAmount: '0', shouldPayAmount: '50' },
        ],
        [
          { userId: 'A', paidAmount: '60', shouldPayAmount: '30' },
          { userId: 'C', paidAmount: '0', shouldPayAmount: '30' },
        ],
      ],
      settlements: [],
    })
    expect(result.get('A')).toBe(-50) // B owes A 50 from Bill 1 only
    expect(result.get('C')).toBeUndefined() // B has no debt with C
  })
})
