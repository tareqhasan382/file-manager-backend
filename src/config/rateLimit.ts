const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default {
  api: {
    windowMs: num(process.env.RATE_LIMIT_API_WINDOW_MS, 15 * 60 * 1000),
    limit: num(process.env.RATE_LIMIT_API_MAX, 300),
  },
  auth: {
    windowMs: num(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10 * 60 * 1000),
    limit: num(process.env.RATE_LIMIT_AUTH_MAX, 40),
  },
  login: {
    windowMs: num(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 60 * 1000),
    limit: num(process.env.RATE_LIMIT_LOGIN_MAX, 5),
  },
};
