FROM node:22

WORKDIR /app

COPY services/dev-seeder/package*.json ./
RUN npm install

COPY services/dev-seeder/src ./src
COPY mock_data ./mock_data

CMD ["npm", "run", "seed"]
