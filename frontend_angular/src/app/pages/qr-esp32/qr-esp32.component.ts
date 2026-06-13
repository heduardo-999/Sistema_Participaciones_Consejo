import { Component, signal } from '@angular/core';
@Component({selector:'app-qr-esp32',standalone:true,templateUrl:'./qr-esp32.component.html'})
export class QrEsp32Component{ sent=signal(false); solicitar(){this.sent.set(true); setTimeout(()=>this.sent.set(false),1800);} }
