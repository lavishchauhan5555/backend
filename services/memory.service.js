import { qdrant } from "../Modals/qdrant.js";
import { redis } from "../utils/redis.js";
import { hashText } from "../utils/hash.js";
import { getEmbedding } from "./ai.service.js";

const VECTOR_SIZE = 768;

/* ================= COLLECTION SAFETY ================= */

async function ensureCollection(name) {
  const list = await qdrant.getCollections();
  const exists = list.collections.some(c => c.name === name);

  if (!exists) {
    await qdrant.createCollection(name, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
  }
}

/**
 * Fetch memory context for AI prompt
 */
export async function getMemory(userId, text) {
  if (!text || text.length < 12) return "";

  const hash = hashText(text);
  const cacheKey = `memory:${userId}:${hash}`;

  /* ================= REDIS CACHE ================= */
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const collectionName = `twin_${userId}`;

  /* ================= ENSURE COLLECTION ================= */
  await ensureCollection(collectionName);

  /* ================= EMBEDDING ================= */
  const embedding = await getEmbedding(text);

  /* ================= QDRANT SEARCH ================= */
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

  /* ================= MEMORY BUILD ================= */
  const memory = hits
    .map(h => h.payload?.text)
    .filter(Boolean)
    .join("\n---\n");

  /* ================= CACHE MEMORY ================= */
  await redis.setex(cacheKey, 300, memory);

  return memory;
}
