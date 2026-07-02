/**
 * 验证数据库迁移是否成功
 * 用法: node scripts/check-migration.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'mailhub.db');
const db = new Database(dbPath);

let ok = true;

console.log('=== 1. mails 表列 ===');
const cols = db.prepare('PRAGMA table_info(mails)').all();
const colNames = cols.map(c => c.name);
console.log(colNames.join(', '));

if (colNames.includes('forwarded')) {
  console.log('  ✅ forwarded 列存在');
} else {
  console.log('  ❌ forwarded 列不存在 - 需要重启服务');
  ok = false;
}

console.log('\n=== 2. 唯一索引 ===');
const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_mails_uid_unique'").get();
if (idx) {
  console.log('  ✅ idx_mails_uid_unique 唯一索引存在');
} else {
  console.log('  ❌ 唯一索引不存在 - 升级失败');
  ok = false;
}

console.log('\n=== 3. 重复行检查 ===');
const dup = db.prepare('SELECT COUNT(*) AS c FROM (SELECT 1 FROM mails GROUP BY account_id, folder, message_uid HAVING COUNT(*) > 1)').get();
if (dup.c === 0) {
  console.log('  ✅ 无重复行');
} else {
  console.log(`  ⚠️  发现 ${dup.c} 组重复行（升级前的遗留数据）`);
}

console.log('\n=== 4. forwarded 标记状态 ===');
const marked = db.prepare('SELECT COUNT(*) AS c FROM mails WHERE forwarded = 1').get();
const unmarked = db.prepare('SELECT COUNT(*) AS c FROM mails WHERE forwarded = 0').get();
console.log(`  已标记转发处理 (forwarded=1): ${marked.c}`);
console.log(`  未标记 (forwarded=0): ${unmarked.c}`);

db.close();

console.log(`\n${ok ? '✅ 全部正常' : '❌ 有异常，需要处理'}`);
