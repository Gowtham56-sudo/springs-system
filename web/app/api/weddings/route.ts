import { NextRequest, NextResponse } from "next/server";
import { connectMongo, createWedding } from "backend";

export async function POST(request: NextRequest) {
  try {
    await connectMongo();
    const body = await request.json();

    const { brideName, groomName, eventDate, venue } = body;

    if (!brideName || !groomName || !eventDate || !venue) {
      return NextResponse.json(
        { error: "Missing required fields: brideName, groomName, eventDate, venue" },
        { status: 400 }
      );
    }

    const wedding = await createWedding({
      brideName,
      groomName,
      eventDate,
      venue,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json(
      {
        weddingCode: wedding.weddingCode,
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        eventDate: wedding.eventDate,
        venue: wedding.venue,
        qrUrl: `${appUrl}/wedding/${wedding.weddingCode}`,
        qrToken: wedding.qrToken,
        googleDriveFolderId: wedding.googleDriveFolderId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create wedding error:", error);
    return NextResponse.json(
      { error: "Failed to create wedding" },
      { status: 500 }
    );
  }
}
