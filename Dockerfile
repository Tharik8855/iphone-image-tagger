FROM node:20-bookworm-slim

# imagemagick + libheif (x265) = real HEIC encoding; heif-enc (libheif-examples) adds the
# built-in HEIC preview; perl is needed by exiftool
RUN apt-get update && apt-get install -y --no-install-recommends \
      imagemagick libheif1 libheif-examples libx265-199 perl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
