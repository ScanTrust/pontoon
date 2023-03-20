#!/bin/bash
#
echo "out/logs is going into '/app/server_run.log'"

# user pontoon stuff --> get env vars
(echo ">>> running as user: " && whoami) >> /app/server_run.log
if [ ! -z "$SSH_KEY" ]; then
    echo ">>> loading ssh key and kown_hosts for default user pontoon..." >> /app/server_run.log
    mkdir /home/pontoon/.ssh
    chmod 700 /home/pontoon/.ssh

    # To preserve newlines, the env var is base64 encoded. Flip it back.
    cat > /home/pontoon/.ssh/id_ed25519 <<< $SSH_KEY
    chmod 400 /home/pontoon/.ssh/id_ed25519
    # do the same to known_hosts
    cat > /home/pontoon/.ssh/known_hosts <<< $KNOWN_HOSTS
    chmod 400 /home/pontoon/.ssh/known_hosts
    # do the same to .gitconfig
    cat > /home/pontoon/.gitconfig <<< $GIT_CONFIG
    chmod 400 /home/pontoon/.gitconfig

    chown -R pontoon:pontoon /home/pontoon/.ssh/
    echo "...done." >> /app/server_run.log
fi

echo ">>> Setting up the db for Django" >> /app/server_run.log
python manage.py migrate >> /app/server_run.log

echo ">>> Starting local server as user pontoon" >> /app/server_run.log