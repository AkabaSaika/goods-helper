import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 创建初始圈子
  const group = await prisma.group.upsert({
    where: { inviteCode: 'initial-invite-code' },
    update: {},
    create: {
      name: '我们的小圈子',
      description: '第一个圈子',
      inviteCode: 'initial-invite-code',
      createdBy: 'admin',
    },
  })

  console.log('✅ 初始圈子已创建')
  console.log('邀请码：', group.inviteCode)
  console.log('圈子 ID：', group.id)
  console.log('把邀请码分享给朋友，让他们注册！')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
