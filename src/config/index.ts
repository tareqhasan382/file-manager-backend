import dotenv from "dotenv";
import Path from "path";
dotenv.config({ path: Path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  bycrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  frontend_url:process.env.FRONTEND_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    refresh_secret: process.env.JWT_REFRESH_SECRET,
    expires_in: process.env.JWT_EXPIRES_IN,
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  stripe: {
    key: {
      secretKey: process.env.STRIPE_SECRET_KEY as string,
      publishableKey: process.env.PUBLISHABLE_SECRET_KEY as string,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET as string,
    },

    plans: {
      free: process.env.FREE as string,
      silver: process.env.SILVER as string,
      gold: process.env.GOLD as string,
      diamond: process.env.DIAMOND as string,
    },
  },

};