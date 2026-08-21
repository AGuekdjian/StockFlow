import mongoose from 'mongoose';

export class MongoConnection {
  #logger;
  #uri;
  #available = false;
  #connecting = null;
  #everConnected = false;

  constructor({ uri, logger }) {
    this.#uri = uri;
    this.#logger = logger;
  }
  get available() {
    return this.#available && mongoose.connection.readyState === 1;
  }
  async connect() {
    if (this.available) return true;
    if (this.#connecting) return this.#connecting;
    this.#connecting = this.#attemptConnect();
    try {
      return await this.#connecting;
    } finally {
      this.#connecting = null;
    }
  }
  async #attemptConnect() {
    try {
      await mongoose.connect(this.#uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
      this.#available = true;
      this.#logger.info(
        { event: this.#everConnected ? 'mongodb.recovered' : 'mongodb.connected' },
        'MongoDB conectado',
      );
      this.#everConnected = true;
      return true;
    } catch (error) {
      this.#available = false;
      this.#logger.warn(
        { event: 'mongodb.unavailable', errorName: error.name, errorCode: error.code },
        'MongoDB no disponible; modo degradado',
      );
      return false;
    }
  }
  async close() {
    if (this.#connecting) await this.#connecting;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    this.#available = false;
  }
}
