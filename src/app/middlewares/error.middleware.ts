import { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/app_error";


export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  console.error("Unhandled Error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};