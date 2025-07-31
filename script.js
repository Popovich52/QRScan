class QRScanner {
    constructor() {
        this.codeReader = new ZXing.BrowserQRCodeReader();
        this.selectedDeviceId = null;
        this.isScanning = false;
        this.stream = null;
        this.history = JSON.parse(localStorage.getItem('qr-history') || '[]');
        this.isMobile = this.detectMobile();
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkCameraSupport();
        this.displayHistory();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    initializeElements() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.switchCameraBtn = document.getElementById('switchCameraBtn');
        this.cameraSelect = document.getElementById('cameraSelect');
        this.result = document.getElementById('result');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.historyDiv = document.getElementById('history');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.requestCameraAndStart());
        this.stopBtn.addEventListener('click', () => this.stopScanning());
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.cameraSelect.addEventListener('change', (e) => {
            this.selectedDeviceId = e.target.value;
            if (this.isScanning) {
                this.stopScanning();
                setTimeout(() => this.startScanning(), 100);
            }
        });
        this.copyBtn.addEventListener('click', () => this.copyResult());
        this.clearBtn.addEventListener('click', () => this.clearResult());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
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

    async requestCameraAndStart() {
        try {
            // Сначала запрашиваем разрешение на камеру
            const constraints = {
                video: {
                    facingMode: this.isMobile ? { ideal: 'environment' } : 'user', // Предпочитаем заднюю камеру на мобильном
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

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
                    const fallbackConstraints = {
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        }
                    };
                    
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

    // Удаляем старый метод continuousScanning, так как теперь используем decodeFromVideoDevice

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
        this.displayResult(text);
        this.addToHistory(text);
        this.playSuccessSound();
        
        // Показываем кнопки управления результатом
        this.copyBtn.style.display = 'inline-block';
        this.clearBtn.style.display = 'inline-block';
    }

    displayResult(text) {
        this.result.innerHTML = `<div class="content">${this.escapeHtml(text)}</div>`;
        this.result.className = 'result-box success';
    }

    showError(message) {
        this.result.innerHTML = `<p class="placeholder" style="color: #dc3545;">${message}</p>`;
        this.result.className = 'result-box';
    }

    clearResult() {
        this.result.innerHTML = '<p class="placeholder">QR-код не обнаружен</p>';
        this.result.className = 'result-box';
        this.copyBtn.style.display = 'none';
        this.clearBtn.style.display = 'none';
    }

    async copyResult() {
        const content = this.result.querySelector('.content');
        if (content) {
            try {
                await navigator.clipboard.writeText(content.textContent);
                this.showTemporaryMessage('Скопировано в буфер обмена!');
            } catch (error) {
                console.error('Ошибка копирования:', error);
                this.showTemporaryMessage('Ошибка копирования');
            }
        }
    }

    addToHistory(text) {
        const timestamp = new Date().toLocaleString('ru-RU');
        const historyItem = { text, timestamp };
        
        // Избегаем дублирования последнего элемента
        if (this.history.length === 0 || this.history[0].text !== text) {
            this.history.unshift(historyItem);
            
            // Ограничиваем историю до 50 элементов
            if (this.history.length > 50) {
                this.history = this.history.slice(0, 50);
            }
            
            localStorage.setItem('qr-history', JSON.stringify(this.history));
            this.displayHistory();
        }
    }

    displayHistory() {
        if (this.history.length === 0) {
            this.historyDiv.innerHTML = '<p class="placeholder">История пуста</p>';
            this.clearHistoryBtn.style.display = 'none';
            return;
        }

        this.historyDiv.innerHTML = this.history.map(item => `
            <div class="history-item">
                <div class="timestamp">${item.timestamp}</div>
                <div class="content">${this.escapeHtml(item.text)}</div>
            </div>
        `).join('');
        
        this.clearHistoryBtn.style.display = 'inline-block';
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem('qr-history');
        this.displayHistory();
    }

    playSuccessSound() {
        // Создаем простой звуковой сигнал успеха
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
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
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 2000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            <div style="text-align: center; padding: 50px; font-family: Arial; color: white;">
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
            console.log('Initializing QR Scanner...');
            new QRScanner();
        } else {
            console.error('ZXing library не загружена');
            document.body.innerHTML = `
                <div style="text-align: center; padding: 50px; font-family: Arial;">
                    <h2>Ошибка загрузки</h2>
                    <p>Не удалось загрузить библиотеку ZXing.</p>
                    <p>Проверьте подключение к интернету и обновите страницу.</p>
                </div>
            `;
        }
    });
}
