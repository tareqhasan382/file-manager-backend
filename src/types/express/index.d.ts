import { AuthUser } from "../auth";
import { TenantDoc } from "../../models/Tenant";

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
      tenant?: TenantDoc;
    }
  }
}
