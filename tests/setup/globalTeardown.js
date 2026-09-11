const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const mongod = global.__MONGO_MEMORY_SERVER__;
  if (mongod) {
    await mongod.stop();
  }
  const file = path.join(__dirname, '../../.jest-mongo-uri');
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
};
