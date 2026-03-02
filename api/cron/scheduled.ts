import { VercelRequest, VercelResponse } from "@vercel/node";
// import {prisma} from "../../src/lib/prisma";
import { sendEmail } from "../../src/lib/email"
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Find subscriptions ending in 3 days
  //   const upcoming = await prisma.subscription.findMany({
  //     where: {
  //       status: "ACTIVE",
  //       nextBillingDate: {
  //         lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  //       },
  //     },
  //     include: { tenant: true },
  //   });

  //   for (const sub of upcoming) {
  //     await sendEmail({
  //       to: sub.tenant.email,
  //       subject: "Upcoming subscription payment",
  //       text: `Hi ${sub.tenant.name}, your subscription will renew on ${sub.nextBillingDate.toDateString()}.`,
  //     });
  //   }
  console.log("<------------------schedule send start--------------------------->")
  await sendEmail({
    to: "tareqhasan382@gmail.com",
    subject: "Upcoming subscription payment",
    text: `Hi Tareq, your subscription will renew on .`,
  });
 console.log("<-------------------schedule send------------------------------>")
  res.status(200).json({ success: true });
}