import { json } from "@/server/http";

/**
 * POST /api/users/login — retired. The admin panel is Google-only (see src/server/googleAuth.ts);
 * there are no passwords to check. Kept as a 410 so an old tab gets a clear answer.
 */
export const POST = async () =>
  json({ message: "Нууц үгээр нэвтрэх боломжгүй. «Google-ээр нэвтрэх» товчийг ашиглана уу." }, { status: 410 });
