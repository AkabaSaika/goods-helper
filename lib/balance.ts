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
  bills: Participant[][]
  settlements: SettlementRecord[]
}

/**
 * 计算 userId 与其他每个人的净余额
 * 正数：对方欠 userId；负数：userId 欠对方
 *
 * bills 是每张账单的参与人数组（按账单分组），不能将多张账单的参与人合并
 * 为一个平铺数组，否则会导致比例计算错误。
 */
export function calculatePairBalance({ userId, bills, settlements }: BalanceInput): Map<string, number> {
  const balanceMap = new Map<string, number>()

  for (const participants of bills) {
    const me = participants.find((p) => p.userId === userId)
    if (!me) continue

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
      // 我还了对方：我的债务减少（余额增大）
      balanceMap.set(s.toUserId, (balanceMap.get(s.toUserId) ?? 0) + amount)
    } else if (s.toUserId === userId) {
      // 对方还了我：对方的债务减少
      balanceMap.set(s.fromUserId, (balanceMap.get(s.fromUserId) ?? 0) - amount)
    }
  }

  return balanceMap
}
