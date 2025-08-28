FROM --platform=$BUILDPLATFORM alpine:latest AS builder

RUN apk add bc curl git wget binutils linux-headers && \
 	apk add alpine-sdk make cmake zlib-dev openssl-dev gperf clang clang-static clang-dev llvm-dev llvm-static && \
	git clone --recursive https://github.com/tdlib/telegram-bot-api.git /root/tdlib && \
 	cd /root/tdlib && \
 	mkdir -p /root/tdlib/build && \
 	cd /root/tdlib/build && \
 	cmake -DCMAKE_BUILD_TYPE=Release .. && \
 	cmake --build . --target install && \
	mkdir -p /builded && \
	cp -r $(which telegram-bot-api) /builded && \
	strip /builded/telegram-bot-api

FROM nginx:1.29.1-alpine

ENV	TELEGRAM_WORK_DIR="/var/lib/telegram-bot-api" \
	TELEGRAM_TEMP_DIR="/tmp/telegram-bot-api"

RUN apk add --no-cache --update openssl libstdc++
COPY --from=builder /builded/telegram-bot-api /usr/local/bin/telegram-bot-api
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY telegram-bot-api.sh /telegram-bot-api.sh
COPY nginx.sh /nginx.sh
COPY entrypoint.sh /entrypoint.sh

RUN addgroup -g 102 -S telegram-bot-api && \
	adduser -S -D -H -u 102 -h ${TELEGRAM_WORK_DIR} -s /sbin/nologin -G telegram-bot-api -g telegram-bot-api telegram-bot-api && \
	chmod +x /entrypoint.sh && \
	mkdir -p ${TELEGRAM_WORK_DIR} ${TELEGRAM_TEMP_DIR} && \
	chown telegram-bot-api:telegram-bot-api ${TELEGRAM_WORK_DIR} ${TELEGRAM_TEMP_DIR}

EXPOSE 80/tcp
ENTRYPOINT ["/entrypoint.sh"]