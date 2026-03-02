import { NextFunction, Request, Response } from 'express'
import httpStatus from 'http-status'
import { AppError } from '../../utils/app_error'
import { prisma } from '../../lib/prisma'

export const planMiddleware =
    (...allowedPlans: string[]) =>
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                let tenantId = req.user?.tenantId;

                if (!tenantId) {
                    throw new AppError("Tenant not found", httpStatus.BAD_REQUEST);
                }
                const tenant = await prisma.tenant.findUnique({
                    where: { id: tenantId },
                });

                if (!tenant) {
                    throw new AppError("Tenant does not exist", httpStatus.NOT_FOUND);
                }
                if (!tenant.plan || !allowedPlans.includes(tenant.plan)) {
                    throw new AppError(
                        "Your current plan does not allow this action",
                        httpStatus.FORBIDDEN
                    );
                }


                next()
            } catch (error) {
                next(error)
            }
        }