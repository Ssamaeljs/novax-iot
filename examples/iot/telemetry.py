"""Formato y opciones compartidas por los simuladores de NOVAX IoT."""

import argparse
import getpass
import ipaddress
import json
import math
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID, uuid4


class SimulationError(Exception):
    pass


class RetryableError(SimulationError):
    pass


def finite_number(text):
    number = float(text)
    if not math.isfinite(number):
        raise argparse.ArgumentTypeError("Usa un número finito.")
    return number


def parser_for(description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--source", required=True, type=UUID, help="UUID público de la fuente")
    parser.add_argument("--humidity", type=finite_number, default=80, help="Humedad inicial en %%")
    parser.add_argument("--temperature", type=finite_number, help="Añade el campo temperature en °C")
    parser.add_argument("--jitter", type=finite_number, default=0, help="Variación máxima de humedad")
    parser.add_argument("--payload-file", type=Path, help="Objeto JSON que reemplaza el payload generado")
    parser.add_argument("--count", type=int, default=1, help="Cantidad de observaciones (por defecto, 1)")
    parser.add_argument("--interval", type=finite_number, default=5, help="Segundos entre observaciones")
    parser.add_argument("--timeout", type=finite_number, default=12, help="Tiempo de espera en segundos")
    parser.add_argument("--retries", type=int, default=2, help="Reintentos ante fallos transitorios")
    parser.add_argument("--ca-file", type=Path, help="Certificado de la CA privada en formato PEM")
    parser.add_argument("--allow-insecure", action="store_true", help="Permite tráfico sin TLS fuera de loopback")
    return parser


def parse_args(parser):
    args = parser.parse_args()
    if args.source.version not in range(1, 9):
        parser.error("--source debe ser un UUID válido de NOVAX.")
    if not 0 <= args.humidity <= 100 or not 0 <= args.jitter <= 100:
        parser.error("--humidity y --jitter deben estar entre 0 y 100.")
    if args.count < 1 or args.interval < 0 or args.timeout <= 0 or args.retries < 0:
        parser.error("Usa count >= 1, interval >= 0, timeout > 0 y retries >= 0.")
    args.payload = None
    if args.payload_file:
        try:
            args.payload = json.loads(args.payload_file.read_text(encoding="utf-8-sig"))
            json.dumps(args.payload, allow_nan=False)
        except (OSError, ValueError) as error:
            parser.error(f"El archivo de payload debe contener JSON válido: {error}")
        if not isinstance(args.payload, dict):
            parser.error("El payload debe ser un objeto JSON.")
    return args


def endpoint(raw_url, plain_scheme, tls_scheme, allow_insecure):
    url = urlsplit(raw_url)
    if (
        url.scheme not in (plain_scheme, tls_scheme)
        or not url.hostname
        or url.username is not None
        or url.password is not None
        or url.path not in ("", "/")
        or url.query
        or url.fragment
        or url.port == 0
    ):
        raise SimulationError(f"Indica una URL base {plain_scheme}:// o {tls_scheme}:// con host y puerto opcional.")
    if url.scheme == plain_scheme and not allow_insecure:
        host = url.hostname.lower()
        try:
            local = ipaddress.ip_address(host).is_loopback
        except ValueError:
            local = host == "localhost"
        if not local:
            raise SimulationError("Usa TLS o indica --allow-insecure para una prueba sin TLS en tu red.")
    return url


def secret(env_name, prompt):
    value = os.environ.get(env_name)
    if not value and sys.stdin.isatty():
        value = getpass.getpass(prompt + ": ")
    if not value:
        raise SimulationError(f"Define {env_name} o ejecuta el simulador en una terminal interactiva.")
    return value


def source_token():
    token = secret("NOVAX_SOURCE_TOKEN", "Credencial de la fuente NOVAX")
    if not re.fullmatch(r"nvx_ingest_[A-Za-z0-9_-]{43}", token):
        raise SimulationError("La credencial no tiene el formato de un token de fuente NOVAX.")
    return token


def telemetry_message(args):
    payload = args.payload
    if payload is None:
        humidity = args.humidity + random.uniform(-args.jitter, args.jitter)
        payload = {"humidity": round(min(100, max(0, humidity)), 1)}
        if args.temperature is not None:
            payload["temperature"] = args.temperature
    return {
        "schema_version": 1,
        "message_id": str(uuid4()),
        "observed_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "payload": payload,
    }


def error_code(value, fallback):
    if isinstance(value, str) and re.fullmatch(r"[A-Z][A-Z0-9_]{1,63}", value):
        return value
    return fallback


def simulate(args, send):
    for number in range(1, args.count + 1):
        message = telemetry_message(args)
        for attempt in range(args.retries + 1):
            try:
                status, result = send(message)
                break
            except RetryableError as error:
                if attempt == args.retries:
                    raise SimulationError(f"{error} Último mensaje: {message['message_id']} (entrega sin confirmar).") from error
                delay = min(2 ** min(attempt, 3), 8)
                print(f"{error} Reintentando en {delay} s con el mismo message_id.", file=sys.stderr)
                time.sleep(delay)
        print(
            f"{number}/{args.count} {status} | lecturas: {result.get('reading_count', '?')}"
            f" | mensaje: {message['message_id']} | recepción: {result.get('external_id', '?')}",
            flush=True,
        )
        if number < args.count:
            time.sleep(args.interval)


def run(main):
    try:
        main()
    except (SimulationError, OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Simulación detenida.", file=sys.stderr)
        return 130
    return 0
