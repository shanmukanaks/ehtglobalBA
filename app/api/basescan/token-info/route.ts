import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

const BASE_SEPOLIA_EXPLORER = "https://api-sepolia.basescan.org/api";

// ERC20 Token ABI - minimal ABI for name, symbol, decimals, and balanceOf
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

// Create public client for Base Sepolia
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get("address");

    if (!contractAddress) {
      return NextResponse.json(
        { error: "Contract address is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.BASESCAN_API_KEY || "";

    // Check if this is the known pool contract - default to mUSDC
    if (contractAddress.toLowerCase() === "0x2c2bbf3468C7D87bD8586899725020f207dD23c3".toLowerCase()) {
      // This is the pool contract - it holds mUSDC token
      // Try to read token info from the mUSDC token contract
      const MUSDC_TOKEN_ADDRESS = "0x261084cb1E6ac1900719634A19E56BB9c18B809A" as `0x${string}`;
      
      try {
        const [name, symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: MUSDC_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "name",
          }).catch(() => null),
          publicClient.readContract({
            address: MUSDC_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "symbol",
          }).catch(() => null),
          publicClient.readContract({
            address: MUSDC_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "decimals",
          }).catch(() => null),
        ]);

        if (name && symbol) {
          return NextResponse.json({
            tokenName: name as string,
            tokenSymbol: symbol as string,
            decimals: decimals || 6,
            contractAddress,
            tokenAddress: MUSDC_TOKEN_ADDRESS,
            isPoolContract: true,
          });
        }
      } catch (error) {
        console.error("Error reading mUSDC token info:", error);
      }

      // Fallback to default mUSDC values
      return NextResponse.json({
        tokenName: "mUSDC",
        tokenSymbol: "mUSDC",
        decimals: 6,
        contractAddress,
        tokenAddress: MUSDC_TOKEN_ADDRESS,
        isPoolContract: true,
      });
    }

    // Get contract source code to check if it's a token contract
    const contractUrl = `${BASE_SEPOLIA_EXPLORER}?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey || "YourApiKeyToken"}`;
    
    const contractResponse = await fetch(contractUrl);
    const contractData = await contractResponse.json();

    let tokenName = "ETH";
    let tokenSymbol = "ETH";
    
    try {
      // First, try to read token info directly from the contract using ERC20 functions
      try {
        const [name, symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "name",
          }).catch(() => null),
          publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "symbol",
          }).catch(() => null),
          publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "decimals",
          }).catch(() => null),
        ]);

        if (name && symbol) {
          // Contract is an ERC20 token
          tokenName = name as string;
          tokenSymbol = symbol as string;
          console.log(`Found ERC20 token: ${tokenName} (${tokenSymbol})`);
        } else {
          // Not an ERC20 token contract, check if it's a pool that holds tokens
          // For now, try Basescan API for contract info
          if (contractData.result && contractData.result[0] && contractData.result[0].ContractName) {
            const contractInfo = contractData.result[0];
            if (contractInfo.ContractName) {
              tokenName = contractInfo.ContractName;
              
              // Try to extract symbol from contract name
              if (contractInfo.ContractName.toLowerCase().includes("usdc") || 
                  contractInfo.ContractName.toLowerCase().includes("musdc")) {
                tokenSymbol = "mUSDC";
                tokenName = "mUSDC";
              } else if (contractInfo.ContractName.toLowerCase().includes("token")) {
                const nameParts = contractInfo.ContractName.split(/\s+/);
                tokenSymbol = nameParts[0] || "ETH";
              }
            }
          }
        }
      } catch (contractError) {
        console.error("Error reading contract:", contractError);
        // Fall back to Basescan API
        if (contractData.result && contractData.result[0] && contractData.result[0].ContractName) {
          const contractInfo = contractData.result[0];
          if (contractInfo.ContractName) {
            tokenName = contractInfo.ContractName;
            if (contractInfo.ContractName.toLowerCase().includes("usdc") || 
                contractInfo.ContractName.toLowerCase().includes("musdc")) {
              tokenSymbol = "mUSDC";
              tokenName = "mUSDC";
            }
          }
        }
      }
      
    } catch (error) {
      console.error("Error parsing token info:", error);
      // Default to ETH
      tokenName = "ETH";
      tokenSymbol = "ETH";
    }

    return NextResponse.json({
      tokenName,
      tokenSymbol,
      contractAddress,
    });
  } catch (error: any) {
    console.error("Error fetching token info from Basescan:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch token info",
        message: error?.message || "Unknown error",
        // Return default values on error
        tokenName: "ETH",
        tokenSymbol: "ETH",
      },
      { status: 500 }
    );
  }
}

