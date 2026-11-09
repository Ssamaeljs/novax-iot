import { inject } from '@angular/core';
import { Toast } from '../../shared/ui/toast.service';
import { ChangeDetectionStrategy, Component, input, OnChanges, output, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Mapping, Profile, ProfileInput } from './integration.models';

@Component({
  selector: 'app-profile-editor', imports: [FormsModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form #editor="ngForm" class="stack" (ngSubmit)="submit()">
    <p>Define cómo interpretar un formato de dispositivo. Los campos publicados no se sobrescriben: cada cambio crea una versión y las fuentes existentes conservan la suya.</p>
    <label class="field">Nombre *<input name="name" [(ngModel)]="name" required minlength="2" maxlength="120" /></label>
    <label class="field">Descripción<textarea name="description" [(ngModel)]="description" maxlength="2000" rows="2"></textarea></label>
    <p>Conversión numérica: valor normalizado = valor recibido × escala + desplazamiento. Los sensores registrados deben coincidir en clave, magnitud, tipo y unidad final.</p>
    @for (field of mappings; track $index; let index = $index) {
      <fieldset class="mapping"><legend>Campo {{ index + 1 }}</legend>
        <div class="mapping-fields">
          <label class="field">Ruta en payload *<input [name]="'path'+index" [(ngModel)]="field.path" required maxlength="120" placeholder="environment.humidity" /></label>
          <label class="field">Clave del sensor *<input [name]="'key'+index" [(ngModel)]="field.sensor_key" required maxlength="80" /></label>
          <label class="field">Magnitud común *<input [name]="'metric'+index" [(ngModel)]="field.metric" required maxlength="100" placeholder="humidity" /></label>
          <label class="field">Tipo<select [name]="'type'+index" [(ngModel)]="field.data_type"><option value="NUMBER">Número</option><option value="TEXT">Texto</option><option value="BOOLEAN">Verdadero / falso</option><option value="JSON">JSON estructurado</option></select></label>
          <label class="field">Unidad de entrada<input [name]="'sourceUnit'+index" [(ngModel)]="field.source_unit" maxlength="30" placeholder="ratio, °F…" /></label>
          <label class="field">Unidad final<input [name]="'unit'+index" [(ngModel)]="field.unit" maxlength="30" placeholder="%, °C…" /></label>
          @if (field.data_type === 'NUMBER') {
            <label class="field">Escala<input type="number" step="any" [name]="'scale'+index" [(ngModel)]="field.scale" required /></label>
            <label class="field">Desplazamiento<input type="number" step="any" [name]="'offset'+index" [(ngModel)]="field.offset" required /></label>
          }
        </div>
        <div class="cluster"><label class="choice"><input type="checkbox" [name]="'required'+index" [(ngModel)]="field.required" />Campo obligatorio</label><button type="button" class="button" [disabled]="mappings.length === 1" (click)="remove(index)">Quitar campo</button></div>
      </fieldset>
    }
    <div class="cluster"><button type="button" class="button" [disabled]="mappings.length >= 32 || busy()" (click)="add()">Añadir campo</button><button type="submit" class="button button--primary" [disabled]="busy()">{{ busy() ? 'Publicando…' : 'Publicar perfil' }}</button><button type="button" class="button" [disabled]="busy()" (click)="cancelled.emit()">Cancelar</button></div>
  </form>`,
  styles: `p{font-size:.8rem;line-height:1.6;color:var(--text-secondary)}.mapping{padding:1rem;border:1px solid var(--border-default);border-radius:var(--radius-sm);display:grid;gap:1rem}.mapping-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}@media(max-width:600px){.mapping-fields{grid-template-columns:minmax(0,1fr)}}`,
})
export class ProfileEditorComponent implements OnChanges {
  private readonly toast = inject(Toast);
  readonly base = input<Profile | null>(null);
  readonly busy = input(false);
  readonly published = output<ProfileInput>();
  readonly cancelled = output<void>();
  private readonly editor = viewChild<NgForm>('editor');
  name = ''; description = ''; mappings: Mapping[] = [];
  ngOnChanges() {
    if (this.loadedBase === this.base()) return;
    this.loadedBase = this.base();
    this.structuralDirty = false;
    this.editor()?.form.markAsPristine();
    this.name = this.base()?.name || ''; this.description = this.base()?.description || '';
    this.mappings = this.base()?.mappings.map((field) => ({ ...field })) || [this.emptyMapping()];
  }
  private loadedBase: Profile | null | undefined = undefined;
  private structuralDirty = false;
  private emptyMapping(): Mapping { return { path: 'humidity', sensor_key: 'humidity', metric: 'humidity', unit: '%', source_unit: '%', data_type: 'NUMBER', scale: 1, offset: 0, required: true }; }
  dirty() { return this.structuralDirty || !!this.editor()?.dirty; }
  add() { if (this.mappings.length < 32) { this.mappings = [...this.mappings, this.emptyMapping()]; this.structuralDirty = true; } }
  remove(index: number) { this.mappings = this.mappings.filter((_, position) => position !== index); this.structuralDirty = true; }
  submit() {
    if (this.busy()) return;
    if (this.editor()?.invalid || !this.name.trim() || !this.mappings.length || new Set(this.mappings.map((field) => field.sensor_key)).size !== this.mappings.length) { this.toast.fire({ icon: 'error', text: 'Completa los campos obligatorios y utiliza claves de sensor distintas.' }); return; }
    const mappings = this.mappings.map((field) => ({ ...field, path: field.path.trim(), sensor_key: field.sensor_key.trim(), metric: field.metric.trim(), unit: field.unit?.trim() || null, source_unit: field.source_unit?.trim() || null, scale: field.data_type === 'NUMBER' ? field.scale : 1, offset: field.data_type === 'NUMBER' ? field.offset : 0 }));
    this.published.emit({ name: this.name.trim(), description: this.description.trim(), mappings });
  }
}
