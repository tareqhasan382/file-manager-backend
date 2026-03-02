-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false;
