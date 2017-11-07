FROM node:8

COPY index.js .
COPY package.json .
RUN npm install

CMD [ "node", "index.js" ]
