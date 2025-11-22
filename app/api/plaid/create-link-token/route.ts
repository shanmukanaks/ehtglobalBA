import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from "plaid";

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
    // Check if Plaid credentials are configured
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      return NextResponse.json(
        {
          error: "Plaid credentials not configured",
          message:
            "Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables. " +
            "Get your credentials from https://dashboard.plaid.com/developers/keys",
        },
        { status: 500 }
      );
    }

    // Get OAuth state ID if returning from OAuth
    let body: { oauth_state_id?: string | null } = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, that's okay
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
    
    // Create link token - use only Transactions product to avoid flow conflicts
    // Transactions includes balance access and supports all account types
    const requestConfig: any = {
      user: {
        client_user_id: `user-${Date.now()}`,
      },
      client_name: "Paena",
      // Use only Transactions - this product supports all account types including payroll
      // and includes balance information
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      // Note: redirect_uri only needed for OAuth banks. Removed to avoid flow conflicts.
      // Note: institution_id is optional - if not provided, users can search for banks
    };

    // If we have an OAuth state ID, add it for continuation
    if (body.oauth_state_id) {
      requestConfig.oauth_state_id = body.oauth_state_id;
    }

    const response = await plaidClient.linkTokenCreate(requestConfig);
    const linkToken = response.data.link_token;

    return NextResponse.json({ link_token: linkToken });
  } catch (error: any) {
    console.error("Error creating Plaid link token:", error);
    return NextResponse.json(
      {
        error: "Failed to create link token",
        message: error?.message || "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
