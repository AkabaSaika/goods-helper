interface Participant {
  userId: string
  paidAmount: string
  shouldPayAmount: string
}

interface SettlementRecord {
  fromUserId: string
  toUserId: string
  amount: string
}

interface BalanceInput {
  userId: string
  participants: Participant[]
  settlements: SettlementRecord[]
}

/**
 * 计算 userId 与其他每个人的净余额
 * 正数：对方欠 userId；负数：userId 欠对方
 */
export function calculatePairBalance({ userId, participants, settlements }: BalanceInput): Map<string, number> {
  // 净余额 map：key = 对方userId, value = 对方欠我的金额
  const balanceMap = new Map<string, number>()

  // 自己的支付和应付
  const me = participants.find((p) => p.userId === userId)
  if (me) {
    const myPaid = parseFloat(me.paidAmount)
    const myShould = parseFloat(me.shouldPayAmount)
    const myExtra = myPaid - myShould // 我多付的金额，应由他人分摊

    const others = participants.filter((p) => p.userId !== userId)
    const totalOthersShould = others.reduce((sum, o) => sum + parseFloat(o.shouldPayAmount), 0)

    for (const other of others) {
      const otherShould = parseFloat(other.shouldPayAmount)
      const proportion = totalOthersShould > 0 ? otherShould / totalOthersShould : 0
      const owedByOther = myExtra * proportion
      balanceMap.set(other.userId, (balanceMap.get(other.userId) ?? 0) + owedByOther)
    }
  }

  // 处理结算记录
  for (const s of settlements) {
    const amount = parseFloat(s.amount)
    if (s.fromUserId === userId) {
      // 我还了对方
      balanceMap.set(s.toUserId, (balanceMap.get(s.toUserId) ?? 0) - amount)
    } else if (s.toUserId === userId) {
      // 对方还了我
      balanceMap.set(s.fromUserId, (balanceMap.get(s.fromUserId) ?? 0) - amount)
    }
  }

  return balanceMap
}
