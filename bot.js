const TelegramBot = require('node-telegram-bot-api');
const { sequelize, User } = require('./database');
require('dotenv').config();

// Логирование
const log = console.log;

// Токен бота
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Функция старта
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Получить информацию', callback_data: 'get_info' }]
      ]
    }
  };

  bot.sendMessage(chatId, 'Нажмите на кнопку ниже, чтобы получить информацию о приобретенных билетах.', opts);
});

// Обработчик нажатия на кнопку
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (callbackQuery.data === 'get_info') {
    bot.sendMessage(chatId, 'Пожалуйста, введите ваш email:');
    bot.once('message', async (msg) => {
      const userEmail = msg.text;

      try {
        await sequelize.authenticate();
        log('Connection has been established successfully.');

        const user = await User.findOne({ where: { email: userEmail } });
        if (user) {
          bot.sendMessage(chatId, `Имя: ${user.name}\nEmail: ${user.email}`);
        } else {
          bot.sendMessage(chatId, 'Пользователь не найден.');
        }
      } catch (error) {
        log('Unable to connect to the database:', error);
        bot.sendMessage(chatId, 'Произошла ошибка при обработке запроса.');
      }
    });
  }
});

log('Bot has been started...');