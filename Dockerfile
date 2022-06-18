FROM debian:latest
LABEL name="OFVp Server" \
  org.opencontainers.image.title="OFVp Deamon Maneger" \
  org.opencontainers.image.description="Main docker image to maneger anothers docker images." \
  org.opencontainers.image.vendor="ofvp_project" \
  org.opencontainers.image.licenses="GPL-3.0-or-later" \
  org.opencontainers.image.source="https://github.com/OFVp-Project/DeamonManeger.git"

# Install Wget and Node.js
ARG DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt install -y wget && \
  wget -qO- https://raw.githubusercontent.com/Sirherobrine23/DebianNodejsFiles/main/debianInstall.sh | bash && \
  rm -rf /var/lib/apt/*

# Setup Project Environments
ENV \
  # MongoDB String connection
  MONGO_URL="mongodb://localhost:27017/OFVpServer" \
  # Cookie Secret Key
  COOKIE_SECRET="" \
  # Passowrd to encrypt SSH Passowrd
  PASSWORD_SECRET="" \
  # Daemon Config
  DAEMON_USERNAME="" \
  DAEMON_PASSWORD="" \
  # Wireguard Hostname and Port, if you want to use on wireguard APIs, on default is requests host.
  WIREGUARD_HOST="" \
  WIREGUARD_PORT="" \
  # OpenSSH Hostname and Port, if you want to use on OpenSSH APIs, on default is requests host.
  SSH_HOST="" \
  SSH_PORT=""

# Export API port
EXPOSE 3000/tcp

# Volume definition to Storage any files genereated by the APIs and Manegers.
VOLUME [ "/data" ]

# Install PM2 to run the APIs and Manegers.
WORKDIR /app
RUN npm i -g pm2
ENTRYPOINT [ "pm2-runtime", "start", "ecosystem.config.js" ]

# Install Packages
COPY package*.json ./
RUN npm install --no-save

# Build
COPY ./ ./
RUN npm run build
ENV NODE_ENV = "production"