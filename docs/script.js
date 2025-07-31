class QRScanner {
    constructor() {
        this.codeReader = new ZXing.BrowserQRCodeReader();
        this.selectedDeviceId = null;
        this.isScanning = false;
        this.stream = null;
        this.history = JSON.parse(localStorage.getItem('qr-history') || '[]');
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadCameras();
        this.displayHistory();
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
        this.startBtn.addEventListener('click', () => this.startScanning());
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

    async loadCameras() {
        try {
            const devices = await this.codeReader.listVideoInputDevices();
            this.cameraSelect.innerHTML = '<option value="">Выберите камеру...</option>';
            
            devices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Камера ${index + 1}`;
                this.cameraSelect.appendChild(option);
            });

            if (devices.length > 0) {
                this.cameraSelect.disabled = false;
                this.selectedDeviceId = devices[0].deviceId;
                this.cameraSelect.value = this.selectedDeviceId;
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

            // Запускаем сканирование
            const result = await this.codeReader.decodeOnceFromVideoDevice(
                this.selectedDeviceId,
                this.video
            );

            if (result) {
                this.handleScanResult(result.text);
            }

            // Продолжаем сканирование в цикле
            this.continuousScanning();

        } catch (error) {
            console.error('Ошибка при запуске сканирования:', error);
            this.showError('Не удалось запустить сканирование');
            this.stopScanning();
        }
    }

    async continuousScanning() {
        if (!this.isScanning) return;

        try {
            const result = await this.codeReader.decodeOnceFromVideoDevice(
                this.selectedDeviceId,
                this.video
            );

            if (result && this.isScanning) {
                this.handleScanResult(result.text);
            }
        } catch (error) {
            // Игнорируем ошибки "не найден QR код" и продолжаем сканирование
            if (error.name !== 'NotFoundException') {
                console.error('Ошибка сканирования:', error);
            }
        }

        // Продолжаем сканирование через небольшой интервал
        if (this.isScanning) {
            setTimeout(() => this.continuousScanning(), 100);
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

// Проверяем поддержку MediaDevices API
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.body.innerHTML = `
        <div style="text-align: center; padding: 50px; font-family: Arial;">
            <h2>Камера не поддерживается</h2>
            <p>Ваш браузер не поддерживает доступ к камере.</p>
            <p>Попробуйте использовать современный браузер или откройте страницу через HTTPS.</p>
        </div>
    `;
} else {
    // Инициализируем приложение после загрузки ZXing
    window.addEventListener('load', () => {
        if (typeof ZXing !== 'undefined') {
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
