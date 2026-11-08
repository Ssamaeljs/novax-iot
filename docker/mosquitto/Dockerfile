FROM eclipse-mosquitto:2.0.22
USER root
RUN mkdir -p /mosquitto/runtime && chown 1883:1883 /mosquitto/runtime
COPY mosquitto.conf /mosquitto/config/novax.conf
COPY --chmod=755 entrypoint.sh /usr/local/bin/novax-broker-start
COPY --chmod=755 healthcheck.sh /usr/local/bin/novax-broker-health
USER 1883:1883
EXPOSE 1883
ENTRYPOINT ["/bin/sh", "/usr/local/bin/novax-broker-start"]
