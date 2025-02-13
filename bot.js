const TelegramBot = require('node-telegram-bot-api');
const { sequelize, User } = require('./database');
const axios = require('axios');
require('dotenv').config();

// Логирование
const log = console.log;

// Токен бота
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = new TelegramBot(token, { polling: true });

// Хранение сообщений для удаления при рестарте и очистке
let messagesToDelete = [];

// Функция старта
const startBot = (chatId) => {
  const welcomeMessage = 'Центр Конференций Сегодня приветствует вас - evtoday.ru';
  const opts = {
    reply_markup: {
      keyboard: [
        [{ text: 'Авторизация' }, { text: 'Список мероприятий' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };

  bot.sendMessage(chatId, welcomeMessage, opts).then((sentMessage) => {
    messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
  });
};

// Функция очистки чата
const clearChat = async (chatId) => {
  for (const message of messagesToDelete) {
    if (message.chatId === chatId) {
      try {
        await bot.deleteMessage(chatId, message.messageId);
      } catch (err) {
        log(`Failed to delete message ${message.messageId}:`, err);
      }
    }
  }
  messagesToDelete = messagesToDelete.filter(message => message.chatId !== chatId);
};

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  startBot(chatId);
});

// Обработчик команды /clear
bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  await clearChat(chatId);
  bot.sendMessage(chatId, 'Чат был очищен.');
});

// Обработчик текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === 'Список мероприятий') {
    try {
      const response = await axios.get('https://evtoday.ru/api/calendar/');
      const events = response.data;

      let eventsMessage = 'Календарь мероприятий:\n\n';
      events.forEach(event => {
        eventsMessage += `Название: ${event.event_headline || 'не указано'}\nДата: ${event.event_date || 'не указана'}\nОписание: ${event.event_short_description || 'не указано'}\n\n`;
      });

      bot.sendMessage(chatId, eventsMessage).then((sentMessage) => {
        messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
      });
    } catch (error) {
      bot.sendMessage(chatId, 'Не удалось загрузить календарь мероприятий.').then((sentMessage) => {
        messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
      });
      log('Error fetching events:', error);
    }
  } else if (text === 'Авторизация') {
    bot.sendMessage(chatId, 'Пожалуйста, введите ваш email:').then((sentMessage) => {
      messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
      bot.once('message', async (msg) => {
        const userEmail = msg.text;
        messagesToDelete.push({ chatId, messageId: msg.message_id });

        try {
          await sequelize.authenticate();
          log('Connection has been established successfully.');

          const user = await User.findOne({ where: { email: userEmail } });
          if (user) {
            const opts = {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Список билетов', callback_data: 'list_tickets' }]
                ]
              }
            };
            bot.sendMessage(chatId, `Имя: ${user.name}\nEmail: ${user.email}`, opts).then((sentMessage) => {
              messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
            });
          } else {
            bot.sendMessage(chatId, 'Пользователь не найден.').then((sentMessage) => {
              messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
            });
          }
        } catch (error) {
          log('Unable to connect to the database:', error);
          bot.sendMessage(chatId, 'Произошла ошибка при обработке запроса.').then((sentMessage) => {
            messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
          });
        }
      });
    });
  }
});

// Обработчик нажатия на кнопку
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (callbackQuery.data === 'list_tickets') {
    bot.sendMessage(chatId, 'Функционал списка билетов пока не реализован.').then((sentMessage) => {
      messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
    });
  }
});

// Команда для перезапуска бота
bot.onText(/\/restart/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Бот перезапускается...').then(async () => {
    // Удаление всех предыдущих сообщений
    await clearChat(chatId);

    // Останавливаем текущий экземпляр бота
    bot.stopPolling();

    // Создаем новый экземпляр бота
    bot = new TelegramBot(token, { polling: true });

    // Перезапуск функций
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      startBot(chatId);
    });

    bot.onText(/\/clear/, async (msg) => {
      const chatId = msg.chat.id;
      await clearChat(chatId);
      bot.sendMessage(chatId, 'Чат был очищен.');
    });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (text === 'Список мероприятий') {
        try {
          const response = await axios.get('https://evtoday.ru/api/calendar/');
          const events = response.data;

          let eventsMessage = 'Календарь мероприятий:\n\n';
          events.forEach(event => {
            eventsMessage += `Название: ${event.event_headline || 'не указано'}\nДата: ${event.event_date || 'не указана'}\nОписание: ${event.event_short_description || 'не указано'}\n\n`;
          });

          bot.sendMessage(chatId, eventsMessage).then((sentMessage) => {
            messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
          });
        } catch (error) {
          bot.sendMessage(chatId, 'Не удалось загрузить календарь мероприятий.').then((sentMessage) => {
            messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
          });
          log('Error fetching events:', error);
        }
      } else if (text === 'Авторизация') {
        bot.sendMessage(chatId, 'Пожалуйста, введите ваш email:').then((sentMessage) => {
          messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
          bot.once('message', async (msg) => {
            const userEmail = msg.text;
            messagesToDelete.push({ chatId, messageId: msg.message_id });

            try {
              await sequelize.authenticate();
              log('Connection has been established successfully.');

              const user = await User.findOne({ where: { email: userEmail } });
              if (user) {
                const opts = {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: 'Список билетов', callback_data: 'list_tickets' }]
                    ]
                  }
                };
                bot.sendMessage(chatId, `Имя: ${user.name}\nEmail: ${user.email}`, opts).then((sentMessage) => {
                  messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
                });
              } else {
                bot.sendMessage(chatId, 'Пользователь не найден.').then((sentMessage) => {
                  messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
                });
              }
            } catch (error) {
              log('Unable to connect to the database:', error);
              bot.sendMessage(chatId, 'Произошла ошибка при обработке запроса.').then((sentMessage) => {
                messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
              });
            }
          });
        });
      }
    });

    bot.on('callback_query', async (callbackQuery) => {
      const msg = callbackQuery.message;
      const chatId = msg.chat.id;

      if (callbackQuery.data === 'list_tickets') {
        bot.sendMessage(chatId, 'Функционал списка билетов пока не реализован.').then((sentMessage) => {
          messagesToDelete.push({ chatId, messageId: sentMessage.message_id });
        });
      }
    });

    // Автоматический запуск команды /start после перезапуска
    startBot(chatId);

    log('Bot has been restarted...');
  });
});

log('Bot has been started...');
