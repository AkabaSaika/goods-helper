'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, RefreshCw } from 'lucide-react'

export function InviteCodeSection({ groupId, inviteCode: initial }: { groupId: string; inviteCode: string }) {
  const [code, setCode] = useState(initial)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function copyCode() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function refreshCode() {
    setRefreshing(true)
    const res = await fetch(`/api/groups/${groupId}/invite`, { method: 'POST' })
    const data = await res.json()
    if (data.inviteCode) setCode(data.inviteCode)
    setRefreshing(false)
  }

  return (
    <Card className="border-blue-100 bg-blue-50">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700">邀请码</CardTitle></CardHeader>
      <CardContent className="p-4 pt-0 flex items-center gap-2">
        <code className="flex-1 font-mono text-sm bg-white px-3 py-2 rounded-lg border truncate">{code}</code>
        <Button size="icon" variant="outline" onClick={copyCode}><Copy className="h-4 w-4" />{copied && <span className="sr-only">已复制</span>}</Button>
        <Button size="icon" variant="outline" onClick={refreshCode} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></Button>
      </CardContent>
    </Card>
  )
}
