import { createHash, timingSafeEqual } from 'node:crypto';

const TELEGRAM_API = 'https://api.telegram.org';

const AGENCY = {
  name: 'Реквием',
  phone: '8 923 415-50-00',
  phoneLink: '+79234155000',
  address: 'Томская область, г. Колпашево, ул. Победы, 14',
  website: 'https://xn--b1afblipw.com/',
  max: 'https://max.ru/channel_Rekviem_Kolpashevo',
  googleMaps: 'https://maps.app.goo.gl/8yVRZFU5q4je6Fxr6',
  photo: 'https://xn--b1afblipw.com/images/works/work17.jpg',
};

const REQUEST_PROMPT =
  'Пожалуйста, ответьте на это сообщение одним сообщением. Опишите, что вам нужно, и оставьте номер телефона для связи. [Заявка в Реквием]';

// ДВА РАЗРЕШЁННЫХ АДМИНИСТРАТОРА
const ADMIN_IDS = new Set([
  '7330059190',
  '6796155106',
]);

async function telegram(token, method, payload = {}) {
  const response = await fetch(
    `${TELEGRAM_API}/bot${token}/${method}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || `Telegram API error (${response.status})`
    );
  }

  return result.result;
}

function safeSecretEqual(received, expected) {
  if (
    typeof received !== 'string' ||
    !received ||
    received.length !== expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(received),
    Buffer.from(expected)
  );
}

function userName(user = {}) {
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    'Не указано'
  );
}

function homeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📩 Оставить заявку', callback_data: 'request' }],
      [{ text: '☎️ Контакты', callback_data: 'contacts' }],
    ],
  };
}

async function showWelcome(token, chatId) {
  const caption =
    'Здравствуйте! Это ритуальное агентство «Реквием» в Колпашево.\n\n' +
    'Поможем подобрать памятник, венок, оградку или благоустройство места захоронения. Ответим на вопросы и обсудим стоимость и сроки.\n\n' +
    'Выберите, чем мы можем помочь:';

  try {
    await telegram(token, 'sendPhoto', {
      chat_id: chatId,
      photo: AGENCY.photo,
      caption,
      reply_markup: homeKeyboard(),
    });
  } catch {
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

function isAllowedAdmin(message) {
  return (
    message.chat?.type === 'private' &&
    ADMIN_IDS.has(String(message.from?.id))
  );
}

async function claimAdmin(token, message) {
  const chatId = message.chat.id;

  if (!isAllowedAdmin(message)) {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: '⛔ Доступ запрещён. Ваш аккаунт не входит в список администраторов.',
    });
    return;
  }

  await telegram(token, 'sendMessage', {
    chat_id: chatId,
    text: '✅ Ваш аккаунт подтверждён как администратор. Все новые заявки будут приходить вам и второму администратору.',
  });
}

async function resetAdmin(token, message) {
  const chatId = message.chat.id;

  if (!isAllowedAdmin(message)) {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: '⛔ Эта команда доступна только администраторам.',
    });
    return;
  }

  await telegram(token, 'sendMessage', {
    chat_id: chatId,
    text: 'Список администраторов защищён в коде бота. Для изменения доступа нужно изменить ADMIN_IDS в telegram.mjs.',
  });
}

async function sendLead(token, message) {
  const customer = message.from || {};

  const username = customer.username
    ? `@${customer.username}`
    : 'нет username';

  const details =
    message.text ||
    message.caption ||
    (message.contact
      ? `Телефон: ${message.contact.phone_number}`
      : 'Пользователь отправил сообщение без текста.');

  const adminText =
    '📩 НОВАЯ ЗАЯВКА — РЕКВИЕМ\n\n' +
    `Имя: ${userName(customer)}\n` +
    `Telegram: ${username}\n` +
    `ID клиента: ${customer.id || 'не указан'}\n\n` +
    `Сообщение:\n${details}`;

  let delivered = 0;

  for (const adminChatId of ADMIN_IDS) {
    try {
      await telegram(token, 'sendMessage', {
        chat_id: adminChatId,
        text: adminText,
        reply_markup: customer.username
          ? {
              inline_keyboard: [[
                {
                  text: 'Ответить клиенту',
                  url: `https://t.me/${customer.username}`,
                },
              ]],
            }
          : undefined,
      });

      if (
        !message.text &&
        !message.caption &&
        (
          message.photo ||
          message.document ||
          message.voice ||
          message.contact ||
          message.location
        )
      ) {
        await telegram(token, 'forwardMessage', {
          chat_id: adminChatId,
          from_chat_id: message.chat.id,
          message_id: message.message_id,
        });
      }

      delivered++;
    } catch (error) {
      console.error(
        `Could not deliver lead to admin ${adminChatId}:`,
        error
      );
    }
  }

  if (delivered === 0) {
    throw new Error('Could not deliver the lead to either administrator.');
  }

  await telegram(token, 'sendMessage', {
    chat_id: message.chat.id,
    text:
      'Спасибо. Ваше обращение отправлено в агентство «Реквием». Мы свяжемся с вами по указанному номеру.\n\n' +
      'При необходимости можно позвонить напрямую: 8 923 415-50-00.',
    reply_markup: homeKeyboard(),
  });
}

async function handleMessage(token, message) {
  const chatId = message.chat.id;
  const text = message.text || '';

  if (text.startsWith('/start')) {
    await showWelcome(token, chatId);
    return;
  }

  if (text === '/myid') {
    await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: `Ваш Telegram ID: ${message.from?.id}`,
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
    reply?.from?.is_bot &&
    reply?.text === REQUEST_PROMPT
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

async function handleCallback(token, callback) {
  const chatId = callback.message?.chat?.id;

  if (!chatId) return;

  await telegram(token, 'answerCallbackQuery', {
    callback_query_id: callback.id,
  });

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
    await showWelcome(token, chatId);
  }
}

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Telegram webhook is running.', {
      status: 200,
    });
  }

  const token = process.env.BOT_TOKEN;

  if (!token) {
    return new Response('BOT_TOKEN is missing.', {
      status: 500,
    });
  }

  const expectedSecret = createHash('sha256')
    .update(token)
    .digest('hex');

  const receivedSecret = request.headers.get(
    'x-telegram-bot-api-secret-token'
  );

  if (!safeSecretEqual(receivedSecret, expectedSecret)) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  try {
    const update = await request.json();

    if (update.callback_query) {
      await handleCallback(token, update.callback_query);
    } else if (update.message) {
      await handleMessage(token, update.message);
    }

    return new Response('OK', {
      status: 200,
    });

  } catch (error) {
    console.error('Telegram webhook error:', error);

    return new Response('Webhook processing failed.', {
      status: 500,
    });
  }
};
