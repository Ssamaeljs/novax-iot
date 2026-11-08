// Presets describe measurement channels, not separate physical inventory items.
export const sensorPresets = [
  { id: 'dht11-temperature', label: 'DHT11 · Temperatura', name: 'Temperatura DHT11', key: 'dht11_temperature', metric: 'temperature', unit: '°C', data_type: 'NUMBER' },
  { id: 'dht11-humidity', label: 'DHT11 · Humedad', name: 'Humedad DHT11', key: 'dht11_humidity', metric: 'humidity', unit: '%', data_type: 'NUMBER' },
  { id: 'pir-presence', label: 'PIR · Presencia', name: 'Presencia PIR', key: 'pir_presence', metric: 'presence', unit: '', data_type: 'BOOLEAN' },
] as const;
