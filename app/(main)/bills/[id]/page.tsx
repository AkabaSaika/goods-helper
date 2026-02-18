import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency, formatDate } from '@/lib/utils'

const typeLabels = { AA: 'AA 均摊', ADVANCE: '垫付', GOODS: '周边拼单' }

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true } } },
      },
      goods: true,
      createdBy: { select: { username: true } },
    },
  })

  if (!bill) notFound()

  const isMember = bill.participants.some((p) => p.userId === session.userId)
  if (!isMember) redirect('/bills')

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold flex-1">{bill.title}</h1>
        <Badge variant="outline">{typeLabels[bill.type]}</Badge>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">总金额</span>
            <span className="font-semibold text-lg">{formatCurrency(Number(bill.totalAmount))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">日期</span>
            <span>{formatDate(bill.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">创建者</span>
            <span>{bill.createdBy.username}</span>
          </div>
          {bill.description && (
            <div className="flex justify-between">
              <span className="text-slate-500">备注</span>
              <span>{bill.description}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">参与人（{bill.participants.length}）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bill.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{p.user.username[0]}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm">{p.user.username}</span>
              <div className="text-right text-sm">
                <p className="text-slate-500">应付 {formatCurrency(Number(p.shouldPayAmount))}</p>
                {Number(p.paidAmount) > 0 && (
                  <p className="text-green-600">已付 {formatCurrency(Number(p.paidAmount))}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {bill.goods.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">周边明细</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bill.goods.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  {item.characterName && <p className="text-slate-400">{item.characterName}</p>}
                </div>
                <div className="text-right">
                  <p>{formatCurrency(Number(item.unitPrice))} × {item.quantity}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
