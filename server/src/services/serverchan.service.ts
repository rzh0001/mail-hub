import { getSetting } from './settings.service';

const SCT_API = 'https://sctapi.ftqq.com';

/**
 * 通过 Server酱 推送消息到微信
 * @returns true 表示推送成功, false 表示未启用或推送失败
 */
export async function pushToWechat(
  title: string,
  content: string,
  overrideKey?: string,
): Promise<boolean> {
  try {
    const key = overrideKey || (() => {
      const enabled = getSetting('serverchan_enabled');
      return enabled === 'true' ? getSetting('serverchan_key') : null;
    })();
    if (!key) return false;

    const res = await fetch(`${SCT_API}/${key}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, desp: content }),
    });

    const json: any = await res.json();
    if (json.code !== 0) {
      console.error('[ServerChan] 推送失败:', json.message || JSON.stringify(json));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[ServerChan] 推送异常:', err);
    return false;
  }
}
