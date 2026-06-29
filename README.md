# Mail Hub 📧

邮箱聚合管理系统 — 统一管理多个邮箱账户，支持收件、发件、邮件转发与通知推送。

## ✨ 功能特性

- **多邮箱聚合管理** — 同时管理 163、QQ、Gmail、Outlook 等多个邮箱账户（IMAP/SMTP）
- **邮件收发** — 统一的收件箱视图，支持基础邮件操作
- **邮件搜索** — 按主题、发件人搜索邮件
- **邮件转发与通知** — 自动转发邮件到指定地址，支持 Server 酱、飞书、企业微信等推送通知
- **本地存储** — 邮件数据本地化存储，使用 SQLite 数据库

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| **前端** | React 18 + TypeScript + React Router v6 + Tailwind CSS + Vite |
| **后端** | Express + TypeScript + tsx |
| **数据库** | SQLite (better-sqlite3) |
| **邮件协议** | IMAP (imapflow) + SMTP (nodemailer) + mailparser |

## 📁 项目结构

```
mail-hub/
├── client/                # React 前端
│   └── src/
│       ├── components/    # 通用组件
│       ├── pages/         # 页面组件（收件箱、邮箱管理、设置等）
│       ├── services/      # API 服务层
│       ├── contexts/      # React Context
│       ├── hooks/         # 自定义 Hooks
│       └── types/         # TypeScript 类型定义
├── server/                # Express 后端
│   └── src/
│       ├── routes/        # API 路由
│       ├── services/      # 业务逻辑（邮件收发、转发等）
│       └── types/         # TypeScript 类型定义
└── package.json           # 根项目配置
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆仓库
git clone <repo-url>
cd mail-hub

# 安装依赖
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# 开发模式运行（前后端同时启动）
npm run dev
```

开发模式下：
- 前端运行在 `http://localhost:5173`
- 后端运行在 `http://localhost:4000`

### 构建与部署

```bash
# 构建
npm run build

# 启动（运行构建后的服务端）
npm start
```

## ⚖️ 许可协议

本项目使用 **Mail Hub Non-Commercial License** — 仅限非商业用途。

- ✅ **允许**：个人学习、研究、教育、非营利项目使用
- ❌ **禁止**：任何商业用途（企业部署、商业产品销售、付费服务等）
- 📧 **商用授权**：请联系 [替换为实际联系邮箱]

详见 [LICENSE](./LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。提交前请确保代码通过类型检查：

```bash
cd client && npx tsc --noEmit
cd ../server && npx tsc --noEmit
```
