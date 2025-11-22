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
    const { access_token } = body;

    if (!access_token) {
      return NextResponse.json(
        { error: "access_token is required" },
        { status: 400 }
      );
    }

    // Try to fetch income data using Income product
    // Note: Income product requires specific setup, so we'll use mock data for now
    // In production, you'd need to request Income product when creating link token
    
    // For sandbox/demo, return mock income data
    const payPeriodEnd = new Date();
    const payPeriodStart = new Date();
    payPeriodStart.setDate(payPeriodStart.getDate() - 14); // 2 weeks ago for biweekly
    
    return NextResponse.json({
      mockData: true,
      income: {
        gross_annual: 75000,
        pay_frequency: "biweekly",
        pay_period_start: payPeriodStart.toISOString(),
        pay_period_end: payPeriodEnd.toISOString(),
      },
    });
  } catch (error: any) {
    // Return mock data if there's any error
    const payPeriodEnd = new Date();
    const payPeriodStart = new Date();
    payPeriodStart.setDate(payPeriodStart.getDate() - 14);
    
    return NextResponse.json({
      mockData: true,
      income: {
        gross_annual: 75000,
        pay_frequency: "biweekly",
        pay_period_start: payPeriodStart.toISOString(),
        pay_period_end: payPeriodEnd.toISOString(),
      },
    });
  }
}
