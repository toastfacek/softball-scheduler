import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  adultUsers,
  authAccounts,
  authSessions,
  verificationTokens,
} from "@/db/schema";
import { env } from "@/lib/env";
import { buildEmailFromAddress, normalizeEmail } from "@/lib/utils";

const resendFromAddress = buildEmailFromAddress(
  env.AUTH_RESEND_FROM,
  env.AUTH_RESEND_FROM_NAME,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: adultUsers,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: verificationTokens,
  }),
  secret: env.AUTH_SECRET,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
  },
  providers: [
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: resendFromAddress,
      normalizeIdentifier(identifier) {
        return normalizeEmail(identifier);
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      const candidateEmail = normalizeEmail(user.email ?? "");

      if (!candidateEmail) {
        return false;
      }

      if (account?.provider === "resend" || account?.provider === "email") {
        const existingInvite = await db.query.adultUsers.findFirst({
          where: eq(adultUsers.email, candidateEmail),
        });

        return Boolean(existingInvite);
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
});
