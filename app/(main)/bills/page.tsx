'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { BillCard } from '@/components/shared/bill-card'
import { Plus } from 'lucide-react'
import Link from 'next/link'

const tabs = [
  { value: '', label: '全部' },
  { value: 'AA', label: 'AA' },
  { value: 'ADVANCE', label: '垫付' },
  { value: 'GOODS', label: '周边' },
]

export default function BillsPage() {
  const [activeTab, setActiveTab] = useState('')
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [groupId, setGroupId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId)
      })
  }, [])

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    const params = new URLSearchParams({ groupId })
    if (activeTab) params.set('type', activeTab)

    fetch(`/api/bills?${params}`)
      .then((r) => r.json())
      .then((d) => { setBills(d.bills ?? []); setLoading(false) })
  }, [groupId, activeTab])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">账单</h1>
        <Button asChild size="sm">
          <Link href="/bills/new"><Plus className="h-4 w-4 mr-1" />新建</Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="w-full">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1">{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">📋</p>
          <p>还没有账单</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => <BillCard key={bill.id} bill={bill} />)}
        </div>
      )}
    </div>
  )
}
