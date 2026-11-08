#!/bin/sh
set -eu
umask 077

for username in "$MQTT_USERNAME" "$MQTT_TEST_USERNAME"; do
  case "$username" in
    ''|*[!a-zA-Z0-9_-]*) echo 'Usuario MQTT inválido' >&2; exit 1 ;;
  esac
done
if [ "$MQTT_USERNAME" = "$MQTT_TEST_USERNAME" ] || [ "$MQTT_PASSWORD" = "$MQTT_TEST_PASSWORD" ]; then
  echo 'El backend y el emisor requieren usuarios y contraseñas distintos' >&2
  exit 1
fi
if [ "${#MQTT_PASSWORD}" -lt 16 ] || [ "${#MQTT_TEST_PASSWORD}" -lt 16 ]; then
  echo 'Configura contraseñas MQTT de al menos 16 caracteres' >&2
  exit 1
fi

mosquitto_passwd -b -c /mosquitto/runtime/passwd "$MQTT_USERNAME" "$MQTT_PASSWORD"
mosquitto_passwd -b /mosquitto/runtime/passwd "$MQTT_TEST_USERNAME" "$MQTT_TEST_PASSWORD"
{
  printf 'user %s\ntopic read novax/v1/sources/+/telemetry\ntopic write novax/v1/sources/+/ack\n\n' "$MQTT_USERNAME"
  printf 'user %s\ntopic write novax/v1/sources/+/telemetry\ntopic read novax/v1/sources/+/ack\ntopic write novax/lab/health\n' "$MQTT_TEST_USERNAME"
} > /mosquitto/runtime/acl

exec mosquitto -c /mosquitto/config/novax.conf
