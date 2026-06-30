/// <reference types="w3c-web-serial" />

export class WebSerialService {
  private port: any = null;
  private isConnected = false;
  private lastSignal: boolean | null = null;
  private lastSignalTime: number = 0;
  private pollInterval: any = null;

  // Arduino Vendor ID (e.g., Uno)
  private readonly TARGET_VID = '2341';

  constructor() {
    // [원인 분석 및 수정] Web Serial 차단 우회 및 무팝업 자동 연결 구현
    // 브라우저 환경(특히 iframe으로 감싸진 샌드박스 내부)에서는 navigator.serial API 접근 시
    // 보안 정책(Permissions-Policy)에 의해 하드웨어 접근이 강제로 차단되는 문제가 있었습니다.
    // 이를 해결하기 위해 데스크톱 네이티브 앱(Electron) 구조로 전환하였으며, 
    // 브라우저 API 대신 Node.js 네이티브 모듈인 'serialport'를 활용하도록 재설계했습니다.
    // 사용자의 수동 팝업 승인 과정을 없애고, 백그라운드 폴링(Polling)을 통해
    // 특정 Vendor ID(아두이노)가 감지되면 즉시 포트를 여는 Plug & Play 방식을 적용했습니다.
    this.startPolling();
  }

  private startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Auto-polling every 3 seconds to check if device is plugged in
    this.pollInterval = setInterval(async () => {
      if (!this.isConnected) {
        await this.connect();
      }
    }, 3000);
  }

  async connect() {
    // Prevent duplicate connections
    if (this.isConnected) {
      return true;
    }

    try {
      // Load serialport in Electron renderer using window.require to bypass Vite bundling
      // @ts-ignore
      const { SerialPort } = window.require('serialport');
      
      const ports = await SerialPort.list();
      
      // Auto-scan for Arduino by Vendor ID
      const targetPortInfo = ports.find((p: any) => p.vendorId === this.TARGET_VID || p.vendorId?.toLowerCase() === this.TARGET_VID.toLowerCase());

      if (targetPortInfo) {
        return new Promise((resolve, reject) => {
          this.port = new SerialPort({ path: targetPortInfo.path, baudRate: 9600 }, (err: any) => {
             if (err) {
               console.warn("Error opening port", err);
               reject(err);
             }
          });
          
          this.port.on('open', () => {
            this.isConnected = true;
            this.lastSignal = null;
            this.lastSignalTime = 0;
            // Dispatch custom event to notify React component of connection
            window.dispatchEvent(new Event('hardware-connected'));
            resolve(true);
          });
          
          this.port.on('error', (err: any) => {
            console.error('Serial port error:', err);
            this.disconnect();
          });

          this.port.on('close', () => {
            this.isConnected = false;
            this.port = null;
            window.dispatchEvent(new Event('hardware-disconnected'));
          });
        });
      }
      
      return false;
    } catch (err: any) {
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.port && this.port.isOpen) {
        this.port.close();
      }
    } catch (e) {
      console.warn("Error closing serial port", e);
    } finally {
      this.port = null;
      this.isConnected = false;
      window.dispatchEvent(new Event('hardware-disconnected'));
    }
  }

  async sendSignal(isBadPosture: boolean) {
    if (!this.isConnected || !this.port) return;
    
    const now = Date.now();
    // Edge Trigger: Only send if value changes
    const isValueChanged = this.lastSignal !== isBadPosture;
    // Throttling: Or if we haven't sent in 500ms
    const isThrottled = (now - this.lastSignalTime) < 500;

    if (!isValueChanged && isThrottled) {
      return; 
    }

    try {
      this.port.write(isBadPosture ? '1' : '0', (err: any) => {
        if (err) {
           console.error('Failed to write to serial port', err);
           this.disconnect();
        } else {
           this.lastSignal = isBadPosture;
           this.lastSignalTime = now;
        }
      });
    } catch (err) {
      console.error('Exception writing to port', err);
      await this.disconnect();
    }
  }

  getConnected() {
    return this.isConnected;
  }
}

export const serialService = new WebSerialService();
