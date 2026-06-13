import { Component, signal } from '@angular/core';
@Component({selector:'app-esp32-virtual',standalone:true,templateUrl:'./esp32-virtual.component.html'})
export class Esp32VirtualComponent{ estado=signal<'conectado'|'mantenimiento'|'dañada'>('conectado'); anim=signal(false); solicitar(){this.anim.set(true); setTimeout(()=>this.anim.set(false),1800);} }
