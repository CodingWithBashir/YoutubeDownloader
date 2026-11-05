import type { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hmac, safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "cf_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface GuestSession {
  guestId: string;
  value: string;
  isNew: boolean;
}

export interface GuestPrincipal {
  id: string;
  guestId: string;
  session: GuestSession;
}

function signSession(guestId: string, expires: number) {
  return hmac(`${guestId}:${expires}`, "guest-session");
}

export function createSessionValue(guestId: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return `${guestId}.${expires}.${signSession(guestId, expires)}`;
}

export function verifySessionValue(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [guestId, expiryRaw, signature] = parts;
  const expires = Number(expiryRaw);
  if (!guestId || !Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000)) return null;
  if (!safeEqual(signSession(guestId, expires), signature)) return null;
  return { guestId, expires };
}

function readCookie(request: Request | NextRequest, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const segment of cookieHeader.split(";")) {
    const index = segment.indexOf("=");
    if (index < 0) continue;
    if (segment.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(segment.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getSessionFromRequest(request: Request | NextRequest): GuestSession {
  const value = readCookie(request, SESSION_COOKIE);
  const parsed = value ? verifySessionValue(value) : null;
  if (parsed) {
    return { guestId: parsed.guestId, value: value!, isNew: false };
  }
  const guestId = randomUUID();
  return { guestId, value: createSessionValue(guestId), isNew: true };
}

export async function ensureGuest(request: Request | NextRequest): Promise<GuestPrincipal> {
  const session = getSessionFromRequest(request);
  const user = await prisma.user.upsert({
    where: { guestId: session.guestId },
    create: { guestId: session.guestId },
    update: { lastSeenAt: new Date() },
  });
  return { id: user.id, guestId: user.guestId, session };
}

export function attachSessionCookie(response: NextResponse, session: GuestSession) {
  if (!session.isNew) return response;
  response.cookies.set({
    name: SESSION_COOKIE,
    value: session.value,
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
