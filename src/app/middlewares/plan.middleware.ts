// import { NextFunction, Response } from "express";
// import httpStatus from "http-status";
// import { AppError } from "../../utils/app_error";

// export const planMiddleware =
//   (...allowedPlans: string[]) =>
//   (req: Request, res: Response, next: NextFunction) => {
//     const plan = req.user.tenant?.plan;

//     if (!plan || !allowedPlans.includes(plan)) {
//       throw new AppError(
//         "Your current plan does not allow this action",
//         httpStatus.FORBIDDEN
//       );
//     }

//     next();
//   };