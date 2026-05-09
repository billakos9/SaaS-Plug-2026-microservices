# ---------- Base image ----------
FROM node AS base

WORKDIR /saas26-09

# ---------- Install dependencies ----------
FROM base AS deps
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "src/app.js"]
