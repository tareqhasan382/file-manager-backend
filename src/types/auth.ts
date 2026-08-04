import { Role } from "../app/enums";

export interface AuthUser {
  id: string;
  userId: string;
  tenantId: string;
  email: string;
  role: Role;
  avatar?: string | null;
  phone?: string | null;
}
