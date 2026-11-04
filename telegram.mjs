import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const TELEGRAM_API = 'https://api.telegram.org';
const AGENCY = {
  name: 'Реквием',
  phone: '8 923 415-50-00',
  phoneLink: '+79234155000',
  address: 'Томская область, г. Колпашево, ул. Победы, 14',
  website: 'https://xn--b1afblipw.com/',
  max: 'https://max.ru/channel_Rekviem_Kolpashevo',
  googleMaps: 'https://maps.app.goo.gl/8yVRZFU5q4je6Fxr6',
  // Real portfolio photo from the agency website.
  photo: 'https://xn--b1afblipw.com/images/works/work17.jpg',
};

const REQUEST_PROMPT = 'Пожалуйста, ответьте на это сообщение одним сообщением. Опишите, что вам нужно, и оставьте номер телефона для связи. [Заявка в Реквием]';
const settings = () => getStore({ name: 'rekviem-bot-settings', region: 'eu-central-1' });

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

function safeSecretEqual(received, expected) {
  if (typeof received !== 'string' || !received || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function userName(user = {}) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Не указано';
}

function homeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📩 Оставить заявку', callback_data: 'request' }],
      [{ text: '☎️ Контакты', callback_data: 'contacts' }],
    ],
  };
}

async function showWelcome(token, chatId, origin) {
  const caption =
    'Здравствуйте! Это ритуальное агентство «Реквием» в Колпашево.\n\n' +
    'Поможем подобрать памятник, венок, оградку или благоустройство места захоронения. Ответим на вопросы и обсудим стоимость и сроки.\n\n' +
    'Выберите, чем мы можем помочь:';
  const photo = AGENCY.photo;
  try {
    await telegram(token, 'sendPhoto', {
      chat_id: chatId,
      photo,
      caption,
      reply_markup: homeKeyboard(),
    });
  } catch {
    // If the agency site photo is unavailable, the bot still works with a text welcome.
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: caption,
      reply_markup: homeKeyboard(),
    });
  }
}

async function showContacts(token, chatId) {
  const text =
    '☎️ Контакты агентства «Реквием»\n\n' +
    `Телефон: ${AGENCY.phone}\n` +
    `Адрес: ${AGENCY.address}\n\n` +
    'Позвоните нам или напишите — подскажем по услугам, стоимости и срокам.';
  await telegram(token, 'sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Написать в MAX', url: AGENCY.max }],
        [{ text: 'Открыть сайт', url: AGENCY.website }],
        [{ text: 'Google Карты', url: AGENCY.googleMaps }],
        [{ text: '⬅️ В меню', callback_data: 'home' }],
      ],
    },
  });
}

async function getAdminChatId() {
  if (process.env.ADMIN_CHAT_ID) return String(process.env.ADMIN_CHAT_ID);
  const saved = await settings().get('admin-chat', { type: 'json' });
  return saved?.chatId ? String(saved.chatId) : null;
}

async function claimAdmin(token, message) {
  const chatId = String(message.chat.id);
  if (message.chat.type !== 'private') {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: 'Команду /admin нужно отправить в личном чате с ботом.',
    });
    return;
  }
  const store = settings();
  const current = await store.get('admin-chat', { type: 'json' });

  if (!current) {
    const claim = await store.setJSON('admin-chat', {
      chatId,
      userId: String(message.from.id),
      name: userName(message.from),
      username: message.from.username || null,
      claimedAt: new Date().toISOString(),
    }, { onlyIfNew: true });

    if (claim.modified) {
      await telegram(token, 'sendMessage', {
        chat_id: chatId,
        text: '✅ Этот чат назначен администратором. Сюда будут приходить все новые заявки. Теперь можно делиться ссылкой на бота с клиентами.',
      });
      return;
    }
  }

  const latestAdmin = await store.get('admin-chat', { type: 'json' });
  if (String(latestAdmin?.chatId) === chatId) {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: '✅ Вы уже назначены администратором. Все новые заявки приходят сюда.',
    });
    return;
  }

  await telegram(token, 'sendMessage', {
    chat_id: chatId,
    text: 'Администратор уже подключён в другом чате. Команда /admin доступна только при первоначальной настройке.',
  });
}

async function resetAdmin(token, message) {
  const chatId = String(message.chat.id);
  const currentAdmin = await getAdminChatId();
  if (!currentAdmin || currentAdmin !== chatId) {
    await telegram(token, 'sendMessage', {
      chat_id: message.chat.id,
      text: 'Сброс доступен только действующему администратору.',
    });
    return;
  }

  await settings().delete('admin-chat');
  await telegram(token, 'sendMessage', {
    chat_id: message.chat.id,
    text: 'Настройка администратора сброшена. Отправьте /admin из нужного личного чата, чтобы назначить нового получателя заявок.',
  });
}

async function sendLead(token, message) {
  const adminChatId = await getAdminChatId();
  const customer = message.from || {};
  const username = customer.username ? `@${customer.username}` : 'нет username';
  const details = message.text || message.caption || (message.contact ? `Телефон: ${message.contact.phone_number}` : 'Пользователь отправил сообщение без текста.');

  if (!adminChatId) {
    await telegram(token, 'sendMessage', {
      chat_id: message.chat.id,
      text: 'Приём заявок пока не подключён. Позвоните нам: 8 923 415-50-00.\n\nВладелец бота: сначала отправьте команду /admin из своего личного чата с ботом.',
    });
    return;
  }

  const adminText =
    '📩 НОВАЯ ЗАЯВКА — РЕКВИЕМ\n\n' +
    `Имя: ${userName(customer)}\n` +
    `Telegram: ${username}\n` +
    `ID клиента: ${customer.id || 'не указан'}\n\n` +
    `Сообщение:\n${details}`;

  await telegram(token, 'sendMessage', {
    chat_id: adminChatId,
    text: adminText,
    reply_markup: customer.username
      ? { inline_keyboard: [[{ text: 'Ответить клиенту', url: `https://t.me/${customer.username}` }]] }
      : undefined,
  });

  // Also deliver media/contact details when the customer replied with an attachment.
  if (!message.text && !message.caption && (message.photo || message.document || message.voice || message.contact || message.location)) {
    await telegram(token, 'forwardMessage', {
      chat_id: adminChatId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    });
  }

  await telegram(token, 'sendMessage', {
    chat_id: message.chat.id,
    text: 'Спасибо. Ваше обращение отправлено в агентство «Реквием». Мы свяжемся с вами по указанному номеру.\n\nПри необходимости можно позвонить напрямую: 8 923 415-50-00.',
    reply_markup: homeKeyboard(),
  });
}

async function handleMessage(token, message, origin) {
  const chatId = message.chat.id;
  const text = message.text || '';

  if (text.startsWith('/start')) {
    await showWelcome(token, chatId, origin);
    return;
  }

  if (text === '/myid') {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: `Ваш Telegram chat ID: ${chatId}`,
    });
    return;
  }

  if (text === '/admin') {
    await claimAdmin(token, message);
    return;
  }

  if (text === '/resetadmin') {
    await resetAdmin(token, message);
    return;
  }

  if (text === '/contacts') {
    await showContacts(token, chatId);
    return;
  }

  if (text === '/cancel') {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: 'Хорошо, оформление заявки отменено. Чтобы вернуться к меню, отправьте /start.',
      reply_markup: homeKeyboard(),
    });
    return;
  }

  const reply = message.reply_to_message;
  const isRequestReply = Boolean(
    reply?.from?.is_bot && reply?.text === REQUEST_PROMPT,
  );

  if (isRequestReply) {
    await sendLead(token, message);
    return;
  }

  await telegram(token, 'sendMessage', {
    chat_id: chatId,
    text: 'Чтобы оставить заявку, нажмите «Оставить заявку» и ответьте на сообщение бота. Контакты агентства доступны по кнопке ниже.',
    reply_markup: homeKeyboard(),
  });
}

async function handleCallback(token, callback, origin) {
  const chatId = callback.message?.chat?.id;
  if (!chatId) return;

  await telegram(token, 'answerCallbackQuery', { callback_query_id: callback.id });

  if (callback.data === 'request') {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: REQUEST_PROMPT,
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: 'Опишите задачу и укажите телефон',
      },
    });
    return;
  }

  if (callback.data === 'contacts') {
    await showContacts(token, chatId);
    return;
  }

  if (callback.data === 'home') {
    await showWelcome(token, chatId, origin);
  }
}

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Telegram webhook is running.', { status: 200 });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) return new Response('BOT_TOKEN is missing.', { status: 500 });

  const expectedSecret = createHash('sha256').update(token).digest('hex');
  const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!safeSecretEqual(receivedSecret, expectedSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = await request.json();
    const origin = new URL(request.url).origin;

    if (update.callback_query) {
      await handleCallback(token, update.callback_query, origin);
    } else if (update.message) {
      await handleMessage(token, update.message, origin);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response('Webhook processing failed.', { status: 500 });
  }
};
