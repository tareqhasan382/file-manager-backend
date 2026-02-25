import { Response } from "express";

type IApiReponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  data?: T | null;
};

export const sendResponse = <T>(res: Response, data: IApiReponse<T>) => {
  const responseData: IApiReponse<T> = {
    statusCode: data.statusCode,
    success: data.success,
    meta: data.meta || null || undefined,
    message: data.message || null,
    data: data.data || null,
  };
  res.status(data.statusCode).json(responseData);
};