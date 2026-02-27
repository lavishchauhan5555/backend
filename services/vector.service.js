import { qdrant } from "../Modals/qdrant.js";
import crypto from "crypto";
import { getEmbedding } from "./ai.service.js";
import redis from "../utils/redis.js";

// Remove fixed VECTOR_SIZE, we will detect dynamically
const CHUNK_SIZE = 800;
const MAX_CHUNKS = 6;

// -------------------- Helpers --------------------
function chunkText(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks.slice(0, MAX_CHUNKS);
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function hashToUUID(hash) {
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

// -------------------- Ensure Collection --------------------
async function ensureCollection(name, vectorSize) {
  const list = await qdrant.getCollections();
  const exists = list.collections.some(c => c.name === name);

  if (!exists) {
    await qdrant.createCollection(name, {
      vectors: { size: vectorSize, distance: "Cosine" },
    });
    // console.log(`🆕 Created Qdrant collection: ${name} (dim: ${vectorSize})`);
  }
}

// -------------------- Vector Upsert --------------------
export async function upsertVector(userId, text) {
  if (!text?.trim()) return;

  const chunks = chunkText(text).map(normalizeText);
  const vectors = await Promise.all(chunks.map(chunk => getEmbedding(chunk)));

  const collectionName = `twin_${userId}`;
  const vectorSize = vectors[0].length;

  await ensureCollection(collectionName, vectorSize);

  // Redis deduplication
  const redisKey = `qdrant_hashes:${userId}`;
  let existingHashes = new Set(await redis.smembers(redisKey));

  const points = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const hash = crypto.createHash("sha256").update(userId + chunk).digest("hex");
    if (existingHashes.has(hash)) continue;

    const id = hashToUUID(hash);
    points.push({
      id,
      vector: vectors[i],
      payload: { text: chunk, userId, hash },
    });
    existingHashes.add(hash);
  }

  if (!points.length) {
    // console.log(`⚠️ No new vectors to upsert for ${collectionName}`);
    return;
  }

  await qdrant.upsert(collectionName, { points });
  // console.log(`✅ Upserted ${points.length} vectors in ${collectionName}`);

  if (points.length) {
    await redis.sadd(redisKey, ...points.map(p => p.payload.hash));
  }
}

// -------------------- Memory Retrieval --------------------
export async function getMemory(userId, text) {
  if (!text || text.length < 12) return "";

  const normalizedText = normalizeText(text);
  const hash = crypto.createHash("sha256").update(userId + normalizedText).digest("hex");
  const cacheKey = `memory:${userId}:${hash}`;

  // Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const collectionName = `twin_${userId}`;
  await ensureCollection(collectionName);

  const embedding = await getEmbedding(normalizedText);

  let hits = [];
  try {
    hits = await qdrant.search(collectionName, {
      vector: embedding,
      limit: 3,
      with_payload: true,
    });
  } catch (err) {
    console.error("QDRANT SEARCH ERROR:", err);
    return "";
  }

  if (!hits.length) return "";

  const memory = hits
    .map(h => h.payload?.text)
    .filter(Boolean)
    .join("\n---\n");

  // Cache in Redis for 5 minutes
  await redis.setex(cacheKey, 300, memory);

  return memory;
}
