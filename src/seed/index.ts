import bcrypt from "bcrypt";
import config from "../config";
import { connectDB, mongoose } from "../lib/mongoose";
import { Tenant } from "../models/Tenant";
import { User } from "../models/User";
import { Plan, Role } from "../app/enums";
import { withTransaction } from "../utils/transaction";

async function main() {
  await connectDB();
  console.log("Seed starting...");

  const email = config.super_admin.email as string;
  const password = config.super_admin.password as string;

  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    console.log("SuperAdmin already exists:", email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { userId, tenantId } = await withTransaction(async (session) => {
    const [tenant] = await Tenant.create(
      [
        {
          name: config.super_admin.name as string,
          plan: (config.super_admin.plan as Plan) || Plan.DIAMOND,
          isBanned: false,
          subscriptionStatus: "ACTIVE" as const,
        },
      ],
      { session }
    );

    const [user] = await User.create(
      [
        {
          email,
          password: hashedPassword,
          role: config.super_admin.role as Role,
          tenantId: tenant._id,
          fullName: config.super_admin.name as string,
          isVerified: true,
        },
      ],
      { session }
    );

    return { userId: user._id.toString(), tenantId: tenant._id.toString() };
  });

  console.log("SuperAdmin created:", email);
  console.log("Tenant:", tenantId, "User:", userId);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
