import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, HostListener, inject, Injector, NgZone, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { ProjectApi } from './project-api.service';
import { Board, Project, ProjectSensor, SensorTelemetry, WidgetDraft, WidgetLayout, WidgetType } from './project.models';
import { freePosition, validLayout } from './board-layout';
import { WidgetViewComponent } from './widgets/widget-view.component';
import { WidgetEditorComponent } from './widget-editor.component';

interface Interaction { key: string; kind: 'move' | 'resize'; origin: WidgetLayout; x: number; y: number; step: number; dirty: boolean; }
@Component({
  imports: [FormsModule, RouterLink, WidgetViewComponent, WidgetEditorComponent],
  templateUrl: './project-board.page.html', styleUrl: './project-board.page.css', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectBoardPage implements OnInit {
  readonly state = inject(AuthState);
  private readonly api = inject(ApiService);
  private readonly projects = inject(ProjectApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  private id = ''; private generation = 0; private telemetryGeneration = 0; private version = 0;
  private interaction: Interaction | null = null;
  private destroyed = false;
  readonly project = signal<Project | null>(null);
  readonly widgets = signal<WidgetDraft[]>([]);
  readonly sensors = signal<ProjectSensor[]>([]);
  readonly telemetry = signal<SensorTelemetry[]>([]);
  readonly loading = signal(true); readonly saving = signal(false); readonly refreshing = signal(false);
  readonly dirty = signal(false); readonly editing = signal(false); readonly sidebar = signal(false);
  readonly error = signal(''); readonly dataError = signal(''); readonly notice = signal(''); readonly optionsError = signal('');
  readonly selectedKey = signal(''); readonly updated = signal('');
  readonly selected = computed(() => this.widgets().find((widget) => widget.key === this.selectedKey()) || null);
  readonly canEdit = computed(() => this.state.has('projects.manage') && this.state.has('sensors.read'));
  readonly rows = computed(() => Math.max(7, ...this.widgets().map((widget) => widget.layout.y + widget.layout.height)));
  readonly catalog: { type: WidgetType; title: string; description: string }[] = [
    { type: 'THERMOMETER', title: 'Termómetro', description: 'Lectura actual y escala vertical' },
    { type: 'GAUGE', title: 'Gauge', description: 'Indicador de lectura y límites' },
    { type: 'TIMELINE', title: 'Línea temporal', description: 'Histórico o comparación de hasta seis sensores' },
    { type: 'HTML', title: 'HTML personalizado', description: 'HTML y CSS con campos de los sensores' },
  ];
  range = '24h';
  constructor() { this.destroyRef.onDestroy(() => { this.destroyed = true; this.generation++; this.telemetryGeneration++; }); }
  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => { this.id = params.get('external_id') || ''; void this.load(); });
    if (this.canEdit()) void this.api.options('iot/sensors', { is_active: true }).then((rows) => { if (!this.destroyed) this.sensors.set(rows as unknown as ProjectSensor[]); }).catch((error) => { if (!this.destroyed) this.optionsError.set(errorMessage(error)); });
    const browser = this.document.defaultView;
    if (browser) {
      const timer = this.zone.runOutsideAngular(() => browser.setInterval(() => { if (this.state.has('measurements.read')) this.zone.run(() => void this.refresh()); }, 30000));
      this.destroyRef.onDestroy(() => browser.clearInterval(timer));
    }
  }
  private receive(board: Board) {
    this.project.set(board.project); this.version = board.version;
    this.widgets.set(board.widgets.map((widget) => ({ ...widget, key: widget.external_id! })));
    this.selectedKey.set(''); this.dirty.set(false);
  }
  async load() {
    if (this.dirty() && !this.document.defaultView?.confirm('Se descartarán los cambios del tablero sin guardar. ¿Continuar?')) return;
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(''); this.telemetry.set([]); this.telemetryGeneration++; this.refreshing.set(false);
    try {
      const board = await this.projects.board(this.id);
      if (this.destroyed || generation !== this.generation) return;
      this.receive(board); void this.refresh(true);
    } catch (error) { if (generation === this.generation) this.error.set(errorMessage(error)); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  async refresh(force = false) {
    if (!this.project() || !this.state.has('measurements.read') || (this.refreshing() && !force)) return;
    const generation = ++this.telemetryGeneration;
    this.refreshing.set(true); this.dataError.set('');
    try {
      const data = await this.projects.telemetry(this.id, this.range);
      if (this.destroyed || generation !== this.telemetryGeneration) return;
      this.telemetry.set(data.series); this.updated.set(new Date().toLocaleTimeString('es'));
    } catch (error) { if (generation === this.telemetryGeneration) this.dataError.set(errorMessage(error)); }
    finally { if (generation === this.telemetryGeneration) this.refreshing.set(false); }
  }
  changeRange() { this.telemetry.set([]); void this.refresh(true); }
  togglePanel() { if (this.sidebar()) this.sidebar.set(false); else this.revealPanel(); }
  private revealPanel() {
    this.sidebar.set(true);
    afterNextRender(() => {
      if (!this.document.defaultView?.matchMedia('(max-width: 800px)').matches) return;
      const panel = this.document.getElementById('widget-sidebar');
      panel?.scrollIntoView({ block: 'start' });
      panel?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
  toggleEditing() {
    if (!this.canEdit()) return;
    if (this.editing() && this.dirty()) { this.error.set('Guarda o descarta tus cambios antes de finalizar la edición.'); return; }
    this.editing.update((value) => !value); this.sidebar.set(this.editing()); this.error.set('');
    if (this.editing()) this.revealPanel();
  }
  add(type: WidgetType) {
    if (!this.editing() || !this.canEdit() || this.saving()) return;
    if (this.widgets().length >= 30) { this.error.set('El tablero admite hasta 30 widgets.'); return; }
    const sensor = this.sensors().find((sensor) => sensor.is_active && (type === 'HTML' || sensor.data_type === 'NUMBER'));
    if (!sensor) { this.error.set('Primero registra un sensor compatible o revisa el catálogo de sensores.'); return; }
    const layout = freePosition(this.widgets(), type === 'TIMELINE' ? 8 : 4, 5);
    if (!layout) { this.error.set('No queda espacio disponible en el tablero.'); return; }
    const widget: WidgetDraft = { key: crypto.randomUUID(), title: this.catalog.find((item) => item.type === type)!.title, type, layout, sensor_external_ids: [sensor.external_id], sensors: [sensor],
      settings: type === 'HTML' ? { html: '<div class="reading"><h3>{{name}}</h3><strong>{{value}} {{unit}}</strong><p>{{observed_at}}</p></div>', css: '.reading{text-align:center;padding:1rem}.reading strong{font-size:2rem;color:var(--primary)}.reading p{color:var(--text-muted)}' } : type === 'TIMELINE' ? {} : { min: 0, max: 100 },
    };
    this.widgets.update((items) => [...items, widget]); this.selectedKey.set(widget.key); this.revealPanel(); this.changed();
  }
  apply(widget: WidgetDraft) {
    if (!this.editing() || !this.canEdit() || this.saving()) return;
    const current = this.widgets().find((item) => item.key === widget.key);
    if (!current || !validLayout(widget.layout, this.widgets(), widget.key)) { this.error.set('Revisa la posición, el tamaño y los espacios ocupados.'); return; }
    if (current.layout.locked && ['x', 'y', 'width', 'height'].some((key) => current.layout[key as keyof WidgetLayout] !== widget.layout[key as keyof WidgetLayout])) { this.error.set('Desbloquea el widget antes de cambiar su posición o tamaño.'); return; }
    this.widgets.update((items) => items.map((item) => item.key === widget.key ? widget : item)); this.changed();
  }
  select(widget: WidgetDraft) { this.selectedKey.set(widget.key); this.revealPanel(); }
  lock(widget: WidgetDraft) {
    if (!this.editing() || !this.canEdit() || this.saving()) return;
    this.widgets.update((items) => items.map((item) => item.key === widget.key ? { ...item, layout: { ...item.layout, locked: !item.layout.locked } } : item)); this.changed();
  }
  remove(widget: WidgetDraft) {
    if (!this.editing() || !this.canEdit() || this.saving() || !this.document.defaultView?.confirm(`¿Quitar «${widget.title}» del tablero?`)) return;
    this.widgets.update((items) => items.filter((item) => item.key !== widget.key));
    if (this.selectedKey() === widget.key) this.selectedKey.set('');
    this.changed();
  }
  private changed() { this.dirty.set(true); this.error.set(''); this.notice.set(''); }
  async save() {
    if (!this.canEdit() || this.saving() || !this.dirty()) return;
    const generation = this.generation;
    this.saving.set(true); this.error.set('');
    try {
      const board = await this.projects.save(this.id, this.version, this.widgets());
      if (this.destroyed || generation !== this.generation) return;
      this.receive(board); this.notice.set('Tablero guardado.'); void this.refresh(true);
    }
    catch (error) { if (generation === this.generation) this.error.set(errorMessage(error)); }
    finally { if (generation === this.generation) this.saving.set(false); }
  }
  startInteraction(event: PointerEvent, widget: WidgetDraft, kind: 'move' | 'resize') {
    if (!this.editing() || !this.canEdit() || widget.layout.locked || this.saving() || event.button !== 0) return;
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.interaction = { key: widget.key, kind, origin: { ...widget.layout }, x: event.clientX, y: event.clientY, step: (canvas.getBoundingClientRect().width + 12) / 12, dirty: this.dirty() };
  }
  moveInteraction(event: PointerEvent) {
    const drag = this.interaction;
    if (!drag) return;
    const dx = Math.round((event.clientX - drag.x) / drag.step); const dy = Math.round((event.clientY - drag.y) / 60);
    const layout = drag.kind === 'move' ? { ...drag.origin, x: Math.max(0, Math.min(12 - drag.origin.width, drag.origin.x + dx)), y: Math.max(0, Math.min(200, drag.origin.y + dy)) } : { ...drag.origin, width: Math.max(3, Math.min(12 - drag.origin.x, drag.origin.width + dx)), height: Math.max(3, Math.min(16, drag.origin.height + dy)) };
    if (validLayout(layout, this.widgets(), drag.key)) { this.widgets.update((items) => items.map((item) => item.key === drag.key ? { ...item, layout } : item)); this.changed(); }
  }
  endInteraction() { this.interaction = null; }
  cancelInteraction() {
    const drag = this.interaction;
    if (drag) { this.widgets.update((items) => items.map((item) => item.key === drag.key ? { ...item, layout: drag.origin } : item)); this.dirty.set(drag.dirty); }
    this.interaction = null;
  }
  keyInteraction(event: KeyboardEvent, widget: WidgetDraft, resize = false) {
    if (!this.editing() || !this.canEdit() || widget.layout.locked || this.saving()) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key]; if (!direction) return;
    event.preventDefault(); const [dx, dy] = direction;
    const layout = resize ? { ...widget.layout, width: widget.layout.width + dx, height: widget.layout.height + dy } : { ...widget.layout, x: widget.layout.x + dx, y: widget.layout.y + dy };
    if (validLayout(layout, this.widgets(), widget.key)) { this.widgets.update((items) => items.map((item) => item.key === widget.key ? { ...item, layout } : item)); this.changed(); }
  }
  canLeave(): boolean { return !this.saving() && (!this.dirty() || !!this.document.defaultView?.confirm('Hay cambios sin guardar. ¿Salir del tablero?')); }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) { if (this.dirty()) event.preventDefault(); }
}
