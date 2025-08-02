class TelegramQRScanner {
    constructor() {
        this.version = '2.1';
        this.codeReader = new ZXing.BrowserQRCodeReader();
        this.selectedDeviceId = null;
        this.isScanning = false;
        this.stream = null;
        this.isMobile = this.detectMobile();
        this.webhookUrl = 'https://n8n.pay4kaz.space/webhook/04a25c25-4aa8-4688-b395-a1681641552b';
        
        // Инициализируем Telegram Web App
        this.initTelegramWebApp();
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkCameraSupport();
    }

    initTelegramWebApp() {
        // Проверяем доступность Telegram Web App API
        if (window.Telegram && window.Telegram.WebApp) {
            this.tg = window.Telegram.WebApp;
            
            // Настраиваем Telegram Web App
            this.tg.expand(); // Расширяем на весь экран
            this.tg.enableClosingConfirmation(); // Подтверждение закрытия
            
            // Настраиваем главную кнопку
            this.tg.MainButton.setText('Закрыть');
            this.tg.MainButton.color = '#FF3B30';
            this.tg.MainButton.textColor = '#FFFFFF';
            
            // Обработчик главной кнопки
            this.tg.MainButton.onClick(() => {
                this.closeApp();
            });
            
            console.log('Telegram Web App initialized');
        } else {
            console.warn('Telegram Web App API not available');
            this.tg = null;
        }
    }

    detectMobile() {
        const userAgent = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        const isAndroid = /Android/i.test(userAgent);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        
        // Сохраняем информацию о типе устройства
        this.isIOS = isIOS;
        this.isAndroid = isAndroid;
        
        return isMobile;
    }

    initializeElements() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.switchCameraBtn = document.getElementById('switchCameraBtn');
        this.cameraSelect = document.getElementById('cameraSelect');
        this.testWebhookBtn = document.getElementById('testWebhookBtn');
        
        // Payment modal elements
        this.paymentModal = document.getElementById('paymentModal');
        this.paymentData = document.getElementById('paymentData');
        this.payBtn = document.getElementById('payBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        
        this.scannedData = null;
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.requestCameraAndStart());
        this.stopBtn.addEventListener('click', () => this.closeApp());
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.testWebhookBtn.addEventListener('click', () => this.testWebhook());
        this.cameraSelect.addEventListener('change', (e) => {
            this.selectedDeviceId = e.target.value;
            if (this.isScanning) {
                this.stopScanning();
                setTimeout(() => this.startScanning(), 100);
            }
        });
        
        // Payment modal handlers
        this.payBtn.addEventListener('click', () => this.processPayment());
        this.cancelBtn.addEventListener('click', () => this.hidePaymentModal());
        
        // iOS специфичные обработчики событий
        if (this.isIOS) {
            // Предотвращаем зум при двойном тапе
            document.addEventListener('gesturestart', (e) => e.preventDefault());
            document.addEventListener('gesturechange', (e) => e.preventDefault());
            document.addEventListener('gestureend', (e) => e.preventDefault());
            
            // Улучшенная обработка касаний для iOS
            this.video.addEventListener('touchstart', (e) => {
                e.preventDefault();
            }, { passive: false });
        }
    }

    async checkCameraSupport() {
        try {
            // Проверяем поддержку камеры
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera API not supported');
            }

            // Проверяем HTTPS
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                this.showError('Камера работает только по HTTPS. Откройте сайт по защищенному соединению.');
                return;
            }

            // Проверяем доступность webhook (необязательно, но полезно для диагностики)
            this.checkWebhookAvailability();

            // Загружаем список камер
            await this.loadCameras();
            
            // На мобильных устройствах автоматически запускаем камеру
            if (this.isMobile) {
                console.log('Mobile device detected, auto-starting camera...');
                setTimeout(() => {
                    this.requestCameraAndStart();
                }, 500);
            }
            
        } catch (error) {
            console.error('Camera support check failed:', error);
            this.showError('Камера не поддерживается или недоступна');
        }
    }

    async checkWebhookAvailability() {
        try {
            console.log('Checking webhook availability:', this.webhookUrl);
            
            // Делаем простой HEAD запрос для проверки доступности
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(this.webhookUrl, {
                method: 'HEAD',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            console.log('Webhook check response:', response.status);
            
        } catch (error) {
            console.warn('Webhook availability check failed:', error.message);
            // Не блокируем приложение, если webhook недоступен для проверки
        }
    }

    async requestCameraAndStart() {
        try {
            // Сначала запрашиваем разрешение на камеру
            let constraints = {
                video: {
                    facingMode: this.isMobile ? { ideal: 'environment' } : 'user', // Предпочитаем заднюю камеру на мобильном
                    width: { ideal: 1280 },
                    height: { ideal: 1280 } // Квадратное соотношение для QR
                }
            };

            // Для iOS добавляем дополнительные ограничения
            if (this.isIOS) {
                constraints.video = {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 1280, max: 1920 }, // Квадратное соотношение
                    frameRate: { ideal: 30, max: 30 }
                };
                console.log('iOS device detected, using optimized constraints');
            }

            const permissionStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Останавливаем тестовый поток
            permissionStream.getTracks().forEach(track => track.stop());
            
            // Теперь загружаем камеры и запускаем сканирование
            await this.loadCameras();
            await this.startScanning();
            
        } catch (error) {
            console.error('Camera permission error:', error);
            
            // Если не удалось получить заднюю камеру, пробуем любую доступную
            if (this.isMobile && error.name === 'OverconstrainedError') {
                try {
                    let fallbackConstraints;
                    
                    if (this.isIOS) {
                        // Для iOS используем минимальные ограничения
                        fallbackConstraints = {
                            video: {
                                width: { ideal: 640 },
                                height: { ideal: 640 } // Квадратное соотношение
                            }
                        };
                        console.log('Using iOS fallback constraints');
                    } else {
                        fallbackConstraints = {
                            video: {
                                width: { ideal: 1280 },
                                height: { ideal: 1280 } // Квадратное соотношение
                            }
                        };
                    }
                    
                    const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                    fallbackStream.getTracks().forEach(track => track.stop());
                    
                    await this.loadCameras();
                    await this.startScanning();
                    
                } catch (fallbackError) {
                    this.handleCameraError(fallbackError);
                }
            } else {
                this.handleCameraError(error);
            }
        }
    }

    handleCameraError(error) {
        let message = 'Ошибка доступа к камере';
        
        switch (error.name) {
            case 'NotAllowedError':
                message = 'Доступ к камере запрещен. Разрешите использование камеры в настройках браузера.';
                break;
            case 'NotFoundError':
                message = 'Камера не найдена. Убедитесь, что устройство имеет камеру.';
                break;
            case 'NotSupportedError':
                message = 'Камера не поддерживается этим браузером.';
                break;
            case 'NotReadableError':
                message = 'Камера используется другим приложением.';
                break;
            case 'OverconstrainedError':
                message = 'Запрошенные параметры камеры не поддерживаются.';
                break;
            default:
                message = `Ошибка камеры: ${error.message}`;
        }
        
        this.showError(message);
    }

    async loadCameras() {
        try {
            const devices = await this.codeReader.listVideoInputDevices();
            this.cameraSelect.innerHTML = '<option value="">Выберите камеру...</option>';
            
            let backCameraId = null;
            let preferredCameraIndex = 0;
            
            devices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Камера ${index + 1}`;
                this.cameraSelect.appendChild(option);
                
                console.log(`Camera ${index}: ${device.label || 'Unnamed'} - ${device.deviceId.substr(0,8)}...`);
                
                // Ищем заднюю камеру для мобильных устройств
                if (this.isMobile && device.label) {
                    const label = device.label.toLowerCase();
                    if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('facing back')) {
                        backCameraId = device.deviceId;
                        console.log('Found back camera:', device.label);
                    }
                    // Для iOS также ищем камеры с номерами (обычно 0 - фронтальная, 1 - задняя)
                    if (this.isIOS && (label.includes('camera 1') || label.includes('camera2') || label.includes('1:'))) {
                        backCameraId = device.deviceId;
                        console.log('Found likely back camera on iOS:', device.label);
                    }
                }
                
                // Если нет label, но это мобильное устройство, пробуем последнюю камеру (часто задняя)
                if (this.isMobile && !device.label && index > 0) {
                    preferredCameraIndex = index;
                }
            });

            if (devices.length > 0) {
                this.cameraSelect.disabled = false;
                
                // Выбираем заднюю камеру на мобильных, если найдена
                if (this.isMobile && backCameraId) {
                    this.selectedDeviceId = backCameraId;
                    this.cameraSelect.value = backCameraId;
                    console.log('Selected back camera for mobile device');
                } else if (this.isMobile && preferredCameraIndex > 0) {
                    // Если нет явно названной задней камеры, выбираем последнюю (обычно задняя)
                    this.selectedDeviceId = devices[preferredCameraIndex].deviceId;
                    this.cameraSelect.value = this.selectedDeviceId;
                    console.log('Selected preferred camera (likely back camera) for mobile device');
                } else {
                    // Иначе выбираем первую доступную
                    this.selectedDeviceId = devices[0].deviceId;
                    this.cameraSelect.value = this.selectedDeviceId;
                    console.log('Selected first available camera');
                }
            }
        } catch (error) {
            console.error('Ошибка при получении списка камер:', error);
            this.showError('Не удалось получить доступ к камерам');
        }
    }

    async startScanning() {
        if (!this.selectedDeviceId) {
            this.showError('Сначала выберите камеру');
            return;
        }

        try {
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.switchCameraBtn.disabled = false;
            this.cameraSelect.disabled = true;
            this.isScanning = true;
            
            // Показываем главную кнопку Telegram
            if (this.tg) {
                this.tg.MainButton.show();
            }
            
            // Добавляем анимацию сканирования
            this.video.classList.add('scanning');
            this.showScanLine();

            // Настройки для мобильных устройств
            const hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
            hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
            
            // Для мобильных устройств используем более агрессивные настройки
            if (this.isMobile) {
                hints.set(ZXing.DecodeHintType.ALSO_INVERTED, true);
            }

            this.codeReader = new ZXing.BrowserQRCodeReader(hints);

            // Запускаем непрерывное сканирование
            this.codeReader.decodeFromVideoDevice(
                this.selectedDeviceId,
                this.video,
                (result, error) => {
                    if (result && this.isScanning) {
                        this.handleScanResult(result.text);
                    }
                    if (error && error.name !== 'NotFoundException') {
                        console.warn('Scan error:', error);
                    }
                }
            );

            // Для iOS добавляем обработчик загрузки видео
            if (this.isIOS) {
                this.video.addEventListener('loadedmetadata', () => {
                    console.log('iOS video metadata loaded');
                    // Принудительно запускаем воспроизведение на iOS
                    this.video.play().catch(e => console.warn('Video play failed:', e));
                });
            }

        } catch (error) {
            console.error('Ошибка при запуске сканирования:', error);
            this.handleCameraError(error);
            this.stopScanning();
        }
    }

    showScanLine() {
        // Создаем элемент полоски сканирования если его еще нет
        let scanLine = document.getElementById('scan-line');
        if (!scanLine) {
            scanLine = document.createElement('div');
            scanLine.id = 'scan-line';
            scanLine.className = 'scan-line';
            
            // Позиционируем полоску относительно video элемента
            const videoContainer = this.video.parentNode;
            videoContainer.style.position = 'relative';
            videoContainer.appendChild(scanLine);
        }
        scanLine.style.display = 'block';
        console.log('Scan line shown'); // Для отладки
    }

    hideScanLine() {
        const scanLine = document.getElementById('scan-line');
        if (scanLine) {
            scanLine.style.display = 'none';
        }
    }

    stopScanning() {
        this.isScanning = false;
        this.codeReader.reset();
        
        // Останавливаем видео поток
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }

        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.switchCameraBtn.disabled = true;
        this.cameraSelect.disabled = false;
        
        // Убираем анимацию сканирования
        this.video.classList.remove('scanning');
        this.hideScanLine();
        
        // Скрываем главную кнопку Telegram
        if (this.tg) {
            this.tg.MainButton.hide();
        }
    }

    async switchCamera() {
        const options = this.cameraSelect.options;
        const currentIndex = Array.from(options).findIndex(option => option.value === this.selectedDeviceId);
        const nextIndex = (currentIndex + 1) % (options.length - 1) + 1; // Пропускаем первый пустой option
        
        this.selectedDeviceId = options[nextIndex].value;
        this.cameraSelect.value = this.selectedDeviceId;
        
        if (this.isScanning) {
            this.stopScanning();
            setTimeout(() => this.startScanning(), 100);
        }
    }

    handleScanResult(text) {
        console.log('QR code scanned:', text);
        
        // Останавливаем сканирование
        this.stopScanning();
        
        // Проигрываем громкий звук успеха
        this.playSuccessSound();
        
        // Сохраняем отсканированные данные
        this.scannedData = text;
        
        // Показываем модальное окно оплаты
        this.showPaymentModal(text);
    }

    showPaymentModal(data) {
        this.paymentData.textContent = data;
        this.paymentModal.style.display = 'flex';
        
        // Отправляем haptic feedback если доступно
        if (this.tg && this.tg.HapticFeedback) {
            this.tg.HapticFeedback.impactOccurred('heavy');
        }
    }

    hidePaymentModal() {
        this.paymentModal.style.display = 'none';
        this.scannedData = null;
        
        // Можем снова начать сканирование
        setTimeout(() => {
            this.requestCameraAndStart();
        }, 500);
    }

    async processPayment() {
        if (!this.scannedData) {
            console.error('No scanned data available');
            this.showTemporaryMessage('Нет данных для отправки');
            return;
        }

        try {
            // Показываем индикатор загрузки
            this.payBtn.disabled = true;
            this.payBtn.textContent = 'Отправка...';

            // Подготавливаем данные для отправки
            const paymentPayload = {
                qr_data: this.scannedData,
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent,
                telegram_data: this.tg ? {
                    user: this.tg.initDataUnsafe?.user || null,
                    chat: this.tg.initDataUnsafe?.chat || null,
                    start_param: this.tg.initDataUnsafe?.start_param || null,
                    query_id: this.tg.initDataUnsafe?.query_id || null
                } : null
            };

            console.log('Sending payment data to:', this.webhookUrl);
            console.log('Payload:', paymentPayload);

            // Отправляем данные на webhook с timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд timeout

            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(paymentPayload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const responseText = await response.text();
                console.log('Response body:', responseText);
                
                // Отправляем haptic feedback
                if (this.tg && this.tg.HapticFeedback) {
                    this.tg.HapticFeedback.notificationOccurred('success');
                }
                
                // Показываем сообщение об успехе
                this.showTemporaryMessage('Данные отправлены успешно!');
                
                // Закрываем приложение через небольшую задержку
                setTimeout(() => {
                    this.closeApp();
                }, 1500);
                
            } else {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
            }

        } catch (error) {
            console.error('Payment processing error:', error);
            
            // Восстанавливаем кнопку
            this.payBtn.disabled = false;
            this.payBtn.textContent = 'Оплатить';
            
            // Отправляем haptic feedback об ошибке
            if (this.tg && this.tg.HapticFeedback) {
                this.tg.HapticFeedback.notificationOccurred('error');
            }
            
            let errorMessage = 'Ошибка отправки данных';
            
            if (error.name === 'AbortError') {
                errorMessage = 'Превышено время ожидания';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Ошибка сети. Проверьте подключение';
            } else if (error.message.includes('HTTP')) {
                errorMessage = `Ошибка сервера: ${error.message}`;
            }
            
            this.showTemporaryMessage(errorMessage);
        }
    }

    async testWebhook() {
        console.log('Testing webhook...');
        
        // Временно устанавливаем тестовые данные
        this.scannedData = 'TEST_QR_DATA_' + Date.now();
        
        try {
            this.testWebhookBtn.disabled = true;
            this.testWebhookBtn.textContent = 'Тестирование...';
            
            await this.processPayment();
            
        } catch (error) {
            console.error('Webhook test failed:', error);
        } finally {
            this.testWebhookBtn.disabled = false;
            this.testWebhookBtn.textContent = 'Тест Webhook';
            this.scannedData = null;
        }
    }

    closeApp() {
        // Останавливаем сканирование
        this.stopScanning();
        
        // Закрываем Telegram Web App
        if (this.tg) {
            this.tg.close();
        } else {
            // Fallback для обычного браузера
            window.close();
        }
    }

    showError(message) {
        console.error('Error:', message);
        
        // Отправляем haptic feedback об ошибке
        if (this.tg && this.tg.HapticFeedback) {
            this.tg.HapticFeedback.notificationOccurred('error');
        }
        
        this.showTemporaryMessage(message);
    }

    playSuccessSound() {
        // Создаем более громкий звуковой сигнал успеха
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
            
            // Увеличиваем громкость
            gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
        } catch (error) {
            console.log('Не удалось воспроизвести звук:', error);
        }
    }

    showTemporaryMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--tg-theme-button-color, #28a745);
            color: var(--tg-theme-button-text-color, white);
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 2000;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 90%;
            text-align: center;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// Проверяем поддержку MediaDevices API и HTTPS
function checkBrowserSupport() {
    const httpsWarning = document.getElementById('https-warning');
    
    // Проверяем HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        if (httpsWarning) {
            httpsWarning.style.display = 'block';
        }
        return false;
    }
    
    // Проверяем поддержку MediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: Arial; color: var(--tg-theme-text-color, white);">
                <h2>Камера не поддерживается</h2>
                <p>Ваш браузер не поддерживает доступ к камере.</p>
                <p>Попробуйте использовать современный браузер (Chrome, Firefox, Safari).</p>
                <p>На мобильных устройствах убедитесь, что сайт открыт по HTTPS.</p>
            </div>
        `;
        return false;
    }
    
    return true;
}

if (!checkBrowserSupport()) {
    console.error('Browser support check failed');
} else {
    // Инициализируем приложение после загрузки ZXing
    window.addEventListener('load', () => {
        if (typeof ZXing !== 'undefined') {
            console.log('Initializing Telegram QR Scanner...');
            new TelegramQRScanner();
        } else {
            console.error('ZXing library не загружена');
            document.body.innerHTML = `
                <div style="text-align: center; padding: 50px; font-family: Arial; color: var(--tg-theme-text-color, #333);">
                    <h2>Ошибка загрузки</h2>
                    <p>Не удалось загрузить библиотеку ZXing.</p>
                    <p>Проверьте подключение к интернету и обновите страницу.</p>
                </div>
            `;
        }
    });
}
