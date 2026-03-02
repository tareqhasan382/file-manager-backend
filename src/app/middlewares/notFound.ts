import { NextFunction, Request, Response } from "express";

const notFound = (req: Request, res: Response, next: NextFunction) => {
    // Vercel cron routes bypass করবে
  if (req.path.startsWith("/api/cron")) {
    return next();
  }
  res.status(404).json({
    success: false,
    message: "API Not Found !!",
    error: [
      {
        path: req.originalUrl,
        message: "API NOT FOUND!",
      },
    ],
  });
};

export default notFound;