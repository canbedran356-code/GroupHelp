FROM node:20

WORKDIR /app

# package dosyalarını kopyala
COPY package*.json ./

# dependency kur
RUN npm install

# tüm projeyi kopyala
COPY . .

# uygulamayı başlat
CMD ["npm", "start"]
