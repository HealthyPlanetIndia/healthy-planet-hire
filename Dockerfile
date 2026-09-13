# Single-service image: builds the web app, then runs the API which also serves the web app.
FROM node:20-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web ./
RUN npm run build

FROM node:20-slim
WORKDIR /app/server
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/src ./src
COPY --from=web /app/web/dist /app/web/dist
RUN mkdir -p /app/server/data
ENV PORT=4000 DATA_DIR=/app/server/data
EXPOSE 4000
CMD ["node", "src/index.js"]
