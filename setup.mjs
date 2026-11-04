import { createHash } from 'node:crypto';

const TELEGRAM_API = 'https://api.telegram.org';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function telegram(token, method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram API error (${response.status})`);
  }
  return result.result;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ ok: false, error: 'Use GET' }, 405);

  const token = process.env.BOT_TOKEN;
  if (!token) {
    return json({
      ok: false,
      error: 'BOT_TOKEN is not set. Add it to Netlify environment variables and redeploy.',
    }, 500);
  }

  try {
    const bot = await telegram(token, 'getMe');
    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/.netlify/functions/telegram`;
    const secret = createHash('sha256').update(token).digest('hex');

    const result = await telegram(token, 'setWebhook', {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });

    return json({
      ok: true,
      message: 'Webhook registered. The bot is connected to Netlify.',
      bot: `@${bot.username}`,
      bot_url: `https://t.me/${bot.username}`,
      webhook: webhookUrl,
      telegram_result: result,
      next_step: 'Open the bot, send /start, then send /admin from the owner account before sharing the bot link with customers.',
    });
  } catch (error) {
    return json({ ok: false, error: error.message }, 502);
  }
};
