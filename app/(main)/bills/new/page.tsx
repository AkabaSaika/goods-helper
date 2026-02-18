import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { CreateBillForm } from '@/components/shared/create-bill-form'

export default async function NewBillPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const userWithGroups = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      groups: {
        include: {
          group: {
            include: {
              members: {
                include: { user: { select: { id: true, username: true } } },
              },
            },
          },
        },
      },
    },
  })

  const firstGroup = userWithGroups?.groups[0]?.group
  if (!firstGroup) redirect('/dashboard')

  const members = firstGroup.members.map((m) => m.user)

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">新建账单</h1>
      <CreateBillForm
        groupId={firstGroup.id}
        members={members}
        currentUserId={session.userId}
      />
    </div>
  )
}
