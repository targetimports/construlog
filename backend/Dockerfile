FROM node:20-alpine

# poppler-utils: renderiza PDF em imagem (pdftoppm) para o import de orçamento por PDF.
RUN apk add --no-cache poppler-utils

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000
CMD ["node", "src/server.js"]
