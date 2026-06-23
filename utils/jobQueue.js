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

  try {
    while (queue.length > 0) {
      const job = queue[0];

      try {
        await processFn(job);
      } catch (err) {
        console.error("Processing error:", err.message);
      }

      queue.shift();
    }
  } finally {
    isProcessing = false;

    // Handle jobs added while processor was shutting down
    if (queue.length > 0) {
      void startQueueProcessor(processFn);
    }
  }
};