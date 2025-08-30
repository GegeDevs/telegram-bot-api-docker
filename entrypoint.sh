#!/bin/sh
/telegram-bot-api.sh &
/docker-entrypoint.sh $@
