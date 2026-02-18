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
 *
 * 超付方（myExtra > 0）：按他人 shouldPayAmount 比例分摊欠款。
 * 少付方（myExtra < 0）：按他人实际超付金额比例偿还，支持垫付账单
 * （垫付人 shouldPayAmount = 0，用 shouldPayAmount 比例会导致除以零）。
 */
export function calculatePairBalance({ userId, bills, settlements }: BalanceInput): Map<string, number> {
  const balanceMap = new Map<string, number>()

  for (const participants of bills) {
    const me = participants.find((p) => p.userId === userId)
    if (!me) continue

    const myPaid = parseFloat(me.paidAmount)
    const myShould = parseFloat(me.shouldPayAmount)
    const myExtra = myPaid - myShould

    if (Math.abs(myExtra) < 0.005) continue

    const others = participants.filter((p) => p.userId !== userId)

    if (myExtra > 0) {
      // 我超付了：按他人应付金额比例分摊
      const totalOthersShould = others.reduce((sum, o) => sum + parseFloat(o.shouldPayAmount), 0)
      for (const other of others) {
        const proportion = totalOthersShould > 0
          ? parseFloat(other.shouldPayAmount) / totalOthersShould
          : 1 / others.length
        balanceMap.set(other.userId, (balanceMap.get(other.userId) ?? 0) + myExtra * proportion)
      }
    } else {
      // 我少付了：按他人实际超付金额比例偿还
      // 用超付金额（而非 shouldPayAmount）作为比例基准，
      // 避免垫付账单中 payer.shouldPayAmount=0 导致比例为零的问题
      const otherExtras = others.map((o) => ({
        userId: o.userId,
        extra: Math.max(parseFloat(o.paidAmount) - parseFloat(o.shouldPayAmount), 0),
      }))
      const totalOtherExtras = otherExtras.reduce((sum, o) => sum + o.extra, 0)
      if (totalOtherExtras < 0.005) continue

      for (const { userId: otherId, extra } of otherExtras) {
        const proportion = extra / totalOtherExtras
        balanceMap.set(otherId, (balanceMap.get(otherId) ?? 0) + myExtra * proportion)
      }
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
