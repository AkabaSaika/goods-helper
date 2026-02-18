'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Member {
  id: string
  username: string
}

interface GoodsEntry {
  name: string
  characterName: string
  unitPrice: string
  quantity: number
}

export function CreateBillForm({ groupId, members, currentUserId }: {
  groupId: string
  members: Member[]
  currentUserId: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [type, setType] = useState<'AA' | 'ADVANCE' | 'GOODS'>('AA')
  const [title, setTitle] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([currentUserId])
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [goods, setGoods] = useState<GoodsEntry[]>([
    { name: '', characterName: '', unitPrice: '', quantity: 1 }
  ])

  const computedTotal = type === 'GOODS'
    ? goods.reduce((sum, g) => sum + parseFloat(g.unitPrice || '0') * g.quantity, 0)
    : parseFloat(totalAmount || '0')

  function handleTypeChange(newType: 'AA' | 'ADVANCE' | 'GOODS') {
    setType(newType)
    if (newType !== 'GOODS') {
      setGoods([{ name: '', characterName: '', unitPrice: '', quantity: 1 }])
    }
  }

  function updateGoods(index: number, field: keyof GoodsEntry, value: string | number) {
    setGoods((prev) => prev.map((g, i) => i === index ? { ...g, [field]: value } : g))
  }

  function addGoodsEntry() {
    setGoods((prev) => [...prev, { name: '', characterName: '', unitPrice: '', quantity: 1 }])
  }

  function removeGoodsEntry(index: number) {
    setGoods((prev) => prev.filter((_, i) => i !== index))
  }

  function validateStep1(): boolean {
    if (!title) return false
    if (type === 'GOODS') {
      if (goods.length === 0) return false
      return goods.every((g) => g.name.trim() !== '' && parseFloat(g.unitPrice || '0') > 0)
    }
    return parseFloat(totalAmount || '0') > 0
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)

    const amount = computedTotal

    let participants
    if (type === 'ADVANCE') {
      const others = selectedMembers.filter((id) => id !== paidBy)
      const perOther = others.length > 0 ? amount / others.length : amount
      participants = selectedMembers.map((userId) => ({
        userId,
        paidAmount: userId === paidBy ? amount : 0,
        shouldPayAmount: userId === paidBy ? 0 : perOther,
      }))
    } else {
      const perPerson = amount / selectedMembers.length
      participants = selectedMembers.map((userId) => ({
        userId,
        paidAmount: userId === paidBy ? amount : 0,
        shouldPayAmount: perPerson,
      }))
    }

    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, type, totalAmount: amount,
          date: new Date(date).toISOString(),
          description: description || undefined,
          groupId, participants,
          ...(type === 'GOODS' ? {
            goods: goods.map((g) => ({
              name: g.name,
              characterName: g.characterName || undefined,
              unitPrice: parseFloat(g.unitPrice),
              quantity: g.quantity,
            }))
          } : {})
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '创建失败'); return }
      router.push('/bills')
      router.refresh()
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: 类型和基本信息 */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>账单类型</Label>
            <div className="flex gap-2">
              {(['AA', 'ADVANCE', 'GOODS'] as const).map((t) => (
                <Button
                  key={t}
                  variant={type === t ? 'default' : 'outline'}
                  onClick={() => handleTypeChange(t)}
                  className="flex-1"
                >
                  {t === 'AA' ? 'AA 均摊' : t === 'ADVANCE' ? '垫付' : '周边拼单'}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>账单标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：火锅聚餐" />
          </div>

          {type !== 'GOODS' && (
            <div className="space-y-2">
              <Label>总金额（元）</Label>
              <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" />
            </div>
          )}

          {type === 'GOODS' && (
            <div className="space-y-3">
              <Label>商品条目</Label>
              {goods.map((g, i) => (
                <Card key={i} className="border border-slate-200">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-slate-500">商品名 *</Label>
                        <Input
                          value={g.name}
                          onChange={(e) => updateGoods(i, 'name', e.target.value)}
                          placeholder="例：帆布包"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-slate-500">角色名</Label>
                        <Input
                          value={g.characterName}
                          onChange={(e) => updateGoods(i, 'characterName', e.target.value)}
                          placeholder="可选"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-slate-500">单价（元）*</Label>
                        <Input
                          type="number"
                          value={g.unitPrice}
                          onChange={(e) => updateGoods(i, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs text-slate-500">数量 *</Label>
                        <Input
                          type="number"
                          min={1}
                          value={g.quantity}
                          onChange={(e) => updateGoods(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      {goods.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGoodsEntry(i)}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addGoodsEntry} className="w-full">
                + 添加商品
              </Button>
              <Card className="bg-slate-50">
                <CardContent className="p-3 text-sm text-slate-600">
                  合计金额：<strong>¥{computedTotal.toFixed(2)}</strong>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-2">
            <Label>日期</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>备注（可选）</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可以不填" />
          </div>
          <Button className="w-full" onClick={() => setStep(2)} disabled={!validateStep1()}>
            下一步
          </Button>
        </div>
      )}

      {/* Step 2: 参与人 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>参与人（{selectedMembers.length} 人）</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Badge
                  key={m.id}
                  variant={selectedMembers.includes(m.id) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => toggleMember(m.id)}
                >
                  {m.username}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>谁付的款</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.filter((m) => selectedMembers.includes(m.id)).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMembers.length > 0 && (
            <Card className="bg-muted">
              <CardContent className="p-3 text-sm text-muted-foreground">
                {type === 'ADVANCE' ? (
                  selectedMembers.length > 1
                    ? <>付款人不分摊，被垫付人每人应付：<strong className="text-foreground">¥{(computedTotal / (selectedMembers.length - 1)).toFixed(2)}</strong></>
                    : <>请至少添加一位被垫付人</>
                ) : (
                  <>每人应付：<strong className="text-foreground">¥{(computedTotal / selectedMembers.length).toFixed(2)}</strong></>
                )}
              </CardContent>
            </Card>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">上一步</Button>
            <Button onClick={handleSubmit} disabled={loading || selectedMembers.length === 0} className="flex-1">
              {loading ? '创建中...' : '确认创建'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
