import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogoutButton } from '@/components/shared/logout-button'
import Link from 'next/link'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      groups: {
        include: {
          group: { include: { _count: { select: { members: true } } } },
        },
      },
    },
  })

  if (!user) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">{user.username[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xl font-bold">{user.username}</p>
            <p className="text-muted-foreground text-sm">加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">我的圈子</CardTitle></CardHeader>
        <CardContent className="p-0">
          {user.groups.map((ug) => (
            <Link key={ug.groupId} href={`/group/${ug.groupId}`} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ug.group.name}</p>
                <p className="text-xs text-muted-foreground">{ug.group._count.members} 位成员</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{ug.role === 'OWNER' ? '管理员' : '成员'} →</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <LogoutButton />
    </div>
  )
}
