"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireTeamManager, requireViewer } from "@/actions/helpers";
import { db } from "@/db";
import { adultUsers } from "@/db/schema";
import { listTeamRecipients } from "@/lib/data";
import { sendTeamEmail } from "@/lib/notifications";

const profileSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  reminderOptIn: z.boolean().default(true),
});

const broadcastSchema = z.object({
  scope: z.enum(["ALL", "GUARDIANS", "STAFF"]),
  subject: z.string().trim().min(3),
  body: z.string().trim().min(3),
});

export async function updateProfileAction(formData: FormData) {
  const viewer = await requireViewer();
  const parsed = profileSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    reminderOptIn: formData.get("reminderOptIn") === "on",
  });

  await db
    .update(adultUsers)
    .set({
      name: parsed.name,
      phone: parsed.phone || null,
      reminderOptIn: parsed.reminderOptIn,
      updatedAt: new Date(),
    })
    .where(eq(adultUsers.id, viewer.userId));

  revalidatePath("/settings");
  redirect("/settings?saved=profile");
}

export async function sendBroadcastAction(formData: FormData) {
  const viewer = await requireTeamManager();
  const parsed = broadcastSchema.parse({
    scope: formData.get("scope"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  const recipients = await listTeamRecipients(viewer.teamId, parsed.scope);

  await sendTeamEmail({
    teamId: viewer.teamId,
    createdByUserId: viewer.userId,
    kind: "BROADCAST",
    subject: parsed.subject,
    body: parsed.body,
    recipients,
    metadata: {
      audience: parsed.scope,
    },
  });

  revalidatePath("/settings");
  redirect("/settings?saved=broadcast");
}
