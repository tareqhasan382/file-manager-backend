import { randomInt } from "crypto";
import bcrypt from "bcrypt";

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_MS = 60_000;

export const generateOtp = (): string =>
  randomInt(100000, 1000000).toString();

export const hashOtp = (code: string): Promise<string> => bcrypt.hash(code, 10);

export const verifyOtpHash = (code: string, hash: string): Promise<boolean> =>
  bcrypt.compare(code, hash);
