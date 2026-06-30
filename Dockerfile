# syntax=docker/dockerfile:1.7-labs
# Parser directive above must remain on line 1. The 1.7-labs frontend
# enables the COPY --exclude flag used when copying ./server/ below.

# Build our Java app
FROM node:current-alpine AS java-build

WORKDIR /javasite

RUN apk add --no-cache openjdk21 maven

COPY ./java/pom.xml .
COPY ./java/src ./src

RUN mvn -U compile package


# Build our Frontend install
FROM node:current-alpine AS frontend-build

WORKDIR /buildsite

# Install pnpm. Keep this version in sync with the "packageManager" field in
# package.json so local and container builds resolve the same dependency tree.
RUN npm install -g pnpm@10.20.0

# Install dependencies. The lockfile is intentionally not committed to source
# control (per project policy), so pnpm resolves and writes pnpm-lock.yaml
# fresh during the build. The generated lockfile is copied into the final
# image (see below) so it can be inspected for debugging a specific build.
COPY ./package.json ./

RUN pnpm install

# Copy other files where we want them
COPY ./next.config.js ./
COPY ./public ./public
COPY ./app ./app

# Build the node packages
RUN pnpm run build


# Build the final image
FROM nginx:alpine

ENV WORKDIR=/website
WORKDIR ${WORKDIR}

# Install python stuff
COPY ./requirements.txt ./

# Install all runtime dependencies and Python packages in a single layer.
# Build tools (gcc, g++, gdal-dev, python3-dev) are removed at the end of
# the same RUN instruction so they are never persisted in the image
RUN apk add --no-cache \
        python3 \
        py-pip \
        gdal \
        ffmpeg \
        openjdk21 \
        exiftool \
        openssl \
        gdal-dev \
        python3-dev \
        gcc \
        g++ && \
    pip install --upgrade --no-cache-dir \
        -r requirements.txt \
        --break-system-packages && \
    apk del \
        gdal-dev \
        python3-dev \
        gcc \
        g++

# Copy over the Java app
COPY --from=java-build /javasite/target/ExifWriter-1.0-jar-with-dependencies.jar ./ExifWriter.jar

# Copy over the built website
COPY --from=frontend-build /buildsite/out ./

# Copy the lockfile that pnpm generated during the frontend build so the
# exact versions of every transitive dependency that went into this image
# are inspectable for debugging.
COPY --from=frontend-build /buildsite/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy the source code over
COPY --exclude=__pycache__ --exclude=.DS_Store ./server/ ./
COPY --exclude=__pycache__ --exclude=.DS_Store ./scripts/ ./scripts/

# Set up runtime state. `rm -f *.sqlite` uses -f so the build does not fail
# when the source tree has no checked-in .sqlite file (the *.sqlite glob is
# in .gitignore, so a clean clone won't have one).
RUN mkdir templates && \
    mv index.html templates/ && \
    rm -f *.sqlite && \
    python3 create_db.py $PWD sparcd.sqlite && \
    rm create_db.py && \
    rm -f requirements.txt .DS_Store

# Generate a self-signed certificate to work without a domain name
# This certificate is good for 10 years. Clients will need to accept the
# certificate
COPY ./openssl.cnf /tmp/openssl.cnf
RUN mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 3650 --newkey rsa:2048 \
            -keyout /etc/nginx/certs/private.key \
            -out /etc/nginx/certs/public.crt \
            -config /tmp/openssl.cnf && \
    rm /tmp/openssl.cnf

# Setup nginx
RUN mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.orig
COPY ./nginx.conf /etc/nginx/nginx.conf

# Allow port number overrides
ENV PORT_NUMBER=3000
ENV HTTPS_PORT=443

# Allow worker and thread overrides
ENV SERVER_WORKERS=4
ENV SERVER_THREADS=4

# Expose the port
EXPOSE ${HTTPS_PORT}

# Setup the gunicorn environment - gunicorn binds to localhost since nginx handles public facing tasks
ENV SERVER_DIR=${WORKDIR} \
    WEB_SITE_URL="127.0.0.1:"${PORT_NUMBER} \
    SPARCD_DB=${WORKDIR}/sparcd.sqlite \
    SERVER_WORKERS=${SERVER_WORKERS} \
    SERVER_THREADS=${SERVER_THREADS}

RUN echo "nginx -g 'daemon on;'" > ${WORKDIR}/startup_server.sh
RUN echo "echo gunicorn: Workers: " \$\{SERVER_WORKERS\} "Threads: " \$\{SERVER_THREADS\} "Url: " \$\{WEB_SITE_URL\} >> ${WORKDIR}/startup_server.sh
RUN echo gunicorn  -w \$\{SERVER_WORKERS\} --threads \$\{SERVER_THREADS\} -b \$\{WEB_SITE_URL\} --access-logfile '-' sparcd:app --timeout 18000 >> ${WORKDIR}/startup_server.sh
RUN chmod +x ${WORKDIR}/startup_server.sh

ENTRYPOINT ["sh", "./startup_server.sh"]
