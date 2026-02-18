'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#4F6AF5', '#f97316', '#a855f7']
const PRESETS = [
  { label: '本月', getValue: () => {
    const now = new Date()
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    }
  }},
  { label: '本年', getValue: () => {
    const now = new Date()
    return {
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
    }
  }},
]

export default function StatsPage() {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.user?.groups?.[0]) setGroupId(d.user.groups[0].groupId) })
  }, [])

  function loadStats() {
    if (!groupId) return
    setLoading(true)
    const params = new URLSearchParams({ groupId })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/stats?${params}`)
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false) })
  }

  useEffect(() => { if (groupId) loadStats() }, [groupId])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">统计</h1>

      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => {
            const { from: f, to: t } = p.getValue()
            setFrom(f); setTo(t)
          }}>
            {p.label}
          </Button>
        ))}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        <span className="self-center text-slate-400">—</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        <Button size="sm" onClick={loadStats}>查询</Button>
      </div>

      {loading && <p className="text-slate-500 text-sm">加载中...</p>}

      {stats && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '我的支出', value: stats.totalShouldPay, color: 'text-slate-900' },
              { label: '我的垫付', value: stats.totalAdvanced, color: 'text-blue-600' },
              { label: '实付总计', value: stats.totalPaid, color: 'text-green-600' },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className={`font-bold text-sm ${item.color}`}>{formatCurrency(item.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {stats.byType.some((t: any) => t.value > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">账单类型分布</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stats.byType.filter((t: any) => t.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {stats.byType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number | undefined) => formatCurrency(Number(v ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {stats.byCharacter.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">周边花费（按角色）</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.byCharacter.slice(0, 8)}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | undefined) => formatCurrency(Number(v ?? 0))} />
                    <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
