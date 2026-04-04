

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

# Install needed tools (won't have an impact if everything is all set)
RUN apk add --no-cache npm nodejs && \
    npm update -g npm

# Install the package dependencies
COPY ./package.json ./

RUN npm install

# Copy other files where we want them
COPY ./next.config.js ./
COPY ./public ./public
COPY ./app ./app

# Build the node packages
RUN npm run build


# Build the final image
FROM nginx:alpine

ENV WORKDIR=/website
WORKDIR ${WORKDIR}

# Allow port number overrides
ENV PORT_NUMBER=3000
ENV HTTPS_PORT=443


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

# Copy the source code over
COPY --exclude=__pycache__ --exclude=.DS_Store ./server/ ./

RUN mkdir templates && \
    mv index.html templates/ && \
    rm *.sqlite    && \
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

# Expose the port
EXPOSE ${HTTPS_PORT}

# Setup the gunicorn environment - gunicorn binds to localhost since nginx handles public facing tasks
ENV SERVER_DIR=${WORKDIR} \
    WEB_SITE_URL="127.0.0.1:"${PORT_NUMBER} \
    SPARCD_DB=${WORKDIR}/sparcd.sqlite \
    SERVER_WORKERS=4

RUN echo "nginx -g 'daemon on;'" > ${WORKDIR}/startup_server.sh
RUN echo gunicorn -w \$\{SERVER_WORKERS\} -b \$\{WEB_SITE_URL\} --access-logfile '-' sparcd:app --timeout 18000 >> ${WORKDIR}/startup_server.sh
RUN chmod +x ${WORKDIR}/startup_server.sh

ENTRYPOINT ["sh", "./startup_server.sh"]
