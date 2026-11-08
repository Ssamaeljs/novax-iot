#!/bin/sh
set -eu
exec mosquitto_pub -V mqttv5 -h 127.0.0.1 -p 1883 \
  -u "$MQTT_TEST_USERNAME" -P "$MQTT_TEST_PASSWORD" -q 1 -n -t novax/lab/health
