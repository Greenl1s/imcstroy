FROM node:20-alpine
WORKDIR /app
# poppler-utils даёт pdftoppm — нужен, чтобы превращать страницы
# отсканированных/сфотографированных PDF в картинки для распознавания ИИ.
RUN apk add --no-cache poppler-utils
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY web ./web
COPY templates ./templates
EXPOSE 3000
CMD ["node", "src/server.js"]
