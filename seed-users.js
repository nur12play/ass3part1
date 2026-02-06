require("dotenv").config();
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "assn3db";
const USERS_COL = "users";

const users = [
  { username: "admin", password: "admin123" },
  { username: "manager", password: "manager123" },
  { username: "user", password: "user123" },
];

async function seedUsers() {
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const col = db.collection(USERS_COL);

  // очистим users перед сидом (нормально для ассаймента)
  await col.deleteMany({});

  const docs = [];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);

    docs.push({
      username: u.username.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    });
  }

  await col.insertMany(docs);

  console.log(`✅ Seed users completed: ${docs.length} users added`);
  console.log("Accounts:");
  users.forEach((u) =>
    console.log(`- ${u.username} / ${u.password}`)
  );

  await client.close();
}

seedUsers().catch((err) => {
  console.error("❌ Seed users error:", err);
});
