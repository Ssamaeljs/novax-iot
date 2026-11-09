"""Simula un ESP32 que publica telemetría en el broker MQTT de NOVAX."""

import json
import os
import time

from telemetry import (
    RetryableError,
    SimulationError,
    endpoint,
    error_code,
    parse_args,
    parser_for,
    run,
    secret,
    simulate,
    source_token,
)


def publish(mqtt, args, broker, password, token, message):
    topic = f"novax/v1/sources/{args.source}"
    ack_topic = f"{topic}/ack"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, protocol=mqtt.MQTTv311)
    client.connect_timeout = args.timeout
    client.username_pw_set(args.username, password)
    if broker.scheme == "mqtts":
        client.tls_set(ca_certs=str(args.ca_file) if args.ca_file else None)

    subscribed = False
    failure = None
    ack = None

    def on_connect(client, _userdata, _flags, reason, _properties):
        nonlocal failure
        if reason.is_failure:
            failure = f"El broker rechazó la conexión: {reason}."
        elif client.subscribe(ack_topic, qos=1)[0] != mqtt.MQTT_ERR_SUCCESS:
            failure = "No se pudo solicitar la suscripción al tópico /ack."

    def on_subscribe(_client, _userdata, _mid, reasons, _properties):
        nonlocal subscribed, failure
        subscribed = bool(reasons) and all(not reason.is_failure for reason in reasons)
        if not subscribed:
            failure = "El broker rechazó la suscripción al tópico /ack."

    def on_message(_client, _userdata, packet):
        nonlocal ack
        if packet.topic != ack_topic or packet.retain:
            return
        try:
            result = json.loads(packet.payload)
        except ValueError:
            return
        if isinstance(result, dict) and result.get("message_id") == message["message_id"]:
            ack = result

    def wait_for(complete, timeout_message):
        deadline = time.monotonic() + args.timeout
        while not complete():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RetryableError(timeout_message)
            result = client.loop(timeout=min(remaining, 1))
            if failure:
                raise SimulationError(failure)
            if result != mqtt.MQTT_ERR_SUCCESS and not complete():
                raise RetryableError(f"Se interrumpió la conexión MQTT: {mqtt.error_string(result)}.")

    client.on_connect = on_connect
    client.on_subscribe = on_subscribe
    client.on_message = on_message
    port = broker.port or (8883 if broker.scheme == "mqtts" else 1883)
    try:
        if client.connect(broker.hostname, port, keepalive=60) != mqtt.MQTT_ERR_SUCCESS:
            raise RetryableError("No se pudo iniciar la conexión MQTT.")
        wait_for(lambda: subscribed, "El broker no confirmó la suscripción a /ack.")
        body = json.dumps({"token": token, "message": message}, allow_nan=False)
        if client.publish(f"{topic}/telemetry", body, qos=1, retain=False).rc != mqtt.MQTT_ERR_SUCCESS:
            raise RetryableError("No se pudo publicar la telemetría.")
        wait_for(lambda: ack is not None, "No llegó el ACK de aplicación de NOVAX.")
    except (ConnectionError, TimeoutError) as error:
        raise RetryableError(f"El broker MQTT no está disponible: {error}.") from error
    finally:
        client.disconnect()

    status = ack.get("status")
    if status in ("ACCEPTED", "DUPLICATE"):
        return status, ack
    raise SimulationError(
        f"NOVAX devolvió {error_code(status, 'ACK_INVALIDO')} "
        f"{error_code(ack.get('code'), 'SIN_CODIGO')}."
    )


def main():
    parser = parser_for(__doc__)
    parser.add_argument("--broker", default="mqtt://127.0.0.1:1883", help="URL del broker MQTT o MQTTS")
    parser.add_argument("--username", default=os.getenv("MQTT_TEST_USERNAME", "novax_emitter"), help="Usuario del broker")
    args = parse_args(parser)
    broker = endpoint(args.broker, "mqtt", "mqtts", args.allow_insecure)
    if args.ca_file and broker.scheme != "mqtts":
        parser.error("--ca-file requiere un broker mqtts://.")
    try:
        from paho.mqtt import client as mqtt
    except ImportError as error:
        raise SimulationError("Instala paho-mqtt con: python -m pip install -r examples/iot/requirements.txt") from error
    password = secret("MQTT_TEST_PASSWORD", "Contraseña del usuario del broker")
    token = source_token()
    simulate(args, lambda message: publish(mqtt, args, broker, password, token, message))


if __name__ == "__main__":
    raise SystemExit(run(main))
