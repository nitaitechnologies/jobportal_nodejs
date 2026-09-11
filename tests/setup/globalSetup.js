/**
 * Starts MongoMemoryServer and writes URI for Jest workers.
 * Guarantees tests never touch the developer `workindia` database.
 */
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('workindia_test');
  const file = path.join(__dirname, '../../.jest-mongo-uri');
  fs.writeFileSync(file, uri, 'utf8');
  global.__MONGO_MEMORY_SERVER__ = mongod;
};
