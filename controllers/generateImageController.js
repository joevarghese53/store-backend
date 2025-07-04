const generateImage = async (req, res) => {
  const payload = req.body;

  try {
    // Step 1: Submit job to RunPod
    const submitRes = await fetch(process.env.RUNPOD_API_URL+"/run", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({ input: payload }),
    });

    // ✅ Directly parse JSON here (no need to use .text() first)
    const submitData = await submitRes.json();
    console.log("[RunPod Submit Data]:", submitData);

    if (!submitData.id) {
      return res.status(500).json({ success: false, message: 'Failed to submit job to RunPod.' });
    }

    const jobId = submitData.id;

    // Step 2: Poll until the job is completed
    const pollUntilDone = async () => {
      while (true) {
        const statusRes = await fetch(`${process.env.RUNPOD_API_URL}/status/${jobId}`, {
          headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
        });

        const statusData = await statusRes.json();

        if (statusData.status === 'COMPLETED') {
          return statusData.output;
        } else if (statusData.status === 'FAILED') {
          throw new Error('RunPod job failed.');
        }

        await new Promise((resolve) => setTimeout(resolve, 3000)); // wait 3 seconds
      }
    };

    const output = await pollUntilDone();

    res.status(200).json({
      success: true,
      finalImage: output.final_image,
      overlayImage: output.overlay_image,
    });
  } catch (err) {
    console.error('[RunPod Error]', err.message);
    res.status(500).json({
      success: false,
      message: 'RunPod processing failed.',
      error: err.message,
    });
  }
};

export { generateImage };