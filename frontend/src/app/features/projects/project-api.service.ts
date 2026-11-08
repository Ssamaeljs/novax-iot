import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { Board, BoardTelemetry, WidgetDraft } from './project.models';
@Injectable({ providedIn: 'root' })
export class ProjectApi {
  private readonly api = inject(ApiService);
  async board(id: string): Promise<Board> {
    return (await firstValueFrom(this.api.get<Board>(`projects/${id}/board`))).data;
  }
  async save(id: string, version: number, widgets: WidgetDraft[]): Promise<Board> {
    const body = { version, widgets: widgets.map(({ external_id, title, type, layout, settings, sensor_external_ids }) => ({ ...(external_id ? { external_id } : {}), title, type, layout, settings, sensor_external_ids })) };
    return (await firstValueFrom(this.api.put<Board>(`projects/${id}/board`, body))).data;
  }
  async telemetry(id: string, range: string): Promise<BoardTelemetry> {
    return (await firstValueFrom(this.api.get<BoardTelemetry>(`projects/${id}/telemetry?range=${encodeURIComponent(range)}`))).data;
  }
}
