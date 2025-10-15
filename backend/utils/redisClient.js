// backend/utils/redisClient.js
const Redis = require('ioredis');
const redis = new Redis(); // configure host/password if needed
module.exports = redis;