FROM debian:latest
ENV DEBIAN_FRONTEND="noninteractive"
RUN apt update && \
  apt install -y git curl wget sudo procps zsh tar screen ca-certificates procps lsb-release xdg-utils g++ libatomic1 libnss3 libatk-bridge2.0-0 gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxrandr2 libxrender1 libxss1 libxtst6 fonts-liberation libnss3 libgbm-dev

# Install latest node
RUN VERSION=$(wget -qO- https://api.github.com/repos/Sirherobrine23/DebianNodejsFiles/releases/latest |grep 'name' | grep "nodejs"|grep "$(dpkg --print-architecture)"|cut -d '"' -f 4 | sed 's|nodejs_||g' | sed -e 's|_.*.deb||g'|sort | uniq|tail -n 1); wget -q "https://github.com/Sirherobrine23/DebianNodejsFiles/releases/download/debs/nodejs_${VERSION}_$(dpkg --print-architecture).deb" -O /tmp/nodejs.deb && dpkg -i /tmp/nodejs.deb && rm -rfv /tmp/nodejs.deb && npm install -g npm@latest

# Install Docker and Docker Compose
VOLUME [ "/var/lib/docker" ]
RUN curl https://get.docker.com | sh && \
  compose_version=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4); \
  wget -q "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-$(uname -s)-$(uname -m)" -O /usr/local/bin/docker-compose && \
  chmod +x /usr/local/bin/docker-compose

# Add non root user
ARG USERNAME=gitpod
ARG USER_UID=1000
ARG USER_GID=$USER_UID
RUN \
  groupadd --gid $USER_GID $USERNAME && adduser --disabled-password --gecos "" --uid $USER_UID --gid $USER_GID --shell /usr/bin/zsh $USERNAME && \
  usermod -aG sudo $USERNAME && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/$USERNAME && chmod 0440 /etc/sudoers.d/$USERNAME && \
  usermod -aG docker $USERNAME

USER $USERNAME
WORKDIR /home/$USERNAME

# Install oh my zsh
RUN yes | sh -c "$(curl -fsSL https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh)" && \
  git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ~/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting && \
  git clone https://github.com/zsh-users/zsh-autosuggestions ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions && \
  sed -e 's|ZSH_THEME=".*"|ZSH_THEME="strug"|g' -i ~/.zshrc && \
  sed -e 's|plugins=(.*)|plugins=(git docker zsh-syntax-highlighting zsh-autosuggestions)|g' -i ~/.zshrc

# Install Project global packages
RUN sudo npm install -g ts-node typescript

# Create Start Script
ARG DOCKERD_ARGS=""
RUN (\
echo "#""!/bin/bash";\
echo "set -e";\
echo "if ! [[ -z \"\$@\" ]]; then";\
echo "  (sudo dockerd $DOCKERD_ARGS) &";\
echo "  sh -c \"\$@\"";\
echo "  while (ps -ef | grep -v grep | grep -q dockerd); do sleep 8s; done";\
echo "  echo Dockerd stopped";\
echo "  exit 2";\
echo "else";\
echo "  sudo dockerd";\
echo "fi";\
)|sudo tee /usr/local/bin/start.sh && sudo chmod +x /usr/local/bin/start.sh

# Start Docker Engine
ENTRYPOINT [ "/usr/local/bin/start.sh" ]