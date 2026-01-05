import "dotenv/config";
export const cfg = {
    port: parseInt(process.env.PORT || "4000", 10),
    corsOrigin: process.env.CORS_ORIGIN || "*", // Allow all origins for local dev
    rpcUrl: process.env.RPC_URL,
    poolAdminPK: process.env.POOL_ADMIN_PRIVATE_KEY,
    poolAddress: process.env.POOL_CONTRACT_ADDRESS,
    usdcAddress: process.env.USDC_ADDRESS,
    chainId: Number(process.env.CHAIN_ID || 84532),
    uploadDir: process.env.UPLOAD_DIR || "./uploads",
    plaid: {
        env: process.env.PLAID_ENV || "sandbox",
        clientId: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        products: (process.env.PLAID_PRODUCTS || "transactions").split(","),
        countryCodes: (process.env.PLAID_COUNTRY_CODES || "US").split(","),
    },
    // auth config
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-prod",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
    sessionSecret: process.env.SESSION_SECRET || "dev-session-secret-change-in-prod",
};
