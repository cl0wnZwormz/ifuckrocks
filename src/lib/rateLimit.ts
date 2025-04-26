import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime <= now) {
      delete store[key];
    }
  });
}, 60000);

const rateLimitMessages = [
  "You've hit rock bottom with your upload rate!",
  "Your upload frequency is off the Richter scale!",
  "You're mining too many files at once!",
  "You've reached your geological limit!",
  "Time to let the server sediments settle.",
  "You're causing too many seismic uploads!",
  "Your uploads are causing an avalanche!",
  "You've reached your boulder limit!",
  "Your uploads are as frequent as volcanic eruptions!",
  "You've reached your sedimentary limit!"
];

export function rateLimit(options: {
  interval: number; // Time window in milliseconds
  limit: number;    // Max requests per interval
}) {
  return function rateLimitMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next?: () => void
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}`;

    // Initialize or reset the rate limit for this IP
    if (!store[key] || store[key].resetTime <= now) {
      store[key] = {
        count: 0,
        resetTime: now + options.interval,
      };
    }

    // Increment the request count
    store[key].count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.limit - store[key].count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(store[key].resetTime / 1000));

    // Check if the rate limit has been exceeded
    if (store[key].count > options.limit) {
      // Get a random rock-themed error message
      const randomMessage = rateLimitMessages[Math.floor(Math.random() * rateLimitMessages.length)];
      
      res.status(429).json({
        message: randomMessage,
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000),
      });
      return;
    }

    // If there's a next function, call it
    if (next) {
      next();
    }
  };
} 