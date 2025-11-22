import { NextResponse } from "next/server";

const BASE_SEPOLIA_EXPLORER = "https://api-sepolia.basescan.org/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get("address");
    const tokenAddress = searchParams.get("tokenAddress"); // mUSDC token address

    if (!contractAddress) {
      return NextResponse.json(
        { error: "Contract address is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.BASESCAN_API_KEY || "";

    // For the known pool contract, we'll fetch mUSDC balance
    // If tokenAddress is provided, use it; otherwise try to find mUSDC
    let tokenContractAddress = tokenAddress;

    // If this is the pool contract and no token address provided, use Basescan to find mUSDC
    if (contractAddress.toLowerCase() === "0x2c2bbf3468C7D87bD8586899725020f207dD23c3".toLowerCase()) {
      // For Base Sepolia, mUSDC token address would need to be provided or fetched
      // For now, we'll use the tokenbalance endpoint which needs the token contract address
      // You can add the mUSDC token address here or fetch it via Basescan
      
      // Use Basescan tokenbalance endpoint
      // Format: ?module=account&action=tokenbalance&contractaddress=TOKEN_ADDRESS&address=ACCOUNT_ADDRESS&tag=latest&apikey=YOUR_API_KEY
      
      // For now, return that we need the token address
      // In production, you would fetch the token address from the pool contract or have it configured
      return NextResponse.json({
        error: "Token address required",
        message: "Please provide the mUSDC token contract address",
        contractAddress,
      }, { status: 400 });
    }

    // Fetch token balance using Basescan API
    const balanceUrl = `${BASE_SEPOLIA_EXPLORER}?module=account&action=tokenbalance&contractaddress=${tokenContractAddress}&address=${contractAddress}&tag=latest&apikey=${apiKey || "YourApiKeyToken"}`;
    
    const balanceResponse = await fetch(balanceUrl);
    const balanceData = await balanceResponse.json();

    if (balanceData.status === "1" && balanceData.result) {
      return NextResponse.json({
        balance: balanceData.result,
        contractAddress,
        tokenAddress: tokenContractAddress,
      });
    } else {
      return NextResponse.json(
        {
          error: "Failed to fetch token balance",
          message: balanceData.message || "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching token balance from Basescan:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch token balance",
        message: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

