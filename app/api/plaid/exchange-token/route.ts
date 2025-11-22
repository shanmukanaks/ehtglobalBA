import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Initialize Plaid client
const configuration = new Configuration({
  basePath:
    process.env.PLAID_ENV === "production"
      ? PlaidEnvironments.production
      : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
      "PLAID-SECRET": process.env.PLAID_SECRET || "",
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(request: Request) {
  try {
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      return NextResponse.json(
        { error: "Plaid credentials not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { public_token } = body;

    if (!public_token) {
      return NextResponse.json(
        { error: "public_token is required" },
        { status: 400 }
      );
    }

    // Exchange public_token for access_token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const access_token = response.data.access_token;
    const item_id = response.data.item_id;

    return NextResponse.json({
      access_token,
      item_id,
    });
  } catch (error: any) {
    console.error("Error exchanging token:", error);
    return NextResponse.json(
      {
        error: "Failed to exchange token",
        message: error?.response?.data?.error_message || error?.message,
      },
      { status: 500 }
    );
  }
}
