// generateImageController.js
import { addToQueue, getQueuePosition, startQueueProcessor } from "../utils/jobQueue.js";
import { v4 as uuidv4 } from "uuid";
import asyncHandler from "../middlewares/asyncHandler.js";

const jobStatusMap = new Map(); // In-memory storage

// POST /api/generate-image
const generateImage = asyncHandler(async (req, res) => {
  const payload = req.body;

  // Basic validation - you can tighten based on your RunPod input schema
  if (!payload || !payload.prompt) {
    return res.status(400).json({ success: false, message: "prompt is required" });
  }

  const jobId = uuidv4();

  jobStatusMap.set(jobId, { status: "IN_QUEUE" });

  addToQueue({ id: jobId, payload });

  const position = getQueuePosition(jobId);

  res.status(202).json({
    success: true,
    jobId,
    position,
    message: "Job queued. Poll this job ID to get the result.",
  });

  // Start processing queue (no await needed)
  startQueueProcessor(async (job) => {
    const { id, payload } = job;

    try {
      jobStatusMap.set(id, { status: "PROCESSING" });

      const submitRes = await fetch(process.env.RUNPOD_API_URL + "/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({ input: payload }),
      });

      if (!submitRes.ok) {
        throw new Error(`RunPod submit failed: ${submitRes.status}`);
      }

      const submitData = await submitRes.json();
      const runpodJobId = submitData.id;

      // Poll for up to e.g. 10 minutes
      const pollUntilDone = async () => {
        const maxMs = 10 * 60 * 1000;
        const intervalMs = 3000;
        const start = Date.now();

        while (true) {
          const statusRes = await fetch(
            `${process.env.RUNPOD_API_URL}/status/${runpodJobId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
              },
            }
          );

          if (!statusRes.ok) {
            throw new Error(`RunPod status failed: ${statusRes.status}`);
          }

          const statusData = await statusRes.json();

          if (statusData.status === "COMPLETED") return statusData.output;
          if (statusData.status === "FAILED") throw new Error("RunPod job failed.");

          if (Date.now() - start > maxMs) {
            throw new Error("RunPod job timed out.");
          }

          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      };

      const output = await pollUntilDone();

      jobStatusMap.set(id, {
        status: "COMPLETED",
        output,
      });
    } catch (err) {
      console.error("Job Failed:", err.message);
      jobStatusMap.set(id, {
        status: "FAILED",
        error: err.message,
      });
    }
  });
});

// GET /api/generate-image/status/:id
const getJobStatus = (req, res) => {
  const jobId = req.params.id;

  if (!jobStatusMap.has(jobId)) {
    return res.status(404).json({ success: false, message: "Job not found." });
  }

  const jobInfo = jobStatusMap.get(jobId);

  if (jobInfo.status === "COMPLETED") {
    return res.status(200).json({
      success: true,
      status: "COMPLETED",
      finalImage: jobInfo.output?.final_image,
      overlayImage: jobInfo.output?.overlay_image,
      // you could also send full output if you want:
      // output: jobInfo.output,
    });
  }

  if (jobInfo.status === "FAILED") {
    return res.status(200).json({
      success: false,
      status: "FAILED",
      error: jobInfo.error,
    });
  }

  // IN_QUEUE or PROCESSING
  return res.status(200).json({
    success: true,
    status: jobInfo.status,
  });
};

// GET /api/generate-image/queue-position/:id
const getQueuePositionOfJob = (req, res) => {
  const jobId = req.params.id;

  if (!jobStatusMap.has(jobId)) {
    return res.status(404).json({ success: false, message: "Job not found." });
  }

  const position = getQueuePosition(jobId);

  if (position === null) {
    // Not in queue anymore - probably processing or completed
    return res.status(200).json({
      success: true,
      message: "Job is no longer in queue (processing or completed).",
      position: null,
    });
  }

  res.status(200).json({
    success: true,
    position,
  });
};

export { generateImage, getJobStatus, getQueuePositionOfJob };
