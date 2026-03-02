import { Role } from "../generated/prisma/enums";


export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  role: Role;
}