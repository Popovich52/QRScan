// Альтернативная версия с использованием npm пакета
// Для использования этого файла, установите ZXing через npm:
// npm install @zxing/library

import { BrowserQRCodeReader } from '@zxing/library';

class QRScannerModule {
    constructor() {
        this.codeReader = new BrowserQRCodeReader();
        this.selectedDeviceId = null;
        this.isScanning = false;
    }

    async initCamera() {
        try {
            const devices = await this.codeReader.listVideoInputDevices();
            console.log('Доступные камеры:', devices);
            
            if (devices.length > 0) {
                this.selectedDeviceId = devices[0].deviceId;
                return devices;
            }
            throw new Error('Камеры не найдены');
        } catch (error) {
            console.error('Ошибка инициализации камеры:', error);
            throw error;
        }
    }

    async startScanning(videoElement, onResult, onError) {
        try {
            this.isScanning = true;
            
            const result = await this.codeReader.decodeOnceFromVideoDevice(
                this.selectedDeviceId,
                videoElement
            );
            
            if (result && onResult) {
                onResult(result.text);
            }

            // Продолжаем сканирование
            if (this.isScanning) {
                this.continuousScanning(videoElement, onResult, onError);
            }
        } catch (error) {
            if (onError) {
                onError(error);
            }
        }
    }

    async continuousScanning(videoElement, onResult, onError) {
        if (!this.isScanning) return;

        try {
            const result = await this.codeReader.decodeOnceFromVideoDevice(
                this.selectedDeviceId,
                videoElement
            );

            if (result && this.isScanning && onResult) {
                onResult(result.text);
            }
        } catch (error) {
            if (error.name !== 'NotFoundException' && onError) {
                onError(error);
            }
        }

        if (this.isScanning) {
            setTimeout(() => this.continuousScanning(videoElement, onResult, onError), 100);
        }
    }

    stopScanning() {
        this.isScanning = false;
        this.codeReader.reset();
    }

    switchCamera(devices) {
        if (devices.length <= 1) return;
        
        const currentIndex = devices.findIndex(device => device.deviceId === this.selectedDeviceId);
        const nextIndex = (currentIndex + 1) % devices.length;
        this.selectedDeviceId = devices[nextIndex].deviceId;
        
        return devices[nextIndex];
    }
}

// Пример использования:
/*
const scanner = new QRScannerModule();
const videoElement = document.getElementById('video');

// Инициализация
scanner.initCamera().then(devices => {
    console.log('Камеры инициализированы:', devices);
    
    // Запуск сканирования
    scanner.startScanning(
        videoElement,
        (result) => {
            console.log('QR код найден:', result);
            // Обработка результата
        },
        (error) => {
            console.error('Ошибка сканирования:', error);
        }
    );
}).catch(error => {
    console.error('Ошибка инициализации:', error);
});
*/

export default QRScannerModule;
