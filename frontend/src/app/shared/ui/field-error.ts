import { AbstractControl } from '@angular/forms';

export function fieldError(control: AbstractControl): string {
  const errors = control.errors;
  if (!errors) return '';
  if (errors['required']) return 'Este campo es obligatorio.';
  if (errors['email']) return 'Introduce un correo válido, por ejemplo nombre@novax.ec.';
  if (errors['minlength']) return `Introduce al menos ${errors['minlength'].requiredLength} caracteres.`;
  if (errors['maxlength']) return `No superes ${errors['maxlength'].requiredLength} caracteres.`;
  if (errors['min']) return `El valor mínimo es ${errors['min'].min}.`;
  if (errors['max']) return `El valor máximo es ${errors['max'].max}.`;
  return 'Revisa el formato de este campo.';
}
