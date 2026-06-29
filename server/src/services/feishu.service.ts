import { getSetting } from './settings.service';

/**
 * 通过飞书群机器人推送消息
 * @returns { ok: true } 成功, { ok: false, error: string } 失败
 */
export async function pushToFeishu(
  title: string,
  content: string,
  overrideUrl?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const webhookUrl = overrideUrl || (() => {
      const enabled = getSetting('feishu_bot_enabled');
      return enabled === 'true' ? getSetting('feishu_bot_webhook_url') : null;
    })();
    if (!webhookUrl) {
      return { ok: false, error: '飞书推送未启用或未配置 Webhook URL' };
    }

    // 从完整 URL 中提取 webhook key
    // URL 格式:
    //   https://open.feishu.cn/open-apis/bot/v2/hook/{key}
    //   https://open.larksuite.com/open-apis/bot/v2/hook/{key}
    const match = webhookUrl.match(/\/bot\/v2\/hook\/([a-zA-Z0-9\-]+)/);
    const key = match ? match[1] : webhookUrl.trim();

    if (!key) {
      return { ok: false, error: '无法识别 Webhook URL，请检查格式' };
    }

    const apiBase = webhookUrl.includes('larksuite.com')
      ? 'https://open.larksuite.com/open-apis/bot/v2/hook'
      : 'https://open.feishu.cn/open-apis/bot/v2/hook';

    const res = await fetch(`${apiBase}/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: title },
          },
          elements: [
            {
              tag: 'markdown',
              content,
            },
          ],
        },
      }),
    });

    const json: any = await res.json();
    if (json.code !== 0) {
      const errMsg = json.msg || JSON.stringify(json);
      console.error('[Feishu] 推送失败:', errMsg);
      // 常见错误提示
      if (json.code === 19021) {
        return { ok: false, error: '消息不包含自定义关键词（如设置了关键词安全策略，消息文本需包含该关键词）' };
      }
      if (json.code === 19022) {
        return { ok: false, error: 'IP 地址不在白名单内，请将服务器 IP 加入飞书机器人 IP 白名单' };
      }
      return { ok: false, error: errMsg };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[Feishu] 推送异常:', err);
    return { ok: false, error: err.message || '网络请求失败' };
  }
}
