import dotenv from 'dotenv';
dotenv.config();

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://www.flowstateproject.in']
    : ['http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    console.log("🌐 Incoming Origin:", origin);

    // 1) Allow non-browser / redirects / curl (no Origin header)
    if (!origin) {
      return callback(null, true);
    }

    // 2) Allow your normal frontends
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 3) Allow PhonePe payment pages to call your /status endpoint
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith("phonepe.com")) {
        return callback(null, true);
      }
    } catch (e) {
      // ignore bad origin format
    }

    // 4) Otherwise: DO NOT error, just don't set CORS headers
    console.warn(`🚫 CORS: origin not allowed -> ${origin}`);
    return callback(null, false);   // <--- key change
  },

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept'
  ],
  optionsSuccessStatus: 200
};

export default corsOptions;
