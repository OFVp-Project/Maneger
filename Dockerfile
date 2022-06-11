FROM debian:latest AS server
LABEL name="OFVp Server" \
  org.opencontainers.image.title="OFVp Deamon Maneger" \
  org.opencontainers.image.description="Main docker image to maneger anothers docker images." \
  org.opencontainers.image.vendor="ofvp_project" \
  org.opencontainers.image.licenses="GPL-3.0-or-later" \
  org.opencontainers.image.source="https://github.com/OFVp-Project/DeamonManeger.git"

# iNSTALL Wget
ARG DEBIAN_FRONTEND="noninteractive"
RUN apt update && apt install -y wget && rm -rf /var/lib/apt/*

# Install latest node.js
RUN wget -qO- https://raw.githubusercontent.com/Sirherobrine23/DebianNodejsFiles/main/debianInstall.sh | bash

# Setup Project
ENV MongoDB_URL="mongodb://localhost:27017/OFVpServer" \
  COOKIE_SECRET="" \
  PASSWORD_ENCRYPT="" \
  WIREGUARD_HOST="" \
  WIREGUARD_PORT="" \
  OPENSSH_HOST="" \
  OPENSSH_PORT=""

EXPOSE 3000/tcp
VOLUME [ "/data" ]
RUN npm i -g pm2
WORKDIR /usr/src/Backend
ENTRYPOINT [ "pm2-runtime", "start", "ecosystem.config.js" ]
COPY package*.json ./
RUN npm install --no-save
COPY ./ ./
RUN npm run build
ENV NODE_ENV="production"