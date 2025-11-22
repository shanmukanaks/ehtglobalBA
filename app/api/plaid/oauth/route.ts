import { NextResponse } from "next/server";

// This endpoint handles OAuth redirects from Plaid
// After user authenticates with Chase Bank, Plaid redirects here
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const oauthStateId = searchParams.get("oauth_state_id");
  
  // In production, you would:
  // 1. Use oauth_state_id to retrieve the link_token
  // 2. Create a new link token for the OAuth continuation
  // 3. Redirect to frontend with the new link token
  
  // For now, redirect back to dashboard
  // The frontend will handle re-opening Plaid Link if needed
  return NextResponse.redirect(new URL("/dashboard?oauth_complete=true", request.url));
}
