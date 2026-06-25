import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDatabase, closeDatabase } from './database';
import accountRoutes from './routes/accounts';
import mailRoutes from './routes/mails';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 初始化数据库
getDatabase();

// API 路由
app.use('/api', accountRoutes);
app.use('/api', mailRoutes);

// 生产环境：提供前端静态文件
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 启动
app.listen(PORT, () => {
  console.log(`[MailHub] 服务已启动: http://localhost:${PORT}`);
  console.log(`[MailHub] API 地址: http://localhost:${PORT}/api`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[MailHub] 正在关闭服务...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});
