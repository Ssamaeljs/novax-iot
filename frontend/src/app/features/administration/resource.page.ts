import { ToastOutlet } from '../../shared/ui/toast-outlet.component';
import { Toast } from '../../shared/ui/toast.service';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { FormFocusDirective } from '../../shared/ui/form-focus.directive';
import { fieldError } from '../../shared/ui/field-error';
import { enumLabel } from '../../shared/ui/enum-label';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subscription } from 'rxjs';
import { ApiService, Entity, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { IconComponent } from '../../shared/ui/icon.component';
import {
  ResourceDefinition,
  ResourceField,
  resources,
} from './resource-definitions';
@Component({
  imports: [ToastOutlet, FormsModule, ReactiveFormsModule, JsonPipe, IconComponent, RouterLink, FormFocusDirective],
  templateUrl: './resource.page.html',
  styleUrl: './resource.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourcePage implements OnInit {
  private readonly toast = inject(Toast);
  readonly api = inject(ApiService);
  readonly state = inject(AuthState);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  readonly fieldError = fieldError;
  readonly enumLabel = enumLabel;
  private assignmentDirty = false;
  readonly itemNames: Record<string, string> = { projects: 'proyecto', devices: 'dispositivo', sensors: 'sensor', users: 'usuario', accounts: 'cuenta', roles: 'rol', 'api-tokens': 'token de API' };
  itemName() { return this.itemNames[this.key] || 'registro'; }
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('editor');
  private request?: Subscription;
  private generation = 0;
  definition: ResourceDefinition = resources['devices'];
  key = '';
  search = '';
  auditAction = '';
  auditOutcome = '';
  readonly auditActions = [
    'LIST',
    'READ',
    'CREATE',
    'UPDATE',
    'DELETE',
    'ASSIGN',
    'BULK_CREATE',
    'LOGIN',
    'LOGOUT',
    'REGISTER',
    'PASSWORD_RECOVERY',
    'PASSWORD_RESET',
    'PASSWORD_CHANGE',
    'BOOTSTRAP',
    'INGEST',
  ];
  page = 1;
  readonly rows = signal<Entity[]>([]);
  readonly total = signal(0);
  readonly pages = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly preparing = signal(false);
  readonly mode = signal<
    'create' | 'edit' | 'delete' | 'detail' | 'assign' | 'secret'
  >('detail');
  readonly selected = signal<Entity | null>(null);
  readonly choices = signal<Record<string, Entity[]>>({});
  readonly secret = signal('');
  readonly assignment = signal<Entity[]>([]);
  selectedAssignments: string[] = [];
  fields: ResourceField[] = [];
  form = new FormGroup<Record<string, FormControl<any>>>({});
  ngOnInit() {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.generation++;
        this.key = data['resource'];
        this.definition = resources[this.key];
        this.search = '';
        this.auditAction = '';
        this.auditOutcome = '';
        this.page = 1;
        this.close(true);
        this.load();
      });
  }
  canManage() {
    return (
      !this.definition.readOnly &&
      this.state.has(`${this.definition.permission}.manage`)
    );
  }
  canAssign(row: Entity) {
    return (
      this.state.has('roles.manage') &&
      ((this.key === 'accounts' && this.state.has('roles.read')) ||
        (this.key === 'roles' &&
          !row['is_system'] &&
          this.state.has('permissions.read')))
    );
  }
  load(reset = false) {
    if (reset) this.page = 1;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.rows.set([]);
    this.request = this.api
      .list(this.definition.endpoint, {
        page: this.page,
        page_size: 20,
        ...(this.key !== 'audit' ? { is_active: true } : {}),
        ...(!this.definition.noSearch && this.search.trim()
          ? { search: this.search.trim() }
          : {}),
        ...(this.key === 'audit' && this.auditAction
          ? { action: this.auditAction }
          : {}),
        ...(this.key === 'audit' && this.auditOutcome
          ? { outcome: this.auditOutcome }
          : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (!result.data.length && this.page > 1 && result.pagination.total_pages < this.page) {
            this.page = Math.max(1, result.pagination.total_pages);
            this.load();
            return;
          }
          this.rows.set(result.data.filter((row) => row['is_active'] !== false));
          this.total.set(result.pagination.total);
          this.pages.set(result.pagination.total_pages);
          this.loading.set(false);
        },
        error: (error) => {
          this.toast.report(this.error, 'error', errorMessage(error));
          this.total.set(0);
          this.pages.set(0);
          this.loading.set(false);
        },
      });
  }
  clearFilters() { this.search = ''; this.auditAction = ''; this.auditOutcome = ''; this.load(true); }
  hasFilters() { return !!(this.search.trim() || this.auditAction || this.auditOutcome); }
  invalidFields() { return this.fields.filter((field) => this.form.controls[field.key]?.touched && this.form.controls[field.key].invalid); }
  focusField(key: string) { this.dialog()?.nativeElement.querySelector<HTMLElement>(`#resource-${key}`)?.focus(); }
  value(row: Entity, key: string): any {
    return key.split('.').reduce((value, part) => value?.[part], row as any);
  }
  display(row: Entity, key: string): string {
    const value = this.value(row, key);
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (['status', 'data_type', 'quality', 'outcome', 'action'].includes(key)) return enumLabel(String(value));
    if (Array.isArray(value))
      return (
        value.filter((item) => item.is_active !== false).map((item) => item.name || item.key || item).join(', ') ||
        'Sin asignar'
      );
    if (key.endsWith('_at'))
      return new Date(value).toLocaleString('es', {
        timeZone: this.state.identity()?.tenant.timezone,
      });
    return String(value);
  }
  label(row: Entity) {
    return (
      row['name'] ||
      row['title'] ||
      [row['first_name'], row['last_name']].filter(Boolean).join(' ') ||
      row['username'] ||
      row['key'] ||
      row.external_id
    );
  }
  hasUnsavedChanges() { return (['create', 'edit'].includes(this.mode()) && this.form.dirty) || (this.mode() === 'assign' && this.assignmentDirty); }
  canLeave() {
    // Expired sessions and explicit logout must never be trapped by an editor guard.
    if (!this.state.identity()) return true;
    return !this.saving() && (!this.hasUnsavedChanges() || !!this.document.defaultView?.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'));
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) { if (this.hasUnsavedChanges() || this.saving()) event.preventDefault(); }
  close(force = false) {
    if (!force && !this.canLeave()) return;
    this.generation++;
    this.dialog()?.nativeElement.close();
    this.secret.set('');
    this.form.reset();
    this.assignmentDirty = false;
  }
  async open(
    mode: 'create' | 'edit' | 'delete' | 'detail' | 'assign',
    row: Entity | null = null,
  ) {
    const generation = ++this.generation;
    this.mode.set(mode);
    this.selected.set(row);
    this.secret.set('');
    this.choices.set({});
    this.assignment.set([]);
    this.preparing.set(false);
    this.assignmentDirty = false;
    this.fields = this.definition.fields.filter(
      (field) =>
        !(mode === 'edit' && field.createOnly) &&
        !(mode === 'create' && field.editOnly),
    ).map((field) => field.key === 'protocol' && mode === 'edit' && row?.['protocol'] && !field.options?.includes(row['protocol']) ? { ...field, options: [...(field.options || []), row['protocol']] } : field);
    const controls: Record<string, FormControl<any>> = {};
    for (const field of this.fields) {
      controls[field.key] = new FormControl(
        row?.[field.key] ??
          field.default ??
          (field.type === 'scopes' ? [] : ''),
        [
          ...(field.required ? [Validators.required] : []),
          ...(field.minLength ? [Validators.minLength(field.minLength)] : []),
          ...(field.type === 'email' ? [Validators.email] : []),
          ...(field.type === 'number' && field.min !== undefined
            ? [Validators.min(field.min)]
            : []),
          ...(field.type === 'number' && field.max !== undefined ? [Validators.max(field.max)] : []),
          ...(field.max && field.type !== 'number'
            ? [Validators.maxLength(field.max)]
            : []),
        ],
      );
    }
    this.form = new FormGroup(controls);
    this.dialog()!.nativeElement.showModal();
    try {
      this.preparing.set(true);
      if (mode === 'assign' && row) {
        const isAccount = this.key === 'accounts';
        const options = await this.api.options(
          isAccount ? 'iam/roles' : 'iam/permissions',
          { is_active: true },
        );
        if (generation !== this.generation) return;
        this.assignment.set(options);
        this.selectedAssignments = (
          row[isAccount ? 'roles' : 'permissions'] || []
        ).map((item: Entity) => (isAccount ? item.external_id : item['key']));
      } else if (mode === 'create' || mode === 'edit') {
        const options: Record<string, Entity[]> = {};
        for (const field of this.fields)
          if (field.relation)
            options[field.key] = await this.api.options(field.relation, {
              is_active: true,
            });
        if (generation === this.generation) this.choices.set(options);
      }
    } catch (error) {
      if (generation === this.generation)
        this.toast.fire({ icon: 'error', text: errorMessage(error) });
    } finally {
      if (generation === this.generation) this.preparing.set(false);
    }
  }
  toggleScope(scope: string, checked: boolean) {
    this.form.markAsDirty();
    const current = this.form.controls['scopes'].value as string[];
    this.form.controls['scopes'].setValue(
      checked
        ? [...current, scope]
        : current.filter((value) => value !== scope),
    );
  }
  assignmentKey(row: Entity): string {
    return this.key === 'accounts' ? row.external_id : row['key'];
  }
  toggleAssignment(key: string, checked: boolean) {
    this.assignmentDirty = true;
    this.selectedAssignments = checked
      ? [...this.selectedAssignments, key]
      : this.selectedAssignments.filter((value) => value !== key);
  }
  async save() {
    if (this.saving() || this.preparing()) return;
    const mode = this.mode();
    const row = this.selected();
    const generation = this.generation;
    const endpoint = this.definition.endpoint;
    if (!['create', 'edit', 'delete', 'assign'].includes(mode)) return;
    if (mode === 'create' || mode === 'edit') {
      this.form.markAllAsTouched();
      if (this.form.invalid) return;
    }
    this.saving.set(true);
    try {
      let result: { data: Entity } | undefined;
      if (mode === 'delete' && row)
        await firstValueFrom(this.api.delete(`${endpoint}/${row.external_id}`));
      else if (mode === 'assign' && row) {
        if (this.key === 'accounts')
          await firstValueFrom(
            this.api.post(`${endpoint}/${row.external_id}/roles`, {
              role_external_ids: this.selectedAssignments,
            }),
          );
        else
          await firstValueFrom(
            this.api.put(`${endpoint}/${row.external_id}/permissions`, {
              permission_keys: this.selectedAssignments,
            }),
          );
      } else {
        const payload = this.form.getRawValue();
        for (const field of this.fields) {
          if (payload[field.key] === '') {
            if (field.nullable && mode === 'edit') payload[field.key] = null;
            else delete payload[field.key];
          } else if (field.type === 'number' && payload[field.key] !== null)
            payload[field.key] = Number(payload[field.key]);
        }
        result = await firstValueFrom(
          mode === 'create'
            ? this.api.post(endpoint, payload)
            : this.api.patch(`${endpoint}/${row!.external_id}`, payload),
        );
      }
      if (generation !== this.generation) return;
      this.toast.fire({ icon: 'success', text: mode === 'delete'
          ? 'Registro desactivado o credencial revocada.'
          : 'Cambios guardados correctamente.' });
      if (result?.data['token']) {
        this.secret.set(result.data['token']);
        this.mode.set('secret');
        this.form.reset();
      } else this.close(true);
      this.load();
    } catch (error) {
      if (generation === this.generation)
        this.toast.fire({ icon: 'error', text: errorMessage(error) });
    } finally {
      this.saving.set(false);
    }
  }
}
