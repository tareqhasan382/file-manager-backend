-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INCOMPLETE', 'CANCELED', 'PAST_DUE', 'TRIAL');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "subscriptionStatus" "SubscriptionStatus";
