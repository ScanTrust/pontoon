FROM python:3.11.9-alpine AS server

ARG USER_ID=1000
ARG GROUP_ID=1000

ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONPATH /app

# Install required software
RUN apk update \
    && apk upgrade \
    && apk add --no-cache \
        # Build dependencies
        build-base \
        libmemcached-dev \
        postgresql15-dev \
        postgresql15-client \
        # Node.js
        nodejs \
        npm \
        # Required for building some Python packages
        python3-dev \
        gcc \
        musl-dev \
        libffi-dev \
        bash

# Install uv (version should match the one used in Python GitHub workflows)
COPY --from=ghcr.io/astral-sh/uv:0.5.7 /uv /usr/local/bin/uv

WORKDIR /app

# Install Pontoon Python requirements
COPY requirements/* /app/requirements/
RUN uv pip install --system -r requirements/default.txt -r requirements/dev.txt -r requirements/test.txt -r requirements/lint.txt

# Create the app user
RUN addgroup -g ${GROUP_ID} pontoon && \
    adduser -D -u ${USER_ID} -G pontoon pontoon
RUN chown -R pontoon:pontoon /app
USER pontoon

# Install the server's Node.js requirements
ENV YUGLIFY_BINARY /app/node_modules/.bin/yuglify
ENV TERSER_BINARY /app/node_modules/.bin/terser
COPY --chown=pontoon:pontoon pontoon/package.json .
RUN npm install

COPY --chown=pontoon:pontoon ./docker/config/server.env .env
COPY --chown=pontoon:pontoon . /app/

RUN python manage.py collectstatic

STOPSIGNAL SIGINT
CMD ["/app/docker/server_run.sh"]
