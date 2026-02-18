'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import Image from 'next/image'
import { Search } from 'lucide-react'

export default function GoodsPage() {
  const [goods, setGoods] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId) })
  }, [])

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    const params = new URLSearchParams({ groupId })
    if (search) params.set('character', search)
    fetch(`/api/goods?${params}`)
      .then((r) => r.json())
      .then((d) => { setGoods(d.goods ?? []); setLoading(false) })
  }, [groupId, search])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">周边记录</h1>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索角色名..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : goods.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🎁</p>
          <p>还没有周边记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {goods.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {item.imageUrl && (
                <div className="relative h-32 bg-slate-100">
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                </div>
              )}
              <CardContent className="p-3 space-y-1">
                <p className="font-medium text-sm truncate">{item.name}</p>
                {item.characterName && (
                  <Badge variant="secondary" className="text-xs">{item.characterName}</Badge>
                )}
                <p className="text-xs text-slate-500">
                  {formatCurrency(Number(item.unitPrice))} × {item.quantity}
                </p>
                <p className="text-xs text-slate-400">{formatDate(item.bill.date)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
