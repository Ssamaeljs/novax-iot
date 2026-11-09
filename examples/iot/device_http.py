"""Simula un dispositivo que envía telemetría por HTTP o HTTPS a NOVAX."""

import json
import ssl
from urllib.error import HTTPError, URLError
from urllib.request import HTTPSHandler, HTTPRedirectHandler, ProxyHandler, Request, build_opener

from telemetry import (
    RetryableError,
    SimulationError,
    endpoint,
    error_code,
    parse_args,
    parser_for,
    run,
    simulate,
    source_token,
)


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def response_data(response):
    try:
        value = json.loads(response.read(128 * 1024))
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def post(opener, url, token, message, timeout):
    request = Request(
        url,
        data=json.dumps(message, allow_nan=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with opener.open(request, timeout=timeout) as response:
            status = response.status
            data = response_data(response).get("data")
    except HTTPError as error:
        with error:
            code = error_code(response_data(error).get("code"), f"HTTP_{error.code}")
        failure = RetryableError if error.code == 429 or 500 <= error.code < 600 else SimulationError
        raise failure(f"NOVAX devolvió HTTP {error.code} ({code}).") from error
    except URLError as error:
        if isinstance(error.reason, ssl.SSLError):
            raise SimulationError(f"No se pudo verificar la conexión TLS: {error.reason}.") from error
        raise RetryableError(f"No se pudo completar el POST: {error.reason}.") from error
    except (ConnectionError, TimeoutError) as error:
        raise RetryableError(f"Se interrumpió el POST: {error}.") from error

    if isinstance(data, dict):
        if status == 201 and data.get("duplicate") is False:
            return "ACCEPTED", data
        if status == 200 and data.get("duplicate") is True:
            return "DUPLICATE", data
    raise SimulationError(f"La respuesta HTTP {status} no confirmó la recepción de NOVAX.")


def main():
    parser = parser_for(__doc__)
    parser.add_argument("--base-url", default="http://localhost:8080", help="Origen HTTP(S) de la aplicación")
    args = parse_args(parser)
    base = endpoint(args.base_url, "http", "https", args.allow_insecure)
    if args.ca_file and base.scheme != "https":
        parser.error("--ca-file requiere una URL https://.")
    tls = ssl.create_default_context(cafile=args.ca_file)
    opener = build_opener(ProxyHandler({}), NoRedirects(), HTTPSHandler(context=tls))
    token = source_token()
    url = f"{base.scheme}://{base.netloc}/v1/api/ingest/https/{args.source}"
    simulate(args, lambda message: post(opener, url, token, message, args.timeout))


if __name__ == "__main__":
    raise SystemExit(run(main))
