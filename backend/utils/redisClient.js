// backend/utils/redisClient.js
const Redis = require("ioredis");
const { redisHost, sentinelPorts, redisMasterName } = require("../config/keys");

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  async connect() {
    if (
      this.client &&
      (this.client.status === "connecting" ||
        this.client.status === "connected")
    ) {
      console.log("Redis client is already connecting or connected.");
      return this.client;
    }

    try {
      console.log("Connecting to Redis Sentinel...");

      this.client = new Redis({
        sentinels: [
          { host: "10.0.158.228", port: 26381 },
          { host: "10.0.158.228", port: 26382 },
          { host: "10.0.158.228", port: 26383 },
        ],
        name: redisMasterName,
        sentinelReconnectStrategy: (retries) => {
          if (retries > this.maxRetries) {
            return null;
          }
          return Math.min(retries * 50, 2000);
        },
      });

      this.client.on("connect", () => {
        console.log("Redis Sentinel Connected");
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.client.on("error", (err) => {
        console.error("Redis Sentinel Error:", err);
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error("Redis Sentinel connection error:", error);
      this.isConnected = false;
      this.retryConnection();
      throw error;
    }
  }

  async retryConnection() {
    if (this.connectionAttempts < this.maxRetries) {
      this.connectionAttempts++;
      console.log(`Retrying connection in ${this.retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      return this.connect();
    }
    console.error("Max retry attempts reached. Could not connect to Redis.");
  }

  async set(key, value, options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        await this.connect();
      }
      if (!this.isConnected || !this.client) {
        await this.connect();
      }

      let stringValue;
      if (typeof value === "object") {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }

      if (options.ttl) {
        return await this.setEx(key, options.ttl, stringValue);
      }
      return await this.client.set(key, stringValue);
    } catch (error) {
      console.error("Redis set error:", error);
      throw error;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected || !this.client) {
        await this.connect();
      }

      const value = await this.client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value);
      } catch (parseError) {
        return value; // 일반 문자열인 경우 그대로 반환
      }
    } catch (error) {
      console.error("Redis get error:", error);
      throw error;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected || !this.client) {
        await this.connect();
      }
      return await this.client.del(key);
    } catch (error) {
      console.error("Redis del error:", error);
      throw error;
    }
  }

  async expire(key, seconds) {
    try {
      if (!this.isConnected || !this.client) {
        await this.connect();
      }
      return await this.client.expire(key, seconds);
    } catch (error) {
      console.error("Redis expire error:", error);
      throw error;
    }
  }

  async quit() {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        this.client = null;
        console.log("Redis Sentinel connection closed successfully");
      } catch (error) {
        console.error("Redis quit error:", error);
        throw error;
      }
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
