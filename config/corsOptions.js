import dotenv from 'dotenv';
dotenv.config();

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://www.flowstateproject.in']
    : ['http://localhost:3000'];


const corsOptions = {
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps, Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,   // allow cookies, Authorization headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept'
    ],
    optionsSuccessStatus: 200          // for legacy browsers
};

export default corsOptions;
