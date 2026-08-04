import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import { jwtHelpers } from "../../../utils/JWT";
import config from "../../../config";
import { Tenant } from "../../../models/Tenant";
import { User } from "../../../models/User";
import { Folder } from "../../../models/Folder";
import { Plan, Role } from "../../enums";
import { withTransaction } from "../../../utils/transaction";
import { welcomeEmail, otpEmail } from "../../../lib/emailtemplates";
import { sendEmail } from "../../../lib/email";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_MS,
} from "../../../utils/otp";

interface IRegisterPayload {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  plan?: string;
}

interface ILoginPayload {
  email: string;
  password: string;
}

interface ICodePayload {
  email: string;
  code: string;
}

const issueTokens = async (user: {
  _id: any;
  email: string;
  role: string;
  tenantId: any;
}) => {
  const tenant = await Tenant.findById(user.tenantId).lean();

  const claims = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    tenantId: user.tenantId.toString(),
  };

  const accessToken = jwtHelpers.generateToken(
    claims,
    config.jwt.secret as string,
    config.jwt.expires_in as string
  );

  const refreshToken = jwtHelpers.generateToken(
    claims,
    config.jwt.refresh_secret as string,
    config.jwt.refresh_expires_in as string
  );

  return {
    accessToken,
    refreshToken,
    userId: user._id.toString(),
    role: user.role,
    isPaidPlan: (tenant?.plan ?? Plan.FREE) !== Plan.FREE,
    subscribtionPlan: tenant?.plan ?? Plan.FREE,
  };
};

// Generates a 6-digit code, stores its bcrypt hash on the user and emails it.
// In dev, when SMTP is unavailable the code is also logged to the console.
const sendVerificationOtp = async (email: string, fullName: string) => {
  const code = generateOtp();
  const hashed = await hashOtp(code);

  await User.updateOne(
    { email },
    {
      $set: {
        verificationCode: hashed,
        verificationCodeExpires: new Date(
          Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
        ),
        verificationCodeSentAt: new Date(),
      },
    }
  );

  const { subject, html } = otpEmail({
    name: fullName || "there",
    code,
    purpose: "verification",
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] Verification OTP for ${email}: ${code}`);
  }

  await sendEmail({ to: email, subject, html }).catch((err) => {
    console.error("OTP email failed:", err);
    console.log(`[DEV] Verification OTP for ${email}: ${code}`);
  });
};

export const register = async (payload: IRegisterPayload) => {
  const { email, password, fullName, companyName } = payload;
  const plan = payload.plan ?? Plan.FREE;

  // 1. Check if user already exists (fast, indexed)
  const existingUser = await User.findOne({ email }).select("_id").lean();
  if (existingUser) {
    throw new AppError("User already exists", httpStatus.CONFLICT);
  }

  // Hash password BEFORE opening the transaction (bcrypt is CPU-bound and
  // would otherwise hold the transaction open for no reason).
  const hashedPassword = await bcrypt.hash(password, 10);

  // 2. Create tenant + OWNER user + root folder atomically.
  const result = await withTransaction(async (session) => {
    const [tenant] = await Tenant.create(
      [
        {
          name: companyName,
          plan,
          // Paid plans start INCOMPLETE until Stripe confirms payment
          // via the checkout.session.completed webhook.
          subscriptionStatus:
            plan === Plan.FREE
              ? ("ACTIVE" as const)
              : ("INCOMPLETE" as const),
        },
      ],
      { session }
    );

    const [user] = await User.create(
      [
        {
          email,
          password: hashedPassword,
          role: Role.OWNER,
          tenantId: tenant._id,
          fullName,
          // New accounts are inactive until the email OTP is verified.
          isVerified: false,
        },
      ],
      { session }
    );

    await Folder.create(
      [{ name: "Documents", tenantId: tenant._id, path: "/documents" }],
      { session }
    );

    return {
      userId: user._id.toString(),
      tenantId: tenant._id.toString(),
      role: user.role,
      plan: tenant.plan,
      email,
    };
  });

  // 3. Side-effect (OTP email) happens AFTER commit.
  await sendVerificationOtp(email, fullName);

  return { ...result, isVerified: false };
};

// login user
export const login = async (payload: ILoginPayload) => {
  const { email, password } = payload;

  // 1. Find user (password excluded by default -> opt back in)
  const user = await User.findOne({ email })
    .select("+password")
    .lean();

  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) {
    throw new AppError("Tenant does not exist", httpStatus.NOT_FOUND);
  }

  // Ban check
  if (tenant.isBanned) {
    throw new AppError(
      "Your organization has been banned. Please contact support.",
      httpStatus.FORBIDDEN
    );
  }

  // 2. Verify password
  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    throw new AppError("Invalid password", httpStatus.UNAUTHORIZED);
  }

  // 3. Email verification check
  if (user.isVerified === false) {
    throw new AppError(
      "Please verify your email address first. Check your inbox for the OTP.",
      httpStatus.FORBIDDEN
    );
  }

  // 4. Generate JWT tokens
  return issueTokens(user);
};

// verify email OTP
export const verifyOtp = async (payload: ICodePayload) => {
  const { email, code } = payload;

  const user = await User.findOne({ email })
    .select("+verificationCode +verificationCodeExpires")
    .lean();

  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  if (user.isVerified) {
    throw new AppError("Email already verified", httpStatus.BAD_REQUEST);
  }

  if (!user.verificationCode || !user.verificationCodeExpires) {
    throw new AppError(
      "No verification code found. Please request a new one.",
      httpStatus.BAD_REQUEST
    );
  }

  if (new Date(user.verificationCodeExpires).getTime() < Date.now()) {
    throw new AppError(
      "Verification code expired. Please request a new one.",
      httpStatus.BAD_REQUEST
    );
  }

  const isValid = await verifyOtpHash(code, user.verificationCode);
  if (!isValid) {
    throw new AppError("Invalid verification code", httpStatus.BAD_REQUEST);
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: { isVerified: true },
      $unset: {
        verificationCode: "",
        verificationCodeExpires: "",
        verificationCodeSentAt: "",
      },
    }
  );

  // Best-effort welcome email once the account is active.
  const { subject, html } = welcomeEmail({ name: user.fullName || "there" });
  await sendEmail({ to: email, subject, html }).catch((err) =>
    console.error("Welcome email failed:", err)
  );

  // Auto-login so the user can continue straight into the app.
  return issueTokens(user);
};

// resend email OTP (60s cooldown)
export const resendOtp = async ({ email }: { email: string }) => {
  const user = await User.findOne({ email })
    .select("+verificationCodeSentAt")
    .lean();

  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  if (user.isVerified) {
    throw new AppError("Email already verified", httpStatus.BAD_REQUEST);
  }

  const lastSent = user.verificationCodeSentAt
    ? new Date(user.verificationCodeSentAt).getTime()
    : 0;
  const remainingMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - lastSent);
  if (remainingMs > 0) {
    throw new AppError(
      `Please wait ${Math.ceil(remainingMs / 1000)} seconds before requesting a new code`,
      httpStatus.TOO_MANY_REQUESTS
    );
  }

  await sendVerificationOtp(email, user.fullName);

  return { message: "Verification code sent successfully" };
};

// forgot password — always returns success to avoid account enumeration
export const forgotPassword = async ({ email }: { email: string }) => {
  const user = await User.findOne({ email }).lean();

  if (user) {
    const code = generateOtp();
    const hashed = await hashOtp(code);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetCode: hashed,
          resetCodeExpires: new Date(
            Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
          ),
          resetCodeSentAt: new Date(),
        },
      }
    );

    const { subject, html } = otpEmail({
      name: user.fullName || "there",
      code,
      purpose: "password reset",
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset OTP for ${email}: ${code}`);
    }

    await sendEmail({ to: email, subject, html }).catch((err) => {
      console.error("Password reset email failed:", err);
      console.log(`[DEV] Password reset OTP for ${email}: ${code}`);
    });
  }

  return {
    message:
      "If an account exists for this email, a password reset code has been sent.",
  };
};

// reset password with OTP
export const resetPassword = async ({
  email,
  code,
  newPassword,
}: ICodePayload & { newPassword: string }) => {
  const user = await User.findOne({ email })
    .select("+resetCode +resetCodeExpires")
    .lean();

  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  if (!user.resetCode || !user.resetCodeExpires) {
    throw new AppError(
      "No reset request found. Please request a new code.",
      httpStatus.BAD_REQUEST
    );
  }

  if (new Date(user.resetCodeExpires).getTime() < Date.now()) {
    throw new AppError(
      "Reset code expired. Please request a new one.",
      httpStatus.BAD_REQUEST
    );
  }

  const isValid = await verifyOtpHash(code, user.resetCode);
  if (!isValid) {
    throw new AppError("Invalid reset code", httpStatus.BAD_REQUEST);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await User.updateOne(
    { _id: user._id },
    {
      $set: { password: hashedPassword, isVerified: true },
      $unset: {
        resetCode: "",
        resetCodeExpires: "",
        resetCodeSentAt: "",
      },
    }
  );

  return { message: "Password reset successfully" };
};

// Validate the current session: the user (and their tenant) must still exist
// in the database. Used by the frontend on every protected-page load so a
// stale/deleted account is logged out immediately.
export const getMe = async (userId: string) => {
  const user = await User.findOne({ _id: userId })
    .select("email role fullName tenantId isVerified")
    .lean();

  if (!user) {
    throw new AppError("User no longer exists", httpStatus.UNAUTHORIZED);
  }

  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) {
    throw new AppError("Tenant no longer exists", httpStatus.UNAUTHORIZED);
  }

  if (tenant.isBanned) {
    throw new AppError(
      "Your organization has been banned. Please contact support.",
      httpStatus.FORBIDDEN
    );
  }

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    isVerified: user.isVerified ?? false,
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      plan: tenant.plan,
      subscriptionStatus: tenant.subscriptionStatus,
      isBanned: tenant.isBanned,
    },
  };
};

export const authServices = {
  register,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getMe,
};
