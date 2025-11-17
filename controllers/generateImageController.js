//generateImageController.js
import { addToQueue, getQueuePosition, startQueueProcessor } from "../utils/jobQueue.js";
import { v4 as uuidv4 } from "uuid";

const jobStatusMap = new Map(); // In-memory storage (for now)

const generateImage = async (req, res) => {
  const jobId = uuidv4();
  const payload = req.body;

  jobStatusMap.set(jobId, { status: "IN_QUEUE" });

  addToQueue({ id: jobId, payload });

  const position = getQueuePosition(jobId);

  res.status(202).json({
    success: true,
    jobId,
    position,
    message: "Job queued. Poll this job ID to get the result.",
  });

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

      const submitData = await submitRes.json();
      const runpodJobId = submitData.id;

      const pollUntilDone = async () => {
        while (true) {
          const statusRes = await fetch(`${process.env.RUNPOD_API_URL}/status/${runpodJobId}`, {
            headers: {
              Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
            },
          });

          const statusData = await statusRes.json();

          if (statusData.status === "COMPLETED") return statusData.output;
          if (statusData.status === "FAILED") throw new Error("RunPod job failed.");

          await new Promise((resolve) => setTimeout(resolve, 3000));
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
};

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
      finalImage: jobInfo.output.final_image,
      overlayImage: jobInfo.output.overlay_image,
    });
  }

  if (jobInfo.status === "FAILED") {
    return res.status(200).json({
      success: false,
      status: "FAILED",
      error: jobInfo.error,
    });
  }

  res.status(200).json({
    success: true,
    status: jobInfo.status,
  });
};

const getQueuePositionOfJob = (req, res) => {
  const jobId = req.params.id;

  if (!jobStatusMap.has(jobId)) {
    return res.status(404).json({ success: false, message: "Job not found." });
  }

  const position = getQueuePosition(jobId);

  if (position === null) {
    return res.status(404).json({ success: false, message: "Job not found in queue." });
  }

  res.status(200).json({
    success: true,
    position,
  });
} 


export { generateImage, getJobStatus, getQueuePositionOfJob };