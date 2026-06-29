import { getSetting } from './settings.service';

const WECOM_API = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send';

/**
 * 通过企业微信群机器人推送消息到微信
 * @returns true 表示推送成功, false 表示未启用或推送失败
 */
export async function pushToWecom(
  title: string,
  content: string,
  overrideUrl?: string,
): Promise<boolean> {
  try {
    const webhookUrl = overrideUrl || (() => {
      const enabled = getSetting('wecom_bot_enabled');
      return enabled === 'true' ? getSetting('wecom_bot_webhook_url') : null;
    })();
    if (!webhookUrl) return false;

    // 从完整 URL 中提取 key，或直接使用 key
    const key = webhookUrl.includes('key=')
      ? webhookUrl.split('key=').pop()?.split('&')[0] || ''
      : webhookUrl;

    if (!key) return false;

    const res = await fetch(`${WECOM_API}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: `## ${title}\n${content}` },
      }),
    });

    const json: any = await res.json();
    if (json.errcode !== 0) {
      console.error('[WeCom] 推送失败:', json.errmsg || JSON.stringify(json));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[WeCom] 推送异常:', err);
    return false;
  }
}
