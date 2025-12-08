import { qdrant } from "./qdrant.js"; // your Qdrant client

export async function checkQdrantConnection() {
  try {
    // Try listing all collections
    const collections = await qdrant.getCollections();
    console.log("Qdrant connected! Collections:", collections);

    // Optional: check if a specific collection exists
    const collectionName = collections;
    const exists = await qdrant.getCollection(collectionName).catch(() => null);

    if (exists) {
      console.log(`Collection "${collectionName}" exists`);
    } else {
      console.log(`Collection "${collectionName}" does not exist`);
    }

  } catch (err) {
    console.error("Failed to connect to Qdrant:", err);
  }
}

// Call the check function
checkQdrantConnection();
