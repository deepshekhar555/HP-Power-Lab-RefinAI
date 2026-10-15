FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dashboard/ ./dashboard/
COPY docs/ ./docs/
COPY ml/ ./ml/
COPY server.js ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
