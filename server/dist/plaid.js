import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { cfg } from "./config.js";
const configuration = new Configuration({
    basePath: PlaidEnvironments[cfg.plaid.env],
    baseOptions: {
        headers: {
            "PLAID-CLIENT-ID": cfg.plaid.clientId,
            "PLAID-SECRET": cfg.plaid.secret
        }
    }
});
export const plaid = new PlaidApi(configuration);
