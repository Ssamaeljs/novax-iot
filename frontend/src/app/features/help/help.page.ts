import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthState } from '../../core/auth/auth-state.service';

@Component({
  imports: [RouterLink], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title"><div><p>AYUDA</p><h1>Guía de uso de NOVAX</h1><p>Desde el dispositivo hasta la visualización de sus mediciones.</p></div></header>
    <section class="panel card-body stack"><h2>Primeros pasos</h2>
      <ol class="steps">
        <li><strong>Registra el dispositivo.</strong> Indica nombre, tipo y protocolo. Su código se genera automáticamente. Registrar un equipo no establece una conexión de red.
          @if (state.has('devices.read')) { <a routerLink="/app/operations/devices">Abrir dispositivos</a> }</li>
        <li><strong>Asocia sus sensores.</strong> Define la clave técnica, magnitud, unidad y tipo de dato. Un dispositivo puede tener varios sensores.
          @if (state.has('sensors.read')) { <a routerLink="/app/operations/sensors">Abrir sensores</a> }</li>
        <li><strong>Recibe o registra mediciones.</strong> Cada lectura pertenece a un sensor e incluye fecha, valor y calidad. El registro manual sirve para pruebas; no sustituye la integración del equipo.
          @if (state.has('measurements.write')) { <a routerLink="/app/operations/measurements">Registrar una lectura</a> }</li>
        <li><strong>Consulta el histórico.</strong> Filtra por sensor y fechas. Selecciona un sensor numérico para ver su gráfico. Las fechas del filtro usan la hora local de tu navegador; los resultados muestran la zona horaria de NOVAX.
          @if (state.has('measurements.read')) { <a routerLink="/app/monitoring">Consultar mediciones</a> }</li>
        <li><strong>Crea un proyecto y configura su tablero.</strong> Abre «Editar tablero», añade widgets, selecciona sensores, aplica las propiedades y pulsa «Guardar tablero».
          @if (state.has('projects.read')) { <a routerLink="/app/projects">Abrir proyectos</a> }</li>
      </ol>
    </section>
    <section class="panel card-body stack"><h2>Preguntas frecuentes</h2>
      <details><summary>No aparece una opción o no puedo editar</summary><p>Las acciones dependen de tus permisos. Solicita al administrador la revisión de tu cuenta y sus roles; no necesitas crear otra cuenta.</p></details>
      <details><summary>El widget no muestra datos</summary><p>Comprueba que el sensor tenga mediciones, que hayas guardado sus asociaciones y que tu cuenta permita consultar mediciones. Amplía el periodo del histórico. Los indicadores muestran la última lectura, no garantizan que el dispositivo esté conectado ahora.</p></details>
      <details><summary>¿Cómo funcionan los colores y los bloqueos?</summary><p>Las condiciones de color se evalúan en orden: gana la primera coincidencia y se muestra una etiqueta. No generan alertas ni notificaciones. «Fijar» impide mover o redimensionar; «Liberar» permite editar la posición de nuevo.</p></details>
      <details><summary>¿Cómo muevo un widget sin arrastrar?</summary><p>Usa las flechas con el manejador enfocado o introduce posición y tamaño en sus propiedades. En móvil los widgets se apilan sin modificar el diseño guardado.</p></details>
      <details><summary>¿Qué datos muestran los gráficos?</summary><p>El tablero consulta hasta 200 muestras por sensor del periodo seleccionado, sin agregaciones, y actualiza cada 30 segundos. El historial de monitorización representa la página consultada. No son promedios diarios, mensuales ni anuales.</p></details>
      <details><summary>¿Cómo recupero mi contraseña?</summary><p>Usa «¿Olvidaste tu contraseña?» al iniciar sesión. Si el correo no está configurado, el administrador debe gestionar la recuperación local. Nunca compartas contraseñas ni tokens por capturas de pantalla.</p></details>
      <details><summary>¿Cómo conecto un dispositivo por HTTPS o MQTT?</summary><p>Un administrador publica un modelo de campos y conversiones, registra los sensores correspondientes y crea una fuente con dispositivo y versión. La fuente entrega su credencial una sola vez. Prueba el formato desde Modelos de datos antes de enviar telemetría. Cambiar el modelo requiere una versión nueva y una fuente explícita; no modifica el histórico.</p>@if (state.has('integrations.read')) { <a routerLink="/app/integrations">Abrir integraciones</a> }</details>
    </section>
    <section class="panel card-body stack"><h2>Antes de pedir ayuda</h2><p>Anota la pantalla, la acción, el mensaje de error y la hora aproximada. No incluyas contraseñas, tokens ni datos personales innecesarios.</p><a routerLink="/app/account">Revisar mi cuenta</a></section>`,
  styles: `:host{display:grid;gap:1.25rem}.steps{display:grid;gap:1.25rem;padding-left:1.5rem}li,p{line-height:1.75;font-size:.9rem}li a{display:block;width:fit-content;margin-top:.35rem}details{border-bottom:1px solid var(--border-default);padding:.75rem 0}summary{cursor:pointer;font-weight:600}details p{margin-top:.75rem;color:var(--text-secondary)}`,
})
export class HelpPage { readonly state = inject(AuthState); }
