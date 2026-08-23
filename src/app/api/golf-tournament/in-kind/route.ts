import { NextResponse } from "next/server";

import { processInKindSubmission } from "@/lib/golf-tournament/in-kind-submission";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await processInKindSubmission({
      formData: await request.formData(),
      requestHeaders: request.headers,
    });

    if (result.kind === "invalid") {
      return NextResponse.json(
        { error: "Please check the submission fields and try again." },
        { status: 400 },
      );
    }

    return redirectToGolfTournament(request, result.redirectState);
  } catch (error) {
    console.error("[golf-in-kind] submission processing failed", error);
    return redirectToGolfTournament(request, "temporarily-unavailable");
  }
}

function redirectToGolfTournament(
  request: Request,
  state: string,
) {
  const url = new URL("/golf-tournament", request.url);
  url.searchParams.set("inKind", state);
  return NextResponse.redirect(url, 303);
}
