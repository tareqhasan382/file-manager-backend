# FileVault — Multi-tenant SaaS File Management System

A production-ready SaaS platform for secure, team-based file storage with role-based access control, Stripe billing, and Cloudinary-powered file delivery.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [Billing Plans](#billing-plans)
- [Frontend Pages](#frontend-pages)
- [Seeding SuperAdmin](#seeding-superadmin)
- [Deployment](#deployment)

---

## Overview

FileVault is a multi-tenant file management SaaS where each organization (tenant) gets isolated storage, user management, and plan-based limits enforced at the API level. Built with Node.js, Prisma, PostgreSQL on the backend and React + Redux on the frontend.

---

## Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js + Express | REST API server |
| TypeScript | Type safety |
| Prisma ORM | Database access layer |
| PostgreSQL | Primary database |
| Stripe | Subscription billing |
| Cloudinary | File storage & CDN |
| Nodemailer | Transactional emails |
| JWT | Authentication |
| Bcrypt | Password hashing |
| Zod | Request validation |

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 + TypeScript | UI framework |
| Redux Toolkit + RTK Query | State management & API calls |
| React Router v6 | Client-side routing |
| Tailwind CSS | Utility-first styling |
| React Hook Form + Zod | Form validation |
| React Hot Toast | Notifications |

---

## Features

- **Multi-tenancy** — Complete data isolation per organization
- **Role-based access** — SUPER_ADMIN, OWNER, ADMIN, MEMBER roles
- **File management** — Upload, browse, delete with grid/list views
- **Folder hierarchy** — Nested folders with breadcrumb navigation
- **Cloudinary upload** — Direct browser-to-Cloudinary with progress tracking
- **Stripe billing** — Checkout sessions, webhooks, subscription lifecycle
- **Plan enforcement** — File/folder/storage limits enforced at API level
- **Email notifications** — Billing events trigger automated HTML emails
- **Member management** — OWNER can invite/remove ADMIN and MEMBER users
- **SuperAdmin dashboard** — Ban tenants, change plans, view platform stats
- **Tenant ban system** — Banned tenants lose all API access immediately



## Getting Started

### Prerequisites

```bash
Node.js >= 18
PostgreSQL >= 14
Stripe account
Cloudinary account
```

### Backend Setup

```bash
# Clone and install
git clone https://github.com/tareqhasan382/file-manager-backend
cd file-manager-backend
npm install

# Setup environment
cp .env.example .env
# Fill in all variables (see below)

# Run migrations
npx prisma migrate dev

# Seed SuperAdmin
npx prisma db seed

# Start development server
npm run dev
```

### Frontend Setup

```bash
git clone https://github.com/tareqhasan382/file-manager-frontend
cd file-manager-frontend
npm install

# Setup environment
cp .env.example .env
# Fill in all variables (see below)

# Start development server
npm run dev
```

---

## Environment Variables

### Backend `.env`

```env
PORT=8000

# Postgres
DATABASE_URL="postgresql://postgres."
#SUPER_ADMIN_USER
SUPER_ADMIN_NAME=""
SUPER_ADMIN_EMAIL=""
SUPER_ADMIN_PASSWORD=""
SUPER_ADMIN_ROLE="SUPER_ADMIN"
SUPER_ADMIN_PLAN="DIAMOND"
# Other
SHORT_URL_BASE=http://localhost:8000
JWT_SECRET=""
JWT_REFRESH_SECRET=""
JWT_EXPIRES_IN=000
JWT_REFRESH_EXPIRES_IN=0000000
# STRIPE
STRIPE_SECRET_KEY=sk_test_
PUBLISHABLE_SECRET_KEY=pk_test_
STRIPE_WEBHOOK_SECRET=whsec_
# Products
FREE=price_
SILVER=price_
GOLD=price_
DIAMOND=price_
# Cloudinary
CLOUD_NAME=""
CLOUD_KEY=""
CLOUD_SECRET=""
FRONTEND_URL="http://localhost:5173"
#SMTP SERVER
EMAIL_USER=test@gmail.com
EMAIL_PASS=xyz
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=youruser
SMTP_PASS=yourpass
SMTP_FROM=no-reply@yourapp.com
```

### Frontend `.env`

```env
VITE_APP_BASE_URL=http://localhost:8000
VITE_APP_Cloud_name=your_cloudinary_cloud_name
VITE_APP_preset_name=SassFileApp
```

> **Note:** The Cloudinary upload preset (`SassFileApp`) must be set to **Unsigned** in your Cloudinary dashboard under Settings → Upload → Upload Presets.

---

## Database Schema

```
Tenant         — Organization with plan, billing, ban status
User           — Belongs to tenant, has role
Folder         — Nested via self-relation (FolderTree)
File           — Stored in Cloudinary, referenced in DB
```

### Enums

| Enum | Values |
|------|--------|
| `Role` | `SUPER_ADMIN`, `OWNER`, `ADMIN`, `MEMBER` |
| `Plan` | `FREE`, `SILVER`, `GOLD`, `DIAMOND` |
| `SubscriptionStatus` | `ACTIVE`, `INCOMPLETE`, `CANCELED`, `PAST_DUE`, `TRIAL` |

---

## API Reference

### Auth
```
POST   /api/v1/auth/register        Create account (auto FREE plan)
POST   /api/v1/auth/login           Login, returns JWT
```

### Folders
```
GET    /api/v1/folder               List all tenant folders
POST   /api/v1/folder               Create folder
DELETE /api/v1/folder/:id           Delete folder (must be empty)
```

### Files
```
GET    /api/v1/files                List files (optional ?folderId=)
POST   /api/v1/files                Save file record after Cloudinary upload
DELETE /api/v1/files/:id            Delete file record + Cloudinary asset
```

### Members (OWNER only)
```
GET    /api/v1/tenant/members       List ADMIN + MEMBER users
POST   /api/v1/tenant/members       Create member with role
DELETE /api/v1/tenant/members/:id   Remove member
```

### Billing
```
POST   /api/v1/billing/subscribe    Subscribe to plan, returns Stripe checkout URL
POST   /api/v1/billing/webhook      Stripe webhook handler
```

### SuperAdmin
```
GET    /api/v1/admin/stats          Platform stats
GET    /api/v1/admin/tenants        All tenants
GET    /api/v1/admin/tenants/:id    Single tenant
PUT    /api/v1/admin/tenants/:id/ban    Toggle ban
PUT    /api/v1/admin/tenants/:id/plan   Change plan
GET    /api/v1/admin/users          All users
```


## Billing Plans

| Plan | Files | Folders | Storage | Folder Depth | Price |
|------|------:|--------:|--------:|:------------:|------:|
| FREE | 2 | 2 | 10 MB | 2 | $0/mo |
| SILVER | 4 | 4 | 100 MB | 4 | $5/mo |
| GOLD | 20 | 20 | 500 MB | 6 | $15/mo |
| DIAMOND | ∞ | ∞ | ∞ | ∞ | $49/mo |

Plan limits are enforced by `planValidation.middleware.ts` on every create request. FREE plan is automatically assigned on registration — no Stripe required.

---

## Frontend Pages

| Route | Component | Access |
|-------|-----------|--------|
| `/` | `App.tsx` | Public |
| `/login` | `Login.tsx` | Public |
| `/signup` | `Signup.tsx` | Public |
| `/files` | `FileManager.tsx` | OWNER, ADMIN, MEMBER |
| `/members` | `MemberManager.tsx` | OWNER only |
| `/dashboard` | `SuperAdminDashboard.tsx` | SUPER_ADMIN only |

---

## Seeding SuperAdmin

After running migrations, seed the SuperAdmin account:

```bash
npx prisma db seed
```

This creates:

```
Email:
Password:
```

> **Important:** Change the SuperAdmin password immediately after first login in production.

---

## Deployment

### Backend (e.g. Railway / Render)

```bash
npm run build
npm start
```

Set all production environment variables. Register your Stripe webhook endpoint:

```
https://your-api.com/api/v1/billing/webhook
```

Webhook events to enable:
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`

### Frontend (e.g. Vercel)

```bash
npm run build
```

Set `VITE_APP_BASE_URL` to your production API URL.

---

## 👨‍💻 Author

**Tareq Hasan**

---