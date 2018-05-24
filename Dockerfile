FROM node:8.11.2@sha256:bba8a9c445fefc3e53fb2dfdfa755b0c119ae9f9999637e3b96ea37fae89d5d0

WORKDIR /probot-app-release-pr-compare

COPY package.json /probot-app-release-pr-compare/

RUN npm install
