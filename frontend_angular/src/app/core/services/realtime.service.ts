import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root',
})
export class RealtimeService {
  private socket: Socket | null = null;

  constructor(private zone: NgZone) {}

  connect(): void {
    if (this.socket?.connected) return;

    const hostname = window.location.hostname;
    const socketUrl = `http://${hostname}:3001`;

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket conectado:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket desconectado');
    });

    this.socket.on('connect_error', error => {
      console.error('Error conectando Socket.IO:', error.message);
    });
  }

  on(event: string, callback: (payload: any) => void): void {
    this.connect();

    this.socket?.off(event);

    this.socket?.on(event, payload => {
      this.zone.run(() => {
        callback(payload);
      });
    });
  }

  off(event: string): void {
    this.socket?.off(event);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
