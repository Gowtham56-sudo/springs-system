import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { connectMongo, getWeddingByCode } from "backend";

interface RouteParams {
  params: Promise<{ weddingCode: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { weddingCode } = await params;
    const wedding = await getWeddingByCode(weddingCode);

    if (!wedding) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const qrUrl = `${appUrl}/wedding/${weddingCode}`;

    const pngBuffer = await QRCode.toBuffer(qrUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#2c2c2c", light: "#faf8f5" },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="qr-${weddingCode}.png"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { weddingCode } = await params;
    const wedding = await getWeddingByCode(weddingCode);

    if (!wedding) {
      return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      qrUrl: `${appUrl}/wedding/${weddingCode}`,
      message: "Scan to Find Your Wedding Photos",
      brideName: wedding.brideName,
      groomName: wedding.groomName,
    });
  } catch (error) {
    console.error("QR info error:", error);
    return NextResponse.json(
      { error: "Failed to get QR info" },
      { status: 500 }
    );
  }
}
