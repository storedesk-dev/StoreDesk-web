import { NextResponse } from "next/server";
import { issueClientSession, jsonError, loginAppUser } from "@/lib/control-plane";
import { ControlPlaneError } from "@/lib/control-plane-security";

/**
 * Convenience endpoint: AppUser login and client-session issuance in one call,
 * for clients that always use their first (or a named) assignment.
 *
 * It is a thin wrapper over the canonical `/api/v1/app-auth/login` +
 * `/api/v1/app-auth/sessions` pair — deliberately not a second implementation.
 * The previous version duplicated password verification (with its own
 * bcrypt/argon2 fork) and minted tokens with a different signing key, so the
 * two paths could disagree about who was allowed in.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      assignmentId?: string;
      deviceId?: string;
      deviceName?: string;
      audience?: "desktop" | "mobile";
    };

    if (!body.email || !body.password) {
      throw new ControlPlaneError(400, "REQUEST_INVALID", "email and password are required");
    }

    const audience = body.audience === "mobile" ? "mobile" : "desktop";

    const login = await loginAppUser({
      email: body.email,
      password: body.password,
      audience,
      deviceId: body.deviceId,
      deviceName: body.deviceName
    });

    if (login.assignments.length === 0) {
      throw new ControlPlaneError(
        403,
        "AUTHORIZATION_DENIED",
        "No Worker assignments for this AppUser"
      );
    }

    const assignment =
      login.assignments.find((a) => a.assignmentId === body.assignmentId) ?? login.assignments[0];

    const session = await issueClientSession({
      appUserId: String(login.appUserId),
      deviceId: String(login.deviceId),
      assignmentId: String(assignment.assignmentId),
      audience
    });

    return NextResponse.json({
      token: session.sessionToken,
      expiresAt: session.expiresAt,
      appUserId: login.appUserId,
      deviceId: login.deviceId,
      assignmentId: session.assignmentId,
      assignments: login.assignments,
      organization: {
        organizationId: session.organizationId,
        name: assignment.organizationName || "Store Owner"
      },
      role: session.role,
      roleAccess: session.roleAccess,
      tunnelUrl: session.tunnelUrl,
      lanUrl: session.lanUrl
    });
  } catch (error) {
    return jsonError(error);
  }
}
