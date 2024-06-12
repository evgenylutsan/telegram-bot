const TelegramBot = require('node-telegram-bot-api');
const { sequelize, User } = require('./database');
require('dotenv').config();

// Логирование
const log = console.log;

// Токен бота
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = new TelegramBot(token, { polling: true });

// Хранение сообщений для удаления при рестарте
let messagesToDelete = [];

// Функция старта
const startBot = (chatId) => {
  const welcomeMessage = 'Центр Конференций Сегодня приветствует вас - evtoday.ru';
  bot.sendMessage(chatId, welcomeMessage).then((sentMessage) => {
    messagesToDelete.push(sentMessage.message_id);

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Календарь мероприятий', callback_data: 'calendar' }],
          [{ text: 'Авторизация по почте', callback_data: 'auth_by_email' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Выберите один из вариантов ниже:', opts).then((sentMessage) => {
      messagesToDelete.push(sentMessage.message_id);
    });
  });
};

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  startBot(chatId);
});

// Обработчик нажатия на кнопку
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (callbackQuery.data === 'calendar') {
    bot.sendMessage(chatId, 'Календарь мероприятий пока не реализован.');
  } else if (callbackQuery.data === 'auth_by_email') {
    bot.sendMessage(chatId, 'Пожалуйста, введите ваш email:');
    bot.once('message', async (msg) => {
      const userEmail = msg.text;

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
          bot.sendMessage(chatId, `Имя: ${user.name}\nEmail: ${user.email}`, opts);
        } else {
          bot.sendMessage(chatId, 'Пользователь не найден.');
        }
      } catch (error) {
        log('Unable to connect to the database:', error);
        bot.sendMessage(chatId, 'Произошла ошибка при обработке запроса.');
      }
    });
  } else if (callbackQuery.data === 'list_tickets') {
    bot.sendMessage(chatId, 'Функционал списка билетов пока не реализован.');
  }
});

// Команда для перезапуска бота
bot.onText(/\/restart/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Бот перезапускается...').then(() => {
    // Удаление всех предыдущих сообщений
    messagesToDelete.forEach((messageId) => {
      bot.deleteMessage(chatId, messageId).catch((err) => log('Failed to delete message:', err));
    });
    messagesToDelete = [];

    // Останавливаем текущий экземпляр бота
    bot.stopPolling();

    // Создаем новый экземпляр бота
    bot = new TelegramBot(token, { polling: true });

    // Перезапуск функций
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      startBot(chatId);
    });

    bot.on('callback_query', async (callbackQuery) => {
      const msg = callbackQuery.message;
      const chatId = msg.chat.id;

      if (callbackQuery.data === 'calendar') {
        bot.sendMessage(chatId, 'Календарь мероприятий пока не реализован.');
      } else if (callbackQuery.data === 'auth_by_email') {
        bot.sendMessage(chatId, 'Пожалуйста, введите ваш email:');
        bot.once('message', async (msg) => {
          const userEmail = msg.text;

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
              bot.sendMessage(chatId, `Имя: ${user.name}\nEmail: ${user.email}`, opts);
            } else {
              bot.sendMessage(chatId, 'Пользователь не найден.');
            }
          } catch (error) {
            log('Unable to connect to the database:', error);
            bot.sendMessage(chatId, 'Произошла ошибка при обработке запроса.');
          }
        });
      } else if (callbackQuery.data === 'list_tickets') {
        bot.sendMessage(chatId, 'Функционал списка билетов пока не реализован.');
      }
    });

    // Автоматический запуск команды /start после перезапуска
    startBot(chatId);

    log('Bot has been restarted...');
  });
});

log('Bot has been started...');
