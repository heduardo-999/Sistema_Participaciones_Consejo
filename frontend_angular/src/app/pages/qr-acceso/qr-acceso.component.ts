import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({selector:'app-qr-acceso',standalone:true,imports:[FormsModule],templateUrl:'./qr-acceso.component.html'})
export class QrAccesoComponent{ nombre=''; tipo='invitado'; reunion='Sesión actual'; token=signal(''); acceder(){this.token.set('QR-'+Math.random().toString(36).substring(2,10).toUpperCase());}}
