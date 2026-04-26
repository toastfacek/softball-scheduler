"use server";

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireViewer } from "@/actions/helpers";
import { db } from "@/db";
import { adultUsers } from "@/db/schema";

function generateToken() {
  return randomBytes(24).toString("base64url");
}

async function setToken(userId: string, token: string) {
  await db
    .update(adultUsers)
    .set({ calendarSyncToken: token, updatedAt: new Date() })
    .where(eq(adultUsers.id, userId));
}

export async function ensureCalendarSyncTokenAction() {
  const viewer = await requireViewer();

  const adult = await db.query.adultUsers.findFirst({
    where: eq(adultUsers.id, viewer.userId),
    columns: { calendarSyncToken: true },
  });

  if (!adult?.calendarSyncToken) {
    await setToken(viewer.userId, generateToken());
    revalidatePath("/settings/calendar");
  }
}

export async function rotateCalendarSyncTokenAction() {
  const viewer = await requireViewer();
  await setToken(viewer.userId, generateToken());
  revalidatePath("/settings/calendar");
}
