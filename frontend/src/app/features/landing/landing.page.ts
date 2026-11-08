import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
@Component({
  imports: [RouterLink, IconComponent],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  readonly capabilities: {
    number: string;
    icon: IconName;
    title: string;
    text: string;
  }[] = [
    {
      number: '01',
      icon: 'device',
      title: 'Organiza tu infraestructura',
      text: 'Un inventario común para dispositivos heterogéneos, sensores y equipos IP. Cada sensor conserva su métrica y unidad.',
    },
    {
      number: '02',
      icon: 'activity',
      title: 'Comprende tus mediciones',
      text: 'Consulta lecturas por sensor y periodo, su calidad y su origen. Información trazable para tomar decisiones.',
    },
    {
      number: '03',
      icon: 'shield',
      title: 'Controla quién puede actuar',
      text: 'Roles, permisos y auditoría para NOVAX. Acceso claro para cada integrante de tu equipo.',
    },
  ];
}
