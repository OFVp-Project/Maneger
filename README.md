# What is Ofvp Project

OFVp Project was born out of a need to be a free alternative to VPN solutions that are self-managing and easy to maintain and update.

> **Note**
> currently this project is under construction and possible daily maintenance having several APIs being completely rewritten and updated without support with previous versions of the project, any migration package can be written in the future but for now you will have to manually export users to the new version.

## Avaibles Server's and Proxys

* [Wireguard Server](https://github.com/OFVp-Project/Wireguard) create Wireguard tunnel.
* [SSH Server](https://github.com/OFVp-Project/SSH-Server) SSH. Server to only port forwarding (tunneling ports).
  * [wsProxy](https://github.com/OFVp-Project/webproxy) Proxy SSH with websocket.

## Requirements

All servers run in a container available for Docker, podmam* and Kubernetes.

> **Note**
> if you are going to use Wireguard you will have to install Wireguard on your system, and run the Wireguard container in privileged mode because you will have to mount the system modules inside the container, if not, any type of error will occur within Wireguard and will not work, and the system must also have iptables installed for Wireguard route forwarding.
>
> * Required Wireguard installed.
> * Required iptables installed.
>
> Quick install:
>
> debian/ubuntu install: `sudo apt update && sudo apt install -y dkms wireguard iptables`.

1. Docker, podman or Kubernets.
2. MongoDB server or Mongo Atlas server.

## Config examples

### Docker Compose and Docker swan

```yaml
version: "3.9"
networks:
  defaultOfvpNetwork:
volumes:
  mongoStorage:
  sshStorage:

services:
  # mongo Server
  mongodb:
    image: mongo
    restart: always
    command: "--bind_ip_all --port 27017 --noauth --quiet --logpath /dev/null"
    networks: [defaultOfvpNetwork]
    volumes: [mongoStorage:/data/db]

  # Manger and main Controler
  ofvpmaneger:
    image: ghcr.io/ofvp-project/deamonmaneger:latest
    ports: [3000:3000/tcp]
    networks: [defaultOfvpNetwork]
    depends_on: [mongodb]
    environment:
      MongoDB_URL: "mongodb://mongodb:27017/ofvp"
      COOKIE_SECRET: "${COOKIESECRET}"
      PASSWORD_ENCRYPT: "${PASSWORDENCRYPT}"
      DAEMON_USERNAME: "${DAEMONUSERNAME}"
      DAEMON_PASSWORD: "${DAEMONPASSWORD}"

  # SSH Server
  ssh:
    image: ghcr.io/ofvp-project/ssh-server:latest
    restart: on-failure
    depends_on: [ofvpmaneger]
    networks: [defaultOfvpNetwork]
    ports: [2222:22/tcp]
    volumes: [sshStorage:/data]
    environment:
      DAEMON_HOST: "http://ofvpmaneger:5000"
      PASSWORD_ENCRYPT: "${PASSWORDENCRYPT}"
      DAEMON_USERNAME: "${DAEMONUSERNAME}"
      DAEMON_PASSWORD: "${DAEMONPASSWORD}"

  # Websocket proxy SSH
  webproxy:
    image: ghcr.io/ofvp-project/webproxy:latest
    restart: on-failure
    depends_on: [ssh]
    networks: [defaultOfvpNetwork]
    ports: [8080:80/tcp]
    command: "-l 1 --ssh ssh:22"

  # Wireguard Server
  wireguard:
    image: ghcr.io/ofvp-project/wireguard:latest
    restart: on-failure
    depends_on: [ofvpmaneger]
    networks: [defaultOfvpNetwork]
    ports: [51820:51820/udp]
    volumes: [/lib/modules/:/lib/modules/:ro]
    sysctls:
      net.ipv4.conf.all.src_valid_mark: 1
      net.ipv6.conf.all.disable_ipv6: 0
      net.ipv6.conf.all.forwarding: 1
      net.ipv4.ip_forward: 1
    environment:
      DAEMON_HOST: "http://ofvpmaneger:5000"
      DAEMON_USERNAME: "${DAEMONUSERNAME}"
      DAEMON_PASSWORD: "${DAEMONPASSWORD}"
```

## Recommend Clouds

### [Oracle Clous infrastructure](https://cloud.oracle.com/)

Oracle offers a 30-day free tier, but also a generous always free tier with one/several general-purpose arm64/aarch64 VMs, and an infrastructure well spread across the globe.

### [Digital Ocean](https://www.digitalocean.com/)

Recommend by develops.
