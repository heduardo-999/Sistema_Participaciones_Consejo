import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrudService } from '../../core/services/crud.service';
import { StatusBadgeComponent } from '../../shared/components/ui/status-badge.component';
@Component({ selector:'app-participantes', standalone:true, imports:[FormsModule, StatusBadgeComponent], templateUrl:'./participantes.component.html' })
export class ParticipantesComponent implements OnInit { items=signal<any[]>([]); q=''; modal=false; editing:any=null; form:any={}; constructor(private crud:CrudService){} async ngOnInit(){ await this.load(); } async load(){ const res:any=await this.crud.list('/participantes',{search:this.q}).catch(()=>({data:[]})); this.items.set(res.data || res || []); } open(item?:any){ this.editing=item||null; this.form=item?{...item}:{}; this.modal=true; } async save(){ if(this.editing) await this.crud.update('/participantes',this.editing.id,this.form); else await this.crud.create('/participantes',this.form); this.modal=false; await this.load(); } async remove(id:number){ if(confirm('¿Eliminar registro?')){ await this.crud.remove('/participantes',id); await this.load(); } } }
