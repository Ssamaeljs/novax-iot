const { prompts } = require('./compose-prompts');

async function main() {
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!secret || secret.length < 32) throw new Error('Falta NOVAX_BOOTSTRAP_SECRET en el entorno del backend.');
  const input = prompts();
  let body;
  try {
    body = {
      first_name: await input.text('Nombre'),
      last_name: await input.text('Apellido'),
      id_card: await input.text('Documento o código de laboratorio (5–30 letras, dígitos o guiones)'),
      username: await input.text('Usuario (mínimo 3 caracteres)'),
      email: await input.text('Correo'),
      password: await input.secret('Contraseña (mínimo 12 caracteres; no se muestra)'),
    };
    const confirmation = await input.secret('Confirma la contraseña');
    if (confirmation !== body.password) throw new Error('Las contraseñas no coinciden.');
    if (body.password.length < 12 || Buffer.byteLength(body.password, 'utf8') > 72) throw new Error('La contraseña requiere al menos 12 caracteres y como máximo 72 bytes UTF-8.');
  } finally { input.close(); }

  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/v1/api/bootstrap`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-Bootstrap-Secret': secret },
    body: JSON.stringify(body),
  });
  if (response.status === 409) throw new Error('NOVAX ya fue inicializada. Entra con la cuenta existente; no reinicies la base.');
  if (response.status !== 201) {
    const error = await response.json().catch(() => ({}));
    const fields = Array.isArray(error.details) ? error.details.map((item) => item?.field).filter(Boolean) : [];
    throw new Error(`No se pudo inicializar NOVAX: HTTP ${response.status} ${error.code || ''}${fields.length ? ` (${fields.join(', ')})` : ''}`);
  }
  // El bootstrap también genera un token IAM. No se muestra ni se necesita para el login.
  await response.body?.cancel();
  console.log('NOVAX inicializada. Ya puedes iniciar sesión en la web con el usuario y contraseña indicados.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
