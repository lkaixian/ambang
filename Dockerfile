FROM node:20-alpine
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev
COPY app/ ./
RUN mkdir -p data /cache && chown node:node data /cache
USER node
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "server.js"]
