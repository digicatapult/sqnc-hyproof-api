# syntax=docker/dockerfile:1.6
FROM node:lts-alpine as builder

WORKDIR /sqnc-hyproof-api

# Install base dependencies
RUN npm install -g npm@latest

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci
COPY . .
RUN npm run build

# service
FROM node:lts-alpine as service

WORKDIR /sqnc-hyproof-api

RUN apk add --update coreutils
RUN npm -g install npm@10.x.x

COPY package*.json ./
COPY processFlows.json ./

RUN npm ci --production

RUN npm install @digicatapult/sqnc-process-management@latest

COPY --from=builder /sqnc-hyproof-api/build ./build

EXPOSE 80
CMD [ "npm", "start" ]
