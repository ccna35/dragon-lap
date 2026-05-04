FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npm run prisma:generate

COPY . .

RUN npm run build

CMD ["npm", "run", "start:prod"]