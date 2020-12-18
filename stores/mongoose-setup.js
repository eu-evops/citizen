const mongoose = require('mongoose');

console.log('Hello World', new Error().stack);

const connectionOptions = { useUnifiedTopology: true, useNewUrlParser: true };
const dbUri = process.env.CITIZEN_MONGO_DB_URI || 'mongodb://localhost:27017/citizen';
// mongoose.set('debug', true);
// mongoose.Promise = Promise;
mongoose.connect(dbUri, connectionOptions);

module.exports = mongoose;
