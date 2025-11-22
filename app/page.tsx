"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Loading while fetching link token
  const [isPlaidVerifying, setIsPlaidVerifying] = useState(false); // Loading while Plaid is verifying
  const router = useRouter();

  // Fetch link token from backend
  useEffect(() => {
    const fetchLinkToken = async () => {
      setIsLoading(true);
      try {
        // Check if we're returning from OAuth
        const urlParams = new URLSearchParams(window.location.search);
        const oauthStateId = urlParams.get("oauth_state_id");
        
        const response = await fetch("/api/plaid/create-link-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            oauth_state_id: oauthStateId || null,
          }),
        });
        const data = await response.json();
        
        if (response.ok && data.link_token) {
          setLinkToken(data.link_token);
        } else {
          console.error("Failed to create link token:", data);
          alert(`Plaid Error: ${data.error || data.message || "Failed to initialize Plaid. Please check your credentials and try again."}`);
        }
      } catch (error) {
        console.error("Error fetching link token:", error);
        alert(`Error connecting to Plaid: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLinkToken();
  }, []);

  const onSuccess = useCallback(
    async (public_token: string, metadata: any) => {
      setIsPlaidVerifying(false);
      
      // Store Plaid connection data - preserve full metadata structure
      if (metadata) {
        const plaidData = {
          institution: metadata.institution || { name: "Unknown Bank" },
          accounts: metadata.accounts || [],
          public_token: public_token,
          metadata: metadata, // Store full metadata for debugging
        };
        localStorage.setItem("plaid_connection", JSON.stringify(plaidData));
        console.log("Stored Plaid data:", plaidData);
      }
      
      // Store user email if provided
      if (email) {
        localStorage.setItem("user_email", email);
      }
      
      // Exchange public_token for access_token
      try {
        const exchangeResponse = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ public_token }),
        });

        const exchangeData = await exchangeResponse.json();
        if (exchangeResponse.ok && exchangeData.access_token) {
          // Store access_token for future API calls
          localStorage.setItem("plaid_access_token", exchangeData.access_token);
          console.log("Successfully exchanged token");
        }
      } catch (error) {
        console.error("Error exchanging token:", error);
        // Continue anyway - we can try again later
      }
      
      console.log("Plaid Link successful:", { public_token, metadata });
      router.push("/dashboard");
    },
    [router, email]
  );

  const onExit = useCallback((err: any, metadata: any) => {
    setIsPlaidVerifying(false);
    if (err) {
      console.error("Plaid Link error:", err);
    }
    // User closed Plaid Link - don't redirect
  }, []);

  const config = {
    token: linkToken,
    onSuccess,
    onExit,
    // Configure for OAuth with Chase Bank
    // OAuth redirect will be handled automatically by Plaid
  };

  const { open, ready } = usePlaidLink(config);

  // Auto-open Plaid Link if returning from OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStateId = urlParams.get("oauth_state_id");
    
    if (oauthStateId && ready && linkToken) {
      // Automatically open Plaid Link to continue OAuth flow
      setIsPlaidVerifying(true);
      open();
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [ready, linkToken, open]);

  // Hardcoded valid accounts
  const validAccounts = ["user", "lp", "admin"];

  const handleLogin = () => {
    // Clear previous error
    setLoginError(false);
    
    // Normalize email (trim and lowercase)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if email is one of the valid accounts
    if (!validAccounts.includes(normalizedEmail)) {
      setLoginError(true);
      return;
    }

    // Store user email and role in localStorage
    localStorage.setItem("user_email", normalizedEmail);
    localStorage.setItem("user_role", normalizedEmail);

    // Route based on user role
    if (normalizedEmail === "user") {
      // User goes to regular dashboard, optionally with Plaid
      if (ready && linkToken) {
        setIsPlaidVerifying(true);
        open();
      } else {
        router.push("/dashboard");
      }
    } else if (normalizedEmail === "lp") {
      // LP goes to LP dashboard
      router.push("/lp-dashboard");
    } else if (normalizedEmail === "admin") {
      // Admin goes to admin dashboard
      router.push("/admin-dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Centered white container with rounded corners (8px) */}
        <div className="bg-white shadow-lg p-8" style={{ borderRadius: '8px' }}>
          {/* Paena logo/title in Garamond font */}
          <h1 className="text-4xl font-bold text-venmo-blue text-center mb-6" style={{ fontFamily: 'EB Garamond, Garamond, serif' }}>
            Paena
          </h1>

          {/* Login title */}
          <h2 className="text-2xl font-normal text-gray-900 text-center mb-8">
            Log in
          </h2>

          {/* Error message - fixed height to prevent layout shift */}
          <div className="mb-3 min-h-[24px]">
            {loginError && (
              <p className="text-sm text-red-600 font-medium">
                Invalid email. Please use 'user', 'lp', or 'admin'
              </p>
            )}
          </div>

          {/* Email input */}
          <div className="mb-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLoginError(false); // Clear error when user types
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLogin();
                }
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                loginError
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-venmo-blue focus:border-transparent"
              }`}
            />
          </div>

          {/* Password input */}
          <div className="mb-4 relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLogin();
                }
              }}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-venmo-blue focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Log in button */}
          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoading || isPlaidVerifying}
            className="w-full bg-venmo-blue text-white font-semibold py-3 px-4 rounded-2xl mb-4 hover:bg-blue-600 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ borderRadius: '16px', minHeight: '52px' }}
          >
            {(isLoading || isPlaidVerifying) && (
              <svg 
                className="animate-spin h-5 w-5 text-white" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                ></circle>
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            <span>{isLoading ? "Loading..." : isPlaidVerifying ? "Verifying..." : "Log in"}</span>
          </button>

          {/* Sign up button */}
          <button
            type="button"
            className="w-full bg-transparent border-2 border-venmo-blue text-venmo-blue font-semibold py-3 px-4 rounded-2xl hover:bg-venmo-blue hover:text-white transition-colors"
            style={{ borderRadius: '16px', minHeight: '52px' }}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}
