const { MongoClient } = require("mongodb");

let client;
let db;

async function connectToMongo({ uri, dbName }) {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  console.log(`✅ MongoDB connected: ${uri} / ${dbName}`);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error("MongoDB is not connected. Call connectToMongo() first.");
  }
  return db;
}

async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
}

module.exports = { connectToMongo, getDb, closeMongo };
