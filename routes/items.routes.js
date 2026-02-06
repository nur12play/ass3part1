const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../database/mongo");

const router = express.Router();

/**
 * Helpers
 */
function isValidObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

function normalizeId(doc) {
  if (!doc) return doc;
  return { ...doc, _id: String(doc._id) };
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function parseSort(sortStr) {
  if (!sortStr) return {};
  const parts = String(sortStr)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const sort = {};
  for (const p of parts) {
    if (p.startsWith("-")) sort[p.slice(1)] = -1;
    else sort[p] = 1;
  }
  return sort;
}

function parseProjection(fieldsStr) {
  if (!fieldsStr) return {};
  const parts = String(fieldsStr)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const proj = {};
  for (const f of parts) proj[f] = 1;
  return proj;
}

function coerceValue(v) {
  if (v === "true") return true;
  if (v === "false") return false;

  const num = Number(v);
  if (!Number.isNaN(num) && String(v).trim() !== "") return num;

  return v;
}

function buildFilterFromQuery(query) {
  const filter = {};
  for (const [key, value] of Object.entries(query)) {
    if (["sort", "fields", "limit", "skip"].includes(key)) continue;

    if (typeof value === "string" && value.includes(",")) {
      filter[key] = { $in: value.split(",").map((x) => coerceValue(x.trim())) };
    } else {
      filter[key] = coerceValue(value);
    }
  }
  return filter;
}

function validateItemBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body must be a JSON object." };
  }

  const { name, price } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return { ok: false, message: "Field 'name' is required (min 2 chars)." };
  }
  if (price === undefined || typeof price !== "number" || Number.isNaN(price)) {
    return { ok: false, message: "Field 'price' is required (number)." };
  }

  return { ok: true };
}

/**
 * GET /api/items
 */
router.get("/", async (req, res) => {
  try {
    const db = getDb();
    const col = db.collection(process.env.COLLECTION_NAME || "items");

    const filter = buildFilterFromQuery(req.query);
    const sort = parseSort(req.query.sort);
    const projection = parseProjection(req.query.fields);

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const skip = Math.max(Number(req.query.skip || 0), 0);

    const cursor = col.find(filter, {
      projection: Object.keys(projection).length ? projection : undefined,
    });

    if (Object.keys(sort).length) cursor.sort(sort);
    cursor.skip(skip).limit(limit);

    const items = await cursor.toArray();

    // ✅ normalize ids for frontend stability
    return res.status(200).json(items.map(normalizeId));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/items/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const db = getDb();
    const col = db.collection(process.env.COLLECTION_NAME || "items");

    const item = await col.findOne({ _id: new ObjectId(id) });
    if (!item) return res.status(404).json({ error: "Not Found" });

    return res.status(200).json(normalizeId(item));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/items (protected)
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const check = validateItemBody(req.body);
    if (!check.ok) {
      return res.status(400).json({ error: check.message });
    }

    const db = getDb();
    const col = db.collection(process.env.COLLECTION_NAME || "items");

    const doc = {
      name: req.body.name.trim(),
      price: req.body.price,
      category: typeof req.body.category === "string" ? req.body.category.trim() : "general",
      inStock: typeof req.body.inStock === "boolean" ? req.body.inStock : true,
      createdAt: new Date(),
    };

    const result = await col.insertOne(doc);
    const created = await col.findOne({ _id: result.insertedId });

    return res.status(201).json(normalizeId(created));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * PUT /api/items/:id (protected)
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "Body is required" });
    }

    const update = {};

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || req.body.name.trim().length < 2) {
        return res.status(400).json({ error: "Field 'name' must be min 2 chars" });
      }
      update.name = req.body.name.trim();
    }

    if (req.body.price !== undefined) {
      if (typeof req.body.price !== "number" || Number.isNaN(req.body.price)) {
        return res.status(400).json({ error: "Field 'price' must be a number" });
      }
      update.price = req.body.price;
    }

    if (req.body.category !== undefined) {
      if (typeof req.body.category !== "string") {
        return res.status(400).json({ error: "Field 'category' must be a string" });
      }
      update.category = req.body.category.trim();
    }

    if (req.body.inStock !== undefined) {
      if (typeof req.body.inStock !== "boolean") {
        return res.status(400).json({ error: "Field 'inStock' must be boolean" });
      }
      update.inStock = req.body.inStock;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    update.updatedAt = new Date();

    const db = getDb();
    const col = db.collection(process.env.COLLECTION_NAME || "items");

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result.value) return res.status(404).json({ error: "Not Found" });

    return res.status(200).json(normalizeId(result.value));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * DELETE /api/items/:id (protected)
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const db = getDb();
    const col = db.collection(process.env.COLLECTION_NAME || "items");

    const result = await col.findOneAndDelete({ _id: new ObjectId(id) });
    if (!result.value) return res.status(404).json({ error: "Not Found" });

    return res.status(200).json({ deleted: true, item: normalizeId(result.value) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
