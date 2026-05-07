# ---------- Base image ----------
FROM node AS base

WORKDIR /saas26-09

# ---------- Install dependencies ----------
FROM base AS deps
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3002

CMD ["node", "src/app.js"]