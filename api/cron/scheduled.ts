import { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmail } from "../../src/lib/email";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron POST পাঠায়, manually test করতে GET ও allow করো
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("<------------------schedule send start---------------------------> method:", req.method);
  
  await sendEmail({
    to: "tareqhasan382@gmail.com",
    subject: "Upcoming subscription payment",
    text: `Hi Tareq, your subscription will renew on .`,
  });

  console.log("<-------------------schedule send------------------------------->");
  res.status(200).json({ success: true });
}