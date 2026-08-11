FROM node:12.22.3-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install 
COPY . .
CMD ["node", "index.js"]