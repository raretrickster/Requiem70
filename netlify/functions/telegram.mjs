const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = [7330059190, 6796155106];

const SITE = 'https://xn--b1afblipw.com/';
const CATALOG_URL = `${SITE}pamyatniki.html`;
const WORKS_URL = `${SITE}raboty.html`;
const MAX_URL = 'https://max.ru/channel_Rekviem_Kolpashevo';
const YANDEX_MAPS_URL =
  'https://yandex.ru/maps/org/rekviyem/49913383774?si=xnf5r5a8qdq4gzvkf9an2c6q18';

const PHONE = '+7 923 415-50-00';

// Реальные фотографии из портфолио сайта «Реквием».
const WORKS = [
  {
    url: 'https://xn--b1afblipw.com/images/portfolio/work-01.webp',
    title: 'Памятник и благоустройство',
  },
  {
    url: 'https://xn--b1afblipw.com/images/portfolio/work-05.webp',
    title: 'Мемориальный комплекс',
  },
  {
    url: 'https://xn--b1afblipw.com/images/portfolio/work-10.webp',
    title: 'Памятник с оформлением участка',
  },
  {
    url: 'https://xn--b1afblipw.com/images/portfolio/work-15.webp',
    title: 'Памятник и плиточное оформление',
  },
  {
    url: 'https://xn--b1afblipw.com/images/portfolio/work-62.webp',
    title: 'Комплекс с ограждением',
  },
  {
    url: 'https://xn--b1afblipw.com/images/portfolio/work-64.webp',
    title: 'Памятник и художественная ограда',
  },
];

const TIME_OPTIONS = [
  ['time:morning', '09:00–12:00'],
  ['time:midday', '12:00–15:00'],
  ['time:afternoon', '15:00–18:00'],
  ['time:evening', '18:00–21:00'],
  ['time:any', 'В любое время'],
];

const CONTACT_OPTIONS = [
  ['method:call', '📞 Звонок'],
  ['method:telegram', '✈️ Telegram'],
  ['method:max', '💬 MAX'],
  ['method:whatsapp', '🟢 WhatsApp'],
];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function telegram(method, payload) {
  if (!BOT_TOKEN) throw new Error('Не задан BOT_TOKEN');

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram ${method}: ${result.description || response.statusText}`
    );
  }

  return result.result;
}

function sendMessage(chatId, text, replyMarkup) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (replyMarkup) payload.reply_markup = replyMarkup;

  return telegram('sendMessage', payload);
}

// ГЛАВНОЕ МЕНЮ

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '🪦 Каталог памятников',
          url: CATALOG_URL,
        },
      ],
      [
        {
          text: '📸 Примеры выполненных работ',
          callback_data: 'works:0',
        },
      ],
      [
        {
          text: '📩 Оставить заявку',
          callback_data: 'request',
        },
      ],
      [
        {
          text: '💬 MAX',
          url: MAX_URL,
        },
        {
          text: '📍 Мы на карте',
          url: YANDEX_MAPS_URL,
        },
      ],
      [
        {
          text: '🌐 Наш сайт',
          url: SITE,
        },
      ],
    ],
  };
}

function menuText() {
  return [
    '<b>🕯 РИТУАЛЬНОЕ АГЕНТСТВО «РЕКВИЕМ»</b>',
    '',
    'Памятники, мемориальные комплексы и благоустройство мест захоронения.',
    'Поможем выбрать решение, покажем реальные работы и ответим на вопросы.',
    '',
    '<b>Чем можем помочь?</b>',
    '📞 Телефон: +7 923 415-50-00',
    '📍 Колпашево, ул. Победы, 14',
    '',
    'Выберите нужный раздел:',
  ].join('\n');
}

async function showMenu(chatId) {
  return sendMessage(chatId, menuText(), mainMenuKeyboard());
}

// КОНТАКТЫ

async function showContacts(chatId) {
  const text = [
    '<b>📞 Контакты агентства «Реквием»</b>',
    '',
    `Телефон: ${PHONE}`,
    'Адрес: г. Колпашево, ул. Победы, 14',
    `Сайт: ${SITE}`,
    `MAX: ${MAX_URL}`,
  ].join('\n');

  return sendMessage(chatId, text, {
    inline_keyboard: [
      [
        {
          text: '📩 Оставить заявку',
          callback_data: 'request',
        },
      ],
      [
        {
          text: '📍 Яндекс Карты',
          url: YANDEX_MAPS_URL,
        },
      ],
      [
        {
          text: '↩️ Главное меню',
          callback_data: 'menu',
        },
      ],
    ],
  });
}

// ФОТОГАЛЕРЕЯ

function galleryCaption(index) {
  const item = WORKS[index];

  return [
    '<b>Примеры выполненных работ</b>',
    escapeHtml(item.title),
    '',
    'Фото из портфолио агентства «Реквием».',
  ].join('\n');
}

function galleryKeyboard(index) {
  const previous = (index - 1 + WORKS.length) % WORKS.length;
  const next = (index + 1) % WORKS.length;

  return {
    inline_keyboard: [
      [
        {
          text: '⬅️ Назад',
          callback_data: `works:${previous}`,
        },
        {
          text: `${index + 1} / ${WORKS.length}`,
          callback_data: 'noop',
        },
        {
          text: 'Вперёд ➡️',
          callback_data: `works:${next}`,
        },
      ],
      [
        {
          text: '📩 Обсудить заказ',
          callback_data: 'request',
        },
      ],
      [
        {
          text: 'Все работы на сайте',
          url: WORKS_URL,
        },
      ],
      [
        {
          text: '↩️ Главное меню',
          callback_data: 'menu',
        },
      ],
    ],
  };
}

async function showGallery(chatId, index) {
  const safeIndex =
    ((Number(index) || 0) % WORKS.length + WORKS.length) % WORKS.length;

  return telegram('sendPhoto', {
    chat_id: chatId,
    photo: WORKS[safeIndex].url,
    caption: galleryCaption(safeIndex),
    parse_mode: 'HTML',
    reply_markup: galleryKeyboard(safeIndex),
  });
}

async function moveGallery(query, index) {
  const safeIndex =
    ((Number(index) || 0) % WORKS.length + WORKS.length) % WORKS.length;

  return telegram('editMessageMedia', {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    media: {
      type: 'photo',
      media: WORKS[safeIndex].url,
      caption: galleryCaption(safeIndex),
      parse_mode: 'HTML',
    },
    reply_markup: galleryKeyboard(safeIndex),
  });
}

// ЗАЯВКА

function forceReply(placeholder) {
  return {
    force_reply: true,
    selective: true,
    input_field_placeholder: placeholder,
  };
}

async function startRequest(chatId) {
  const text = [
    '<b>📩 Заявка в агентство «Реквием»</b>',
    '',
    '<b>Шаг 1 из 4</b>',
    'Как вас зовут? Напишите имя одним сообщением.',
    '',
    'В любой момент можно написать /cancel, чтобы отменить заявку.',
  ].join('\n');

  return sendMessage(chatId, text, forceReply('Ваше имя'));
}

function fieldFromPrompt(prompt, fieldName) {
  const line = String(prompt || '')
    .split('\n')
    .find((item) => item.startsWith(`${fieldName}:`));

  return line ? line.slice(fieldName.length + 1).trim() : '';
}

function cleanSingleLine(value, maxLength = 80) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function validPhone(value) {
  const phone = String(value || '')
    .replace(/[^0-9+()\-\\s]/g, '')
    .trim();

  const digits = phone.replace(/\D/g, '');

  return digits.length >= 7 && digits.length <= 15
    ? phone
    : '';
}

// ШАГ 2 — ТЕЛЕФОН

async function askPhone(chatId, name) {
  const text = [
    '<b>📩 Заявка — Шаг 2 из 4</b>',
    `Имя: ${escapeHtml(name)}`,
    '',
    'Отправьте номер телефона сообщением.',
    'Можно также прикрепить и отправить свой контакт.',
  ].join('\n');

  return sendMessage(
    chatId,
    text,
    forceReply('Например, +7 900 000-00-00')
  );
}

// ШАГ 3 — ВРЕМЯ

async function askTime(chatId, name, phone) {
  const text = [
    '<b>📩 Заявка — Шаг 3 из 4</b>',
    `Имя: ${escapeHtml(name)}`,
    `Телефон: ${escapeHtml(phone)}`,
    '',
    'Когда вам удобно, чтобы мы связались?',
  ].join('\n');

  return sendMessage(chatId, text, {
    inline_keyboard: [
      TIME_OPTIONS.slice(0, 2).map(([data, label]) => ({
        text: label,
        callback_data: data,
      })),
      TIME_OPTIONS.slice(2, 4).map(([data, label]) => ({
        text: label,
        callback_data: data,
      })),
      [
        {
          text: TIME_OPTIONS[4][1],
          callback_data: TIME_OPTIONS[4][0],
        },
      ],
      [
        {
          text: '✖️ Отменить заявку',
          callback_data: 'cancel',
        },
      ],
    ],
  });
}

// ШАГ 4 — СПОСОБ СВЯЗИ

async function askContactMethod(chatId, name, phone, time) {
  const text = [
    '<b>📩 Заявка — Шаг 4 из 4</b>',
    `Имя: ${escapeHtml(name)}`,
    `Телефон: ${escapeHtml(phone)}`,
    `Удобное время: ${escapeHtml(time)}`,
    '',
    'Как вам удобнее получить ответ?',
  ].join('\n');

  return sendMessage(chatId, text, {
    inline_keyboard: [
      CONTACT_OPTIONS.slice(0, 2).map(([data, label]) => ({
        text: label,
        callback_data: data,
      })),
      CONTACT_OPTIONS.slice(2, 4).map(([data, label]) => ({
        text: label,
        callback_data: data,
      })),
      [
        {
          text: '✖️ Отменить заявку',
          callback_data: 'cancel',
        },
      ],
    ],
  });
}

// ОТПРАВКА ЗАЯВКИ АДМИНИСТРАТОРАМ

async function submitRequest(query, method) {
  const prompt = query.message.text || '';

  const name = fieldFromPrompt(prompt, 'Имя');
  const phone = fieldFromPrompt(prompt, 'Телефон');
  const time = fieldFromPrompt(prompt, 'Удобное время');

  const methods = {
    call: 'Звонок',
    telegram: 'Telegram',
    max: 'MAX',
    whatsapp: 'WhatsApp',
  };

  const methodName = methods[method];

  if (!name || !phone || !time || !methodName) {
    return sendMessage(
      query.message.chat.id,
      'Не удалось прочитать данные заявки. Пожалуйста, начните заполнение заново.',
      {
        inline_keyboard: [
          [
            {
              text: '📩 Заполнить заявку',
              callback_data: 'request',
            },
          ],
        ],
      }
    );
  }

  const requester = query.from;

  const usernameLink = requester.username
    ? `@${escapeHtml(requester.username)}`
    : `<a href="tg://user?id=${requester.id}">открыть профиль в Telegram</a>`;

  const adminText = [
    '<b>🔔 Новая заявка — «Реквием»</b>',
    '',
    `Имя: <b>${escapeHtml(name)}</b>`,
    `Телефон: <b>${escapeHtml(phone)}</b>`,
    `Удобное время: <b>${escapeHtml(time)}</b>`,
    `Способ связи: <b>${escapeHtml(methodName)}</b>`,
    '',
    `Клиент в Telegram: ${usernameLink}`,
    `Telegram ID: <code>${requester.id}</code>`,
  ].join('\n');

  const deliveries = await Promise.allSettled(
    ADMIN_IDS.map((adminId) =>
      sendMessage(adminId, adminText, {
        inline_keyboard: [
          [
            {
              text: 'Открыть переписку с клиентом',
              url: `tg://user?id=${requester.id}`,
            },
          ],
        ],
      })
    )
  );

  const delivered = deliveries.filter(
    (item) => item.status === 'fulfilled'
  ).length;

  console.log(
    `Request notification delivered to ${delivered}/${ADMIN_IDS.length} admins`
  );

  await sendMessage(
    query.message.chat.id,
    delivered > 0
      ? '✅ <b>Спасибо! Заявка отправлена.</b>\nМы свяжемся с вами выбранным способом в удобное время.'
      : '✅ <b>Заявка принята.</b>\nУведомление администраторам не прошло. Пожалуйста, позвоните нам: +7 923 415-50-00.',
    {
      inline_keyboard: [
        [
          {
            text: '↩️ В главное меню',
            callback_data: 'menu',
          },
        ],
      ],
    }
  );
}

// ОБРАБОТКА СООБЩЕНИЙ

async function handleMessage(message) {
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const text = String(message.text || '').trim();

  if (text === '/start' || text.startsWith('/start ')) {
    await showMenu(chatId);
    return;
  }

  if (text === '/cancel') {
    await sendMessage(
      chatId,
      'Заявка отменена. Вы можете начать заново в любой момент.',
      mainMenuKeyboard()
    );
    return;
  }

  if (text === '/admin') {
    if (!ADMIN_IDS.includes(fromId)) {
      await sendMessage(chatId, 'Команда недоступна.');
      return;
    }

    await sendMessage(
      chatId,
      '✅ Вы авторизованы как администратор. Новые заявки будут приходить сюда.'
    );
    return;
  }

  if (text === '/resetadmin') {
    if (!ADMIN_IDS.includes(fromId)) {
      await sendMessage(chatId, 'Команда недоступна.');
      return;
    }

    await sendMessage(
      chatId,
      'Настройки администратора не требуют сброса. Список разрешённых ID зафиксирован в коде.'
    );
    return;
  }

  const repliedPrompt = message.reply_to_message?.from?.is_bot
    ? (message.reply_to_message.text ||
       message.reply_to_message.caption ||
       '')
    : '';

  // ШАГ 1 — ИМЯ

  if (repliedPrompt.includes('Шаг 1 из 4')) {
    const name = cleanSingleLine(text, 60);

    if (!name) {
      await startRequest(chatId);
      return;
    }

    await askPhone(chatId, name);
    return;
  }

  // ШАГ 2 — ТЕЛЕФОН

  if (repliedPrompt.includes('Шаг 2 из 4')) {
    const name = fieldFromPrompt(repliedPrompt, 'Имя');

    if (
      message.contact?.user_id &&
      message.contact.user_id !== fromId
    ) {
      await askPhone(chatId, name);
      return;
    }

    const phone = validPhone(
      message.contact?.phone_number || text
    );

    if (!phone || !name) {
      await askPhone(chatId, name);
      return;
    }

    await askTime(chatId, name, phone);
    return;
  }

  if (text && !text.startsWith('/')) {
    await sendMessage(
      chatId,
      'Чтобы посмотреть услуги или оставить заявку, воспользуйтесь меню ниже.',
      mainMenuKeyboard()
    );
  }
}

// ОБРАБОТКА КНОПОК

async function handleCallback(query) {
  const data = String(query.data || '');
  const chatId = query.message?.chat?.id;

  await telegram('answerCallbackQuery', {
    callback_query_id: query.id,
  }).catch(() => {});

  if (!chatId) return;

  if (data === 'noop') return;

  if (data === 'menu') {
    return showMenu(chatId);
  }

  if (data === 'request' || data === 'request:start') {
    return startRequest(chatId);
  }

  if (data === 'cancel') {
    return sendMessage(
      chatId,
      'Заявка отменена. Вы можете вернуться к заполнению позже.',
      mainMenuKeyboard()
    );
  }

  if (data.startsWith('works:')) {
    const index = Number(data.split(':')[1]);

    if (query.message.photo?.length) {
      return moveGallery(query, index);
    }

    return showGallery(chatId, index);
  }

  if (data.startsWith('time:')) {
    const prompt = query.message.text || '';

    const name = fieldFromPrompt(prompt, 'Имя');
    const phone = fieldFromPrompt(prompt, 'Телефон');

    const key = data.split(':')[1];

    const timeMap = Object.fromEntries(
      TIME_OPTIONS.map(([callback, label]) => [
        callback.split(':')[1],
        label,
      ])
    );

    const time = timeMap[key];

    if (!name || !phone || !time) {
      return sendMessage(
        chatId,
        'Не удалось продолжить заявку. Начните заполнение заново.',
        {
          inline_keyboard: [
            [
              {
                text: '📩 Заполнить заявку',
                callback_data: 'request',
              },
            ],
          ],
        }
      );
    }

    return askContactMethod(chatId, name, phone, time);
  }

  if (data.startsWith('method:')) {
    return submitRequest(query, data.split(':')[1]);
  }
}

// WEBHOOK — АДРЕС И ПОДКЛЮЧЕНИЕ НЕ МЕНЯЮТСЯ

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Requiem Telegram bot is running', {
      status: 200,
    });
  }

  const expectedSecret =
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.TELEGRAM_SECRET_TOKEN ||
    process.env.WEBHOOK_SECRET;

  if (expectedSecret) {
    const receivedSecret = request.headers.get(
      'x-telegram-bot-api-secret-token'
    );

    if (receivedSecret !== expectedSecret) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  try {
    const update = await request.json();

    if (update.message) {
      await handleMessage(update.message);
    }

    if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
  } catch (error) {
    console.error('Telegram handler error:', error);
  }

  return new Response('OK', { status: 200 });
};
