# Goods Helper 设计文档

**日期：** 2026-02-18
**项目：** goods-helper
**定位：** 朋友圈内部记账 APP，支持 AA 账单、垫付、动漫周边拼单管理

---

## 一、项目背景

供约 10 人规模的朋友圈内部使用，主要解决以下场景：

1. 出去玩的 AA 账单分摊
2. 朋友间互相垫付（含动漫周边拼单、凑邮费等）
3. 定期查看与各人的余额并进行结算

---

## 二、技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 + Tailwind CSS v4 + shadcn/ui |
| 后端 | Next.js API Routes (Route Handlers) |
| ORM | Prisma |
| 数据库（本地）| PostgreSQL via Docker |
| 数据库（生产）| Neon（免费托管 PostgreSQL）|
| 图片存储 | Vercel Blob |
| 部署 | Vercel（CI/CD，git push 自动部署）|

---

## 三、架构方案

采用 **Next.js 全栈单体 Monorepo** 方案：

```
goods-helper/
├── app/
│   ├── (auth)/          # 登录、注册页面
│   ├── (main)/          # 主功能页面（需登录）
│   │   ├── dashboard/
│   │   ├── bills/
│   │   ├── goods/
│   │   ├── settlements/
│   │   ├── stats/
│   │   └── group/
│   └── api/             # API Route Handlers
│       ├── auth/
│       ├── bills/
│       ├── goods/
│       ├── settlements/
│       ├── stats/
│       └── groups/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── lib/
│   ├── db.ts            # Prisma 客户端单例
│   ├── auth.ts          # 认证工具函数
│   └── utils.ts
├── components/
│   ├── ui/              # shadcn/ui 组件
│   └── shared/          # 业务组件
├── docker-compose.yml
└── docs/
```

---

## 四、数据模型

```prisma
model User {
  id           String       @id @default(cuid())
  username     String       @unique
  passwordHash String
  avatarUrl    String?
  createdAt    DateTime     @default(now())
  groups       UserGroup[]
  billsCreated Bill[]
  participants BillParticipant[]
  settlementsFrom Settlement[] @relation("FromUser")
  settlementsTo   Settlement[] @relation("ToUser")
}

model Group {
  id          String      @id @default(cuid())
  name        String
  description String?
  inviteCode  String      @unique @default(cuid())
  createdBy   String
  createdAt   DateTime    @default(now())
  members     UserGroup[]
  bills       Bill[]
  settlements Settlement[]
}

model UserGroup {
  userId    String
  groupId   String
  role      Role        @default(MEMBER)
  joinedAt  DateTime    @default(now())
  user      User        @relation(fields: [userId], references: [id])
  group     Group       @relation(fields: [groupId], references: [id])
  @@id([userId, groupId])
}

enum Role {
  OWNER
  MEMBER
}

model Bill {
  id           String           @id @default(cuid())
  title        String
  type         BillType
  totalAmount  Decimal
  currency     String           @default("CNY")
  date         DateTime
  description  String?
  groupId      String
  createdById  String
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  group        Group            @relation(fields: [groupId], references: [id])
  createdBy    User             @relation(fields: [createdById], references: [id])
  participants BillParticipant[]
  goods        GoodsItem[]
}

enum BillType {
  AA       # 多人均摊
  ADVANCE  # 垫付
  GOODS    # 动漫周边拼单
}

model BillParticipant {
  id              String  @id @default(cuid())
  billId          String
  userId          String
  paidAmount      Decimal @default(0)   # 实际已付金额
  shouldPayAmount Decimal               # 应付金额
  bill            Bill    @relation(fields: [billId], references: [id])
  user            User    @relation(fields: [userId], references: [id])
  @@unique([billId, userId])
}

model GoodsItem {
  id            String    @id @default(cuid())
  billId        String
  name          String
  characterName String?
  quantity      Int       @default(1)
  unitPrice     Decimal
  purchaseDate  DateTime?
  deliveryDate  DateTime?
  imageUrl      String?   # 可选，存储在 Vercel Blob
  bill          Bill      @relation(fields: [billId], references: [id])
}

model Settlement {
  id         String         @id @default(cuid())
  groupId    String
  fromUserId String
  toUserId   String
  amount     Decimal
  date       DateTime       @default(now())
  note       String?
  type       SettlementType
  group      Group          @relation(fields: [groupId], references: [id])
  fromUser   User           @relation("FromUser", fields: [fromUserId], references: [id])
  toUser     User           @relation("ToUser", fields: [toUserId], references: [id])
}

enum SettlementType {
  MARK_CLEARED    # 直接标记结清
  PAYMENT_RECORD  # 录入还款记录
}
```

**余额计算：** 不存储静态 Balance，在查询时由 Bill + BillParticipant + Settlement 动态计算两两净额。

---

## 五、功能模块

### 5.1 用户认证
- 通过圈子邀请码注册账号
- 用户名 + 密码登录
- Session 基于 JWT（存储在 httpOnly Cookie）

### 5.2 账单管理
| 账单类型 | 说明 |
|---------|------|
| AA | 多人参与，系统自动均摊或手动设置每人金额 |
| ADVANCE | 一人替另一人（或多人）垫付 |
| GOODS | 动漫周边拼单，包含 GoodsItem 明细列表 |

### 5.3 周边记录
- 汇总所有 GOODS 类账单下的 GoodsItem
- 支持按角色名、购买日期筛选
- 卡片展示，有图片显示缩略图

### 5.4 结算中心
- 展示当前圈子内我与每位成员的净余额
- 正数：对方欠我；负数：我欠对方
- 支持两种结算方式：
  - 标记结清（快速，适合已线下转账）
  - 录入还款（填写金额+日期，留存记录）

### 5.5 统计报表
- 选择时间范围（本月 / 本季度 / 自定义）
- 展示：个人支出总额、垫付总额、被垫付总额
- 账单类型分布图
- 周边花费按角色汇总

### 5.6 圈子管理
- 查看成员列表及加入时间
- Owner 可生成/刷新邀请码
- Owner 可移除成员
- 支持加入多个圈子，顶部切换

---

## 六、UI 设计方向

### 响应式策略
- **Mobile First**：以手机端为主要设计目标
- 移动端：底部 Tab Bar（首页 / 账单 / 结算 / 我的）
- 桌面端：左侧边栏导航
- 使用 Tailwind 响应式前缀：`sm:` / `md:` / `lg:`
- 图片上传支持手机相册直接选取（`<input accept="image/*" capture>`）

### 视觉规范
- **主色**：靛蓝 `#4F6AF5`
- **背景**：白色 `#FFFFFF`，次要背景 `#F8F9FA`
- **收支颜色**：支出红 `#EF4444`，收入绿 `#22C55E`
- **字体**：系统字体栈，中文优先
- **圆角**：`rounded-xl`（卡片）/ `rounded-lg`（按钮）

### 主要页面

| 页面 | 核心元素 |
|------|---------|
| 首页 | 余额大字概览卡片 + 最近账单列表 |
| 账单列表 | 分类 Tab + 账单卡片（图标/标题/金额/参与人头像）|
| 新建账单 | 分步表单（类型 → 金额 → 参与人 → 确认）|
| 结算中心 | 每人余额行 + 操作按钮 |
| 统计 | 时间范围选择器 + 数字汇总 + 图表 |

### shadcn/ui 主要组件
`Card` / `Button` / `Input` / `Select` / `Dialog` / `Tabs` / `Badge` / `Avatar` / `Calendar` / `Sheet`（移动端侧边栏）

---

## 七、部署架构

### 本地开发
```bash
# 启动 PostgreSQL
docker-compose up -d

# 启动开发服务器
npm run dev
```

`docker-compose.yml`：
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: goods_helper
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 生产环境
```
GitHub → Vercel（自动 CI/CD）
              ↓
        Next.js App
              ↓
        Neon PostgreSQL（免费托管）
        Vercel Blob（图片存储）
```

### 环境变量
```
DATABASE_URL=          # Neon 连接串（生产）/ Docker（本地）
NEXTAUTH_SECRET=       # JWT 签名密钥
BLOB_READ_WRITE_TOKEN= # Vercel Blob token
```

---

## 八、开发路线图（分阶段）

路线图详细拆解见 `docs/plans/implementation-plan.md`（由 writing-plans 生成）

### 阶段概览

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| Phase 1 | 项目初始化、Docker、数据库、认证 | P0 |
| Phase 2 | 账单 CRUD（AA + 垫付）| P0 |
| Phase 3 | 动漫周边拼单 + 图片上传 | P1 |
| Phase 4 | 结算中心 + 余额计算 | P0 |
| Phase 5 | 统计报表 | P1 |
| Phase 6 | 圈子管理 | P1 |
| Phase 7 | 响应式优化 + 生产部署 | P0 |

---

*本文档为初始设计，开发过程中可能随需求变化更新。*
