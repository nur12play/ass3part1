require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "assn3db";
const collectionName = process.env.COLLECTION_NAME || "items";

const products = [
  { name: "iPhone 13", price: 500, category: "smartphone", brand: "Apple" },
  { name: "iPhone 14", price: 650, category: "smartphone", brand: "Apple" },
  { name: "iPhone 15", price: 850, category: "smartphone", brand: "Apple" },
  { name: "Samsung Galaxy S22", price: 480, category: "smartphone", brand: "Samsung" },
  { name: "Samsung Galaxy S23", price: 620, category: "smartphone", brand: "Samsung" },
  { name: "Xiaomi Mi 12", price: 430, category: "smartphone", brand: "Xiaomi" },
  { name: "Xiaomi Mi 13", price: 510, category: "smartphone", brand: "Xiaomi" },
  { name: "MacBook Air M1", price: 900, category: "laptop", brand: "Apple" },
  { name: "MacBook Air M2", price: 1200, category: "laptop", brand: "Apple" },
  { name: "Dell XPS 13", price: 1100, category: "laptop", brand: "Dell" },
  { name: "HP Spectre x360", price: 1050, category: "laptop", brand: "HP" },
  { name: "iPad Pro 11", price: 780, category: "tablet", brand: "Apple" },
  { name: "iPad Air", price: 600, category: "tablet", brand: "Apple" },
  { name: "Samsung Galaxy Tab S8", price: 670, category: "tablet", brand: "Samsung" },
  { name: "Apple Watch Series 8", price: 420, category: "watch", brand: "Apple" },
  { name: "Apple Watch Ultra", price: 750, category: "watch", brand: "Apple" },
  { name: "AirPods Pro", price: 250, category: "audio", brand: "Apple" },
  { name: "Sony WH-1000XM5", price: 330, category: "audio", brand: "Sony" },
  { name: "JBL Charge 5", price: 180, category: "audio", brand: "JBL" },
  { name: "Logitech MX Master 3", price: 120, category: "accessory", brand: "Logitech" },
];

async function seed() {
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const col = db.collection(collectionName);

  await col.deleteMany({}); // очищаем перед сидом

  const docs = products.map((p, i) => ({
    ...p,
    sku: `SKU-${1000 + i}`,
    inStock: true,
    createdAt: new Date(),
  }));

  await col.insertMany(docs);

  console.log(`✅ Seed completed: ${docs.length} products added`);
  await client.close();
}

seed().catch((err) => {
  console.error("❌ Seed error:", err);
});
