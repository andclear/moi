import { isAdminRequest } from "../../src/server/admin/adminAuth";

export default async function handler(request: Request) {
  return Response.json({ authenticated: isAdminRequest(request) });
}
