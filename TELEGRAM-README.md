# QR Scanner для Telegram Web App

🤖 **Специализированная версия QR сканера для интеграции с Telegram ботами**

## 🚀 Демо

**[Telegram Web App](https://alfagen12.github.io/QR_ZXing/telegram-scanner.html)**

## ✨ Особенности Telegram версии

### 🎯 Оптимизации для QR кодов:
- 📐 **Квадратное окно сканирования** (300x300px) для QR кодов
- 🎵 **Увеличенная громкость** звукового сигнала
- 📱 **Автоматическое закрытие камеры** после успешного сканирования
- 🚪 **Кнопка "Закрыть"** вместо "Остановить сканер"

### 💳 Платежная интеграция:
- 🎯 **Модальное окно оплаты** с кнопкой "Оплатить"
- 🔗 **Webhook интеграция** для отправки данных
- 📤 **JSON payload** с отсканированными данными
- 🔄 **Автоматическое закрытие** приложения после оплаты

### 🤖 Telegram Web App API:
- 🎭 **Haptic feedback** для тактильных ощущений
- 🎨 **Telegram темы** через CSS переменные
- 📱 **Главная кнопка** Telegram для закрытия
- 🔄 **Safe area** поддержка для современных устройств
- 🌐 **Передача данных пользователя** в webhook

## 🔧 Webhook формат

### Endpoint:
```
POST https://pay4kaz.space/webhook/04a25c25-4aa8-4688-b395-a1681641552b
```

### JSON payload:
```json
{
  "qr_data": "отсканированная строка",
  "timestamp": "2025-07-31T12:00:00.000Z",
  "user_agent": "Mozilla/5.0...",
  "telegram_data": {
    "user": {
      "id": 123456789,
      "first_name": "John",
      "username": "john_doe"
    },
    "chat": {
      "id": -987654321,
      "type": "private"
    },
    "start_param": "payment_123"
  }
}
```

## 📱 Интеграция с Telegram ботом

### 1. Создание Web App кнопки:
```python
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

def create_scanner_button():
    keyboard = [
        [InlineKeyboardButton(
            "📷 Сканировать QR", 
            web_app=WebAppInfo(url="https://alfagen12.github.io/QR_ZXing/telegram-scanner.html")
        )]
    ]
    return InlineKeyboardMarkup(keyboard)

# Использование
await update.message.reply_text(
    "Нажмите кнопку для сканирования QR-кода:",
    reply_markup=create_scanner_button()
)
```

### 2. Обработка webhook данных:
```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook/04a25c25-4aa8-4688-b395-a1681641552b', methods=['POST'])
def handle_payment():
    data = request.json
    
    qr_data = data['qr_data']
    telegram_user = data['telegram_data']['user']
    
    # Обработка платежных данных
    process_payment(qr_data, telegram_user)
    
    return jsonify({"status": "success"})
```

## 🎨 Кастомизация

### CSS переменные Telegram:
```css
/* Автоматически подстраивается под тему Telegram */
background: var(--tg-theme-bg-color, #ffffff);
color: var(--tg-theme-text-color, #000000);
button: var(--tg-theme-button-color, #667eea);
```

### Размеры сканера:
```css
#video {
    width: 100%;
    max-width: 300px;
    height: 300px; /* Квадратное соотношение */
}
```

## 📦 Быстрая установка

### 1. Скачать файлы:
```bash
wget https://alfagen12.github.io/QR_ZXing/telegram-scanner.html
wget https://alfagen12.github.io/QR_ZXing/telegram-style.css
wget https://alfagen12.github.io/QR_ZXing/telegram-script.js
```

### 2. Изменить webhook URL:
```javascript
// В telegram-script.js найдите и измените:
this.webhookUrl = 'https://your-server.com/webhook/your-token';
```

### 3. Настроить Telegram бота:
```python
# Добавить Web App URL в вашего бота
web_app_url = "https://your-domain.com/telegram-scanner.html"
```

## 🛡️ Безопасность

- ✅ **HTTPS обязательно** для работы камеры
- 🔐 **Уникальный webhook токен** в URL
- 📱 **Telegram данные пользователя** для верификации
- 🕐 **Timestamp** для предотвращения replay атак

## 🔍 Отладка

### Консольные логи:
```javascript
// Включены подробные логи для отладки
console.log('QR code scanned:', result);
console.log('Sending payment data:', payload);
console.log('Telegram user:', this.tg.initDataUnsafe?.user);
```

### Тестирование без Telegram:
- Приложение работает в обычном браузере
- Telegram API функции безопасно отключаются
- Webhook все равно отправляется с user_agent данными

---

**🚀 Готово к интеграции с Telegram ботами | 💳 Оптимизировано для платежей | 📱 Мобильно-адаптивно**
