FROM node:20

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
RUN npm ci

RUN npx playwright install --with-deps