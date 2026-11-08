import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DOCUMENT, JsonPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiService, Entity, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { ProfileEditorComponent } from './profile-editor.component';
import { Profile, ProfileInput } from './integration.models';

@Component({ imports: [FormsModule, JsonPipe, ProfileEditorComponent], templateUrl: './integrations.page.html', styleUrl: './integrations.page.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class IntegrationsPage implements OnInit {
  readonly state = inject(AuthState);
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private readonly profileForm = viewChild(ProfileEditorComponent);
  private readonly sourceForm = viewChild<NgForm>('sourceForm');
  readonly profiles = signal<Profile[]>([]); readonly sources = signal<Entity[]>([]); readonly messages = signal<Entity[]>([]); readonly devices = signal<Entity[]>([]);
  readonly mqtt = signal<Entity | null>(null); readonly loading = signal(false); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal(''); readonly secret = signal('');
  readonly editingProfile = signal(false); readonly baseProfile = signal<Profile | null>(null); readonly editingSource = signal(false); readonly sourceToEdit = signal<Entity | null>(null);
  readonly preview = signal<unknown>(null);
  readonly secretSource = signal('');
  tab = 'sources'; sourceName = ''; deviceId = ''; profileId = ''; transport = 'HTTPS'; timeout = 300;
  previewProfileId = ''; previewDeviceId = ''; sample = '{\n  "schema_version": 1,\n  "message_id": "11111111-1111-4111-8111-111111111111",\n  "payload": { "humidity": 72.4 }\n}';
  canManage() { return this.state.has('integrations.manage'); }
  ngOnInit() { void this.load(); }
  switchTab(tab: string) { if (tab === this.tab) return; if (this.discardEditors()) this.tab = tab; }
  newSample() { this.sample = JSON.stringify({ schema_version: 1, message_id: crypto.randomUUID(), observed_at: new Date().toISOString(), payload: { humidity: 72.4 } }, null, 2); }
  async load() {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {
      const [profiles, sources, messages, status, devices] = await Promise.all([
        this.api.options('integrations/profiles'), this.api.options('integrations/sources'),
        firstValueFrom(this.api.list('integrations/messages', { page_size: 20 })), firstValueFrom(this.api.get('integrations/status')),
        this.canManage() && this.state.has('devices.read') ? this.api.options('iot/devices', { is_active: true }) : Promise.resolve([]),
      ]);
      this.profiles.set(profiles as unknown as Profile[]); this.sources.set(sources); this.messages.set(messages.data); this.mqtt.set(status.data); this.devices.set(devices);
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.loading.set(false); }
  }
  startProfile(base: Profile | null = null) { if (!this.canManage() || !this.discardEditors()) return; this.baseProfile.set(base); this.editingProfile.set(true); this.tab = 'profiles'; }
  startSource(source: Entity | null = null) {
    if (!this.canManage() || !this.discardEditors()) return;
    this.sourceToEdit.set(source); this.sourceName = source?.['name'] || ''; this.deviceId = source?.['device']?.external_id || ''; this.profileId = source?.['profile']?.external_id || '';
    this.transport = source?.['transport'] || 'HTTPS'; this.timeout = source?.['heartbeat_timeout_seconds'] || 300; this.editingSource.set(true); this.tab = 'sources';
    this.sourceForm()?.form.markAsPristine();
  }
  private dirty() { return !!this.profileForm()?.dirty() || !!this.sourceForm()?.dirty; }
  discardEditors() {
    if (this.busy() || (this.dirty() && !this.document.defaultView?.confirm('Hay cambios sin guardar. ¿Descartarlos?'))) return false;
    this.editingProfile.set(false); this.editingSource.set(false); return true;
  }
  canLeave() { return !this.state.identity() || (!this.busy() && (!(this.dirty() || this.secret()) || !!this.document.defaultView?.confirm('Hay cambios o una credencial visible una sola vez. ¿Salir sin conservarlos?'))); }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) { if (this.dirty() || this.secret() || this.busy()) event.preventDefault(); }
  async publish(input: ProfileInput) {
    if (!this.canManage()) return;
    await this.run(async () => {
      const base = this.baseProfile();
      await firstValueFrom(this.api.post(base ? `integrations/profiles/${base.external_id}/versions` : 'integrations/profiles', input));
      this.editingProfile.set(false); this.notice.set('Perfil publicado. Las fuentes existentes conservan su versión.'); await this.load();
    });
  }
  async saveSource() {
    if (!this.canManage() || !this.sourceName.trim() || this.sourceForm()?.invalid) return;
    if (!this.sourceToEdit() && this.secret() && !this.document.defaultView?.confirm('Ya hay una credencial visible. ¿La guardaste antes de generar otra?')) return;
    await this.run(async () => {
      const source = this.sourceToEdit();
      const body = { name: this.sourceName.trim(), heartbeat_timeout_seconds: this.timeout };
      const result = source ? await firstValueFrom(this.api.patch(`integrations/sources/${source.external_id}`, body)) : await firstValueFrom(this.api.post('integrations/sources', { ...body, device_external_id: this.deviceId, profile_external_id: this.profileId, transport: this.transport }));
      if (result.data['token']) { this.secret.set(result.data['token']); this.secretSource.set(this.sourceName); }
      this.editingSource.set(false); this.notice.set(source ? 'Fuente actualizada.' : 'Fuente creada. Guarda su credencial antes de salir.'); await this.load();
    });
  }
  async rotate(source: Entity) {
    if (!this.canManage() || !this.document.defaultView?.confirm('La credencial anterior dejará de funcionar. ¿Rotarla?')) return;
    await this.run(async () => { const result = await firstValueFrom(this.api.post(`integrations/sources/${source.external_id}/rotate`, {})); this.secret.set(result.data['token']); this.secretSource.set(source['name']); this.notice.set('Credencial rotada; actualízala en el dispositivo.'); });
  }
  async toggle(kind: 'profiles' | 'sources', item: { external_id: string; is_active?: boolean }) {
    if (!this.canManage() || !this.document.defaultView?.confirm(item.is_active ? 'Desactivar detendrá la ingesta de las fuentes afectadas. ¿Continuar?' : '¿Reactivar este elemento?')) return;
    await this.run(async () => { await firstValueFrom(this.api.patch(`integrations/${kind}/${item.external_id}`, { is_active: !item.is_active })); await this.load(); this.notice.set('Estado actualizado.'); });
  }
  async simulate() {
    if (!this.canManage() || !this.previewProfileId || !this.previewDeviceId) return;
    this.preview.set(null);
    await this.run(async () => {
      let message: unknown; try { message = JSON.parse(this.sample); } catch { throw new Error('El mensaje de prueba debe ser JSON válido.'); }
      const result = await firstValueFrom(this.api.post(`integrations/profiles/${this.previewProfileId}/preview`, { device_external_id: this.previewDeviceId, message })); this.preview.set(result.data);
    });
  }
  compatibleDevices() { return this.devices().filter((device) => device['protocol'] === this.transport || (this.transport === 'HTTPS' && device['protocol'] === 'HTTP')); }
  activeProfiles() { return this.profiles().filter((profile) => profile.is_active); }
  sourceReady(source: Entity) { return !!source['is_active'] && source['profile']?.is_active !== false && source['device']?.is_active !== false; }
  sourceState(source: Entity) { return !source['is_active'] ? 'Desactivada' : source['profile']?.is_active === false ? 'Bloqueada por perfil' : source['device']?.is_active === false ? 'Dispositivo desactivado' : 'Habilitada'; }
  date(value: string) { return value ? new Date(value).toLocaleString('es', { timeZone: this.state.identity()?.tenant.timezone }) : 'Sin telemetría aceptada'; }
  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await action(); } catch (error) { this.error.set(errorMessage(error)); } finally { this.busy.set(false); }
  }
}
