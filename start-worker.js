// server/start-worker.js
import "./queues/file.worker.js"; // Import the worker to run it

console.log("File worker started... Listening to file-processing queue");
