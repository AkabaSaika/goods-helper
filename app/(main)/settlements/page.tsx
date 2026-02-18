'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckCircle2, ChevronDown, Receipt, ShoppingBag, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const typeIcon = {
  AA: Receipt,
  ADVANCE: CreditCard,
  GOODS: ShoppingBag,
}

interface BillDetail {
  billId: string
  title: string
  type: string
  date: string
  amount: number
}

interface Balance {
  user: { id: string; username: string }
  netAmount: number
  details: BillDetail[]
}

export default function SettlementsPage() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [settleTarget, setSettleTarget] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId)
      })
  }, [])

  function loadBalances(gId: string) {
    setLoading(true)
    fetch(`/api/balances?groupId=${gId}`)
      .then((r) => r.json())
      .then((d) => { setBalances(d.balances ?? []); setLoading(false) })
  }

  useEffect(() => {
    if (groupId) loadBalances(groupId)
  }, [groupId])

  async function handleSettle(type: 'MARK_CLEARED' | 'PAYMENT_RECORD') {
    if (!settleTarget || !groupId) return
    setSettling(true)
    const settlementAmount = type === 'MARK_CLEARED'
      ? Math.abs(settleTarget.netAmount)
      : parseFloat(amount)

    await fetch('/api/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        toUserId: settleTarget.user.id,
        amount: settlementAmount,
        note: note || undefined,
        type,
      }),
    })

    setSettleTarget(null)
    setAmount('')
    setNote('')
    setSettling(false)
    loadBalances(groupId)
  }

  const iOwe = balances.filter((b) => b.netAmount < 0)
  const theyOwe = balances.filter((b) => b.netAmount > 0)
  const balanced = balances.filter((b) => Math.abs(b.netAmount) < 0.01)

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">结算中心</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <>
          {iOwe.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">我欠别人</p>
              <div className="space-y-2">
                {iOwe.map((b) => (
                  <BalanceRow key={b.user.id} balance={b} onSettle={() => setSettleTarget(b)} />
                ))}
              </div>
            </div>
          )}
          {theyOwe.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">别人欠我</p>
              <div className="space-y-2">
                {theyOwe.map((b) => (
                  <BalanceRow key={b.user.id} balance={b} onSettle={() => setSettleTarget(b)} />
                ))}
              </div>
            </div>
          )}
          {balanced.length > 0 && iOwe.length === 0 && theyOwe.length === 0 && (
            <div className="text-center py-16">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
              <p className="font-semibold text-emerald-600">全部结清啦</p>
              <p className="text-sm text-muted-foreground mt-1">和所有人都账目清晰</p>
            </div>
          )}
        </>
      )}

      <Dialog open={!!settleTarget} onOpenChange={() => setSettleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>与 {settleTarget?.user.username} 结算</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              当前余额：<strong className="text-foreground">{formatCurrency(Math.abs(settleTarget?.netAmount ?? 0))}</strong>
              {(settleTarget?.netAmount ?? 0) < 0 ? '（我欠对方）' : '（对方欠我）'}
            </p>
            <div className="space-y-2">
              <Label>还款金额（留空则全额结清）</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${Math.abs(settleTarget?.netAmount ?? 0).toFixed(2)}`}
              />
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="转账备注" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => handleSettle('MARK_CLEARED')} disabled={settling} className="cursor-pointer">
              标记结清
            </Button>
            <Button onClick={() => handleSettle('PAYMENT_RECORD')} disabled={settling || !amount} className="cursor-pointer">
              录入还款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BalanceRow({ balance, onSettle }: { balance: Balance; onSettle: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isNegative = balance.netAmount < 0

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-secondary text-secondary-foreground font-medium">{balance.user.username[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{balance.user.username}</p>
            <p className={`text-sm font-semibold ${isNegative ? 'text-rose-500' : 'text-emerald-600'}`}>
              {isNegative ? '欠 ' : '还我 '}{formatCurrency(Math.abs(balance.netAmount))}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {balance.details.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                aria-label={expanded ? '收起详情' : '展开详情'}
              >
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} />
              </button>
            )}
            <Button size="sm" variant="outline" onClick={onSettle} className="cursor-pointer">结算</Button>
          </div>
        </div>

        {expanded && balance.details.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {balance.details.map((d) => {
              const Icon = typeIcon[d.type as keyof typeof typeIcon] ?? Receipt
              return (
                <Link
                  key={d.billId}
                  href={`/bills/${d.billId}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors cursor-pointer"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-xs text-foreground truncate">{d.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(d.date)}</span>
                  <span className={cn('text-xs font-semibold shrink-0', d.amount > 0 ? 'text-emerald-600' : 'text-rose-500')}>
                    {d.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(d.amount))}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
