import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import { jwtHelpers } from "../../../utils/JWT";
import config from "../../../config";

interface IRegisterPayload {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}

interface ILoginPayload {
  email: string;
  password: string;
}

export const register = async (payload: IRegisterPayload) => {
  const { email, password, companyName } = payload;

  // 1️ Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError("User already exists", httpStatus.CONFLICT);
  }

  // 2️ Create tenant automatically
  const tenant = await prisma.tenant.create({
    data: {
      name: companyName,
      plan: "FREE", // default free plan
    },
  });

  // 3️ Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 4️ Create user as OWNER
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: "OWNER",
      tenantId: tenant.id
    },
  });

  // 5️ Optional: Create root folder
  await prisma.folder.create({
    data: {
      name: "Documents",
      tenantId: tenant.id,
      path: "/documents",
    },
  });


  return {
    userId: user.id,
    tenantId: tenant.id,
    role: user.role,
    plan: tenant.plan,
  };
};

// login user
export const login = async (payload: ILoginPayload) => {
  const { email, password } = payload;

  // 1️ Find user
  const user: any = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  // 2️ Verify password
  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    throw new AppError("Invalid password", httpStatus.UNAUTHORIZED);
  }

  // 3️ Generate JWT tokens
  const accessToken = jwtHelpers.generateToken(
    { userId: user.id, email: user.email, role: user.role,tenantId:user.tenantId },
    config.jwt.secret as string,
    config.jwt.expires_in as string
  );

  const refreshToken = jwtHelpers.generateToken(
    { userId: user.id, email: user.email, role: user.role,tenantId:user.tenantId },
    config.jwt.refresh_secret as string,
    config.jwt.refresh_expires_in as string
  );

  return {
    accessToken,
    refreshToken,
    userId: user.id,
    role: user.role,
    isPaidPlan: user.isPaidPlan || false,
    subscribtionPlan: user.subscribtionPlan || "FREE",
  };
};

export const authServices = {
  register,
  login
};