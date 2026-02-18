import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { InviteCodeSection } from '@/components/shared/invite-code-section'
import { formatDate } from '@/lib/utils'

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!group) notFound()

  const myMembership = group.members.find((m) => m.userId === session.userId)
  if (!myMembership) redirect('/profile')

  const isOwner = myMembership.role === 'OWNER'

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">{group.name}</h1>
        {group.description && <p className="text-slate-500 text-sm mt-1">{group.description}</p>}
      </div>

      {isOwner && <InviteCodeSection groupId={id} inviteCode={group.inviteCode} />}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">成员（{group.members.length}）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{m.user.username[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{m.user.username}</p>
                <p className="text-xs text-slate-400">加入于 {formatDate(m.joinedAt)}</p>
              </div>
              {m.role === 'OWNER' && <Badge variant="secondary">管理员</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
