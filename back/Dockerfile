# Contexto de build = raiz do repositório (ver docker-compose.yml),
# pois o servidor serve os arquivos estáticos de ../front.
FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (melhor cache de camadas)
COPY back/package*.json ./back/
RUN cd back && npm install --omit=dev

# Código do servidor e front
COPY back ./back
COPY front ./front

EXPOSE 3000

CMD ["node", "back/server/index.js"]
