import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDatabase, closeDatabase } from './database';
import accountRoutes from './routes/accounts';
import mailRoutes from './routes/mails';
import settingsRoutes from './routes/settings';
import verificationRoutes from './routes/verification';
import forwardingRoutes from './routes/forwarding';
import forwardingMethodsRoutes from './routes/forwarding-methods';
import trashRoutes from './routes/trash';
import draftRoutes from './routes/drafts';
import authRoutes from './routes/auth';
import { startSyncScheduler, stopSyncScheduler } from './services/scheduler.service';

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
app.use('/api', settingsRoutes);
app.use('/api', verificationRoutes);
app.use('/api', forwardingRoutes);
app.use('/api', forwardingMethodsRoutes);
app.use('/api', trashRoutes);
app.use('/api', draftRoutes);
app.use('/api', authRoutes);

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
  startSyncScheduler();
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[MailHub] 正在关闭服务...');
  stopSyncScheduler();
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopSyncScheduler();
  closeDatabase();
  process.exit(0);
});
