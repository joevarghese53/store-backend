//jobQueue.js
let queue = [];
let isProcessing = false;

export const addToQueue = (job) => {
  queue.push(job);
};

export const getQueuePosition = (jobId) => {
  const index = queue.findIndex((job) => job.id === jobId);
  return index >= 0 ? index : null;
};

export const startQueueProcessor = async (processFn) => {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue[0]; // don't shift yet
    try {
      await processFn(job);
    } catch (err) {
      console.error("Processing error:", err.message);
    }
    queue.shift(); // remove job only after it's fully processed
  }

  isProcessing = false;
};
