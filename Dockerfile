

# Build our Java app
FROM node:current-alpine AS java-build

WORKDIR /javasite

RUN apk add openjdk21
RUN apk add maven

COPY ./java/pom.xml .
COPY ./java/src ./src

RUN mvn -U compile package

# Build our Frontend install
FROM node:current-alpine AS frontend-build

WORKDIR /buildsite

# Install needed tools (won't have an impact if everything is all set)
RUN apk add npm nodejs
RUN npm update -g npm

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
FROM node:current-alpine

ENV WORKDIR=/website
WORKDIR ${WORKDIR}

# Allow port number overrides
ENV PORT_NUMBER=3000

# Allow override of the admin name
ARG ADMIN_NAME=admin

# Allow override of the admin email
ARG ADMIN_EMAIL=admin@arizona.edu

# Install python stuff
COPY ./requirements.txt ./
RUN apk add python3 py-pip
RUN apk add gdal
RUN apk add gdal-dev && \
    apk add python3-dev && \
    apk add gcc g++ && \
    python3 -m pip install --upgrade --no-cache-dir -r requirements.txt --break-system-packages && \
    apk del gcc g++ && \
    apk del python3-dev && \
    apk del gdal-dev

# Install additional tools and runtimes
RUN apk add openjdk21
RUN apk add exiftool

# Copy over the Java app
COPY --from=java-build /javasite/target/ExifWriter-1.0-jar-with-dependencies.jar ./ExifWriter.jar

# Copy over the built website
COPY --from=frontend-build /buildsite/out ./
RUN mkdir templates
RUN mv index.html templates/

# Copy the source code over
COPY --exclude=__pycache__ --exclude=.DS_Store ./server/ ./
#COPY ./server/camtrap ./camtrap
#COPY ./server/spd_database ./spd_database
#COPY ./server/spd_types ./spd_types
#COPY ./server/text_formatters ./text_formatters

# Build the default database
RUN rm *.sqlite    # Clean up any testing databases
RUN ./create_db.py --admin ${ADMIN_NAME} --admin_email ${ADMIN_EMAIL} $PWD sparcd.sqlite
RUN rm create_db.py

# Setup nginx
RUN mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.orig
COPY ./nginx.conf /etc/nginx/nginx.conf

# Expose the port
EXPOSE ${PORT_NUMBER}

# Setup the gunicorn environment
ENV SERVER_DIR=${WORKDIR} \
    WEB_SITE_URL="0.0.0.0:"${PORT_NUMBER} \
    SPARCD_DB=${WORKDIR}/sparcd.sqlite \
    SERVER_WORKERS=4

RUN echo nginx -g \'daemon on;\' > ${WORKDIR}/startup_server.sh
RUN echo gunicorn -w \$\{SERVER_WORKERS\} -b \$\{WEB_SITE_URL\} --access-logfile '-' sparcd:app --timeout 18000 >> ${WORKDIR}/startup_server.sh
RUN chmod +x ${WORKDIR}/startup_server.sh

ENTRYPOINT ["sh", "./startup_server.sh"]
