const { readFileSync } = require('node:fs');

function score(responses) {
  if (!Array.isArray(responses) || responses.length !== 10 ||
      responses.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) {
    throw new Error('Cada participante necesita exactamente diez respuestas enteras de 1 a 5, sin omisiones.');
  }
  return responses.reduce((sum, value, index) => sum + (index % 2 === 0 ? value - 1 : 5 - value), 0) * 2.5;
}
function summarize(participants) {
  if (!Array.isArray(participants) || !participants.length) throw new Error('No hay participantes: todavía no se puede calcular SUS.');
  const ids = new Set();
  const scores = participants.map((item) => {
    if (!item || !/^P\d{2,4}$/.test(item.participant) || ids.has(item.participant)) throw new Error('Usa identificadores únicos y anónimos P01, P02…');
    ids.add(item.participant);
    return { participant: item.participant, score: score(item.responses) };
  });
  const values = scores.map((item) => item.score).sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const median = n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
  const deviation = n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, median, min: values[0], max: values[n - 1], sample_standard_deviation: deviation, scores };
}
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Uso: node tools/sus-score.cjs ruta-a-respuestas.json');
    console.log(JSON.stringify(summarize(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { score, summarize };
