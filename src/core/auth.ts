export type UserRole = "admin" | "user";
export interface UserContext { userId: string; role: UserRole; orgId?: string; }
export function checkPermission(user: UserContext | undefined, resource: string): boolean {
  if (!user) return false;
  if (resource.startsWith("admin:") && user.role !== "admin") return false;
  return true;
}
