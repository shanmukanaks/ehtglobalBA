"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useEnsName, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, formatUnits, parseUnits } from "viem";
import { defineChain } from "viem";

// Define Base Sepolia testnet
const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
    },
    public: {
      http: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://sepolia.basescan.org',
    },
  },
  testnet: true,
});

const POOL_CONTRACT_ADDRESS = "0x6a8E895a2ED39F240f016216e9ED76FafCB0F805" as `0x${string}`;
const MUSDC_TOKEN_ADDRESS = "0x261084cb1E6ac1900719634A19E56BB9c18B809A" as `0x${string}`;
const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

// ERC20 ABI for balanceOf and decimals
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
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

// Pool contract ABI - EwaUsdPoolV2 contract functions
const POOL_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "lpBalance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export default function LPDashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ address });
  
  // Get user email from localStorage
  const [userEmail, setUserEmail] = useState<string>("");
  const [userDepositAmount, setUserDepositAmount] = useState<number>(0); // User's deposited amount
  const [earnings, setEarnings] = useState<number>(0); // User's earnings
  const [averageAPY, setAverageAPY] = useState<number>(0); // Average APY over 7 days
  const [tokenInfo, setTokenInfo] = useState<{ tokenName: string; tokenSymbol: string; decimals?: number } | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState<string>("");
  const [depositError, setDepositError] = useState<string>("");
  const [depositStep, setDepositStep] = useState<"idle" | "approving" | "depositing">("idle");
  
  // Withdraw state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>("");
  const [withdrawError, setWithdrawError] = useState<string>("");
  const [withdrawStep, setWithdrawStep] = useState<"idle" | "withdrawing">("idle");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    // Clear localStorage
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_role");
    localStorage.removeItem("plaid_connection");
    localStorage.removeItem("plaid_access_token");
    // Small delay to show loading state, then redirect
    setTimeout(() => {
      router.push("/");
    }, 500);
  };

  // Set document title
  useEffect(() => {
    document.title = "Paena - LP";
  }, []);
  
  // Write contract for approval
  const { writeContract: writeApproveContract, data: approveTxHash, isPending: isApprovePending, error: approveTxError } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Write contract for deposit
  const { writeContract: writeDepositContract, data: depositTxHash, isPending: isDepositPending, error: depositTxError } = useWriteContract();
  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });

  // Write contract for withdraw
  const { writeContract: writeWithdrawContract, data: withdrawTxHash, isPending: isWithdrawPending, error: withdrawTxError } = useWriteContract();
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });
  
  // Fetch token balance from contract (mUSDC balance of the pool)
  const { data: tokenBalanceData, isLoading: tokenBalanceLoading, error: tokenBalanceError, refetch: refetchPoolBalance } = useReadContract({
    address: MUSDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [POOL_CONTRACT_ADDRESS],
    chainId: baseSepolia.id,
    query: {
      refetchInterval: 5000, // Refetch every 5 seconds
      enabled: true,
    },
  });

  // Fetch token decimals
  const { data: tokenDecimals } = useReadContract({
    address: MUSDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: baseSepolia.id,
  });

  // Fetch user's mUSDC token balance
  const { data: userTokenBalance, refetch: refetchUserBalance } = useReadContract({
    address: MUSDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Fetch user's actual deposit balance from the pool contract using lpBalance(address)
  // This is the LP's individual deposit balance in the pool contract
  const { data: userDepositBalanceOnChain, error: userDepositError, refetch: refetchUserDeposit } = useReadContract({
    address: POOL_CONTRACT_ADDRESS,
    abi: POOL_ABI,
    functionName: "lpBalance",
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Update token balance display when balance or decimals change
  useEffect(() => {
    if (tokenBalanceData && tokenDecimals !== undefined) {
      const formatted = formatUnits(tokenBalanceData as bigint, tokenDecimals as number);
      setTokenBalance(formatted);
    }
  }, [tokenBalanceData, tokenDecimals]);

  // Fetch token info from Basescan - use mUSDC token address, not pool address
  useEffect(() => {
    const fetchTokenInfo = async () => {
      try {
        const response = await fetch(`/api/basescan/token-info?address=${MUSDC_TOKEN_ADDRESS}`);
        const data = await response.json();
        if (response.ok && data.tokenName) {
          setTokenInfo({
            tokenName: data.tokenName,
            tokenSymbol: data.tokenSymbol || "mUSDC",
            decimals: data.decimals,
          });
        } else {
          // Default to mUSDC with 6 decimals (standard for USDC)
          setTokenInfo({ tokenName: "mUSDC", tokenSymbol: "mUSDC", decimals: 6 });
        }
      } catch (error) {
        console.error("Error fetching token info:", error);
        // Default to mUSDC with 6 decimals (standard for USDC)
        setTokenInfo({ tokenName: "mUSDC", tokenSymbol: "mUSDC", decimals: 6 });
      }
    };

    fetchTokenInfo();
  }, []);

  // Update user deposit amount from on-chain data
  // This is the LP's individual deposit balance from lpBalance(address) in the pool contract
  useEffect(() => {
    const email = localStorage.getItem("user_email") || "";
    setUserEmail(email);

    if (!address || !isConnected) {
      // Not connected, reset to 0
      setUserDepositAmount(0);
      return;
    }

    // Get deposit balance from on-chain using lpBalance(address)
    if (userDepositBalanceOnChain !== undefined && tokenDecimals !== undefined) {
      const decimals = tokenDecimals as number;
      const onChainBalance = parseFloat(formatUnits(userDepositBalanceOnChain as bigint, decimals));
      setUserDepositAmount(onChainBalance);
      // Update localStorage to match on-chain balance
      localStorage.setItem(`lp_deposit_${address}`, onChainBalance.toString());
    } else if (userDepositError) {
      // If there's an error reading from chain, default to 0
      console.error("Error fetching LP balance:", userDepositError);
      setUserDepositAmount(0);
    } else {
      // If on-chain read is still loading or undefined, use localStorage as temporary fallback
      // But prefer 0 if no valid on-chain data
      const storedDeposit = localStorage.getItem(`lp_deposit_${address}`);
      if (storedDeposit) {
        const parsed = parseFloat(storedDeposit);
        // Only use localStorage value if it's a valid number and on-chain read hasn't failed
        if (!isNaN(parsed) && parsed >= 0) {
          setUserDepositAmount(parsed);
        } else {
          setUserDepositAmount(0);
        }
      } else {
        setUserDepositAmount(0);
      }
    }

    // Fetch earnings and APY from backend (last 7 days)
    const fetchEarningsAndAPY = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${API_BASE_URL}/api/admin/lp/earnings`);
        if (response.ok) {
          const data = await response.json();
          setEarnings(data.earnings7D || 0);
          setAverageAPY(data.apy || 0);
        } else {
          console.error("Failed to fetch LP earnings");
          setEarnings(0);
          setAverageAPY(0);
        }
      } catch (error) {
        console.error("Error fetching LP earnings:", error);
        setEarnings(0);
        setAverageAPY(0);
      }
    };

    fetchEarningsAndAPY();
    // Refresh earnings every 5 seconds to reflect user repayments and advancements
    const earningsInterval = setInterval(fetchEarningsAndAPY, 5000);

    return () => clearInterval(earningsInterval);
  }, [address, userDepositBalanceOnChain, userDepositError, tokenDecimals, isConnected]);

  // Helper function to truncate email
  const truncateEmail = (email: string, maxLength: number = 25) => {
    if (email.length <= maxLength) return email;
    return email.substring(0, maxLength - 3) + "...";
  };

  const formatBalance = (balance: string | bigint | undefined, decimals: number = 18) => {
    if (!balance) return "0.00";
    let formatted: string;
    if (typeof balance === "string") {
      formatted = parseFloat(balance).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals === 6 ? 2 : 4,
      });
    } else {
      formatted = parseFloat(formatUnits(balance, decimals)).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals === 6 ? 2 : 4,
      });
    }
    return formatted;
  };

  // ERC20 approve ABI
  const ERC20_APPROVE_ABI = [
    {
      name: "approve",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
    {
      name: "allowance",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
      ],
      outputs: [{ name: "", type: "uint256" }],
    },
  ] as const;

  const handleDepositClick = () => {
    if (!isConnected) {
      // Open wallet connect modal
      // We'll need to use ConnectButton's openConnectModal
      return;
    }
    setShowDepositModal(true);
  };

  const handleDeposit = async () => {
    if (!depositAmountInput || parseFloat(depositAmountInput) <= 0) {
      setDepositError("Please enter a valid deposit amount");
      return;
    }

    if (!isConnected || !address) {
      setDepositError("Please connect your wallet");
      return;
    }

    // Check if user has enough balance
    if (userTokenBalance !== undefined && tokenDecimals !== undefined) {
      const decimals = tokenDecimals as number;
      const userBalance = parseFloat(formatUnits(userTokenBalance as bigint, decimals));
      const depositAmount = parseFloat(depositAmountInput);
      
      if (depositAmount > userBalance) {
        setDepositError(`Insufficient balance. You have ${userBalance.toFixed(2)} ${tokenInfo?.tokenSymbol || "mUSDC"}`);
        return;
      }
    }

    setDepositError("");

    try {
      const decimals = (tokenDecimals as number) || 6;
      const depositAmountWei = parseUnits(depositAmountInput, decimals);

      // First, approve mUSDC spending to the POOL CONTRACT ADDRESS (not the token address)
      // Using max uint256 for approval to avoid repeated approvals
      const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      
      setDepositStep("approving");
      console.log("Approving mUSDC spending to pool contract:", POOL_CONTRACT_ADDRESS);
      writeApproveContract({
        address: MUSDC_TOKEN_ADDRESS, // This is the token contract - we're approving it to spend
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [POOL_CONTRACT_ADDRESS, maxApproval], // Approve the POOL CONTRACT to spend tokens
        chainId: baseSepolia.id,
      });
    } catch (error: any) {
      console.error("Deposit error:", error);
      setDepositError(error?.message || error?.shortMessage || "Failed to deposit. Please check your wallet balance and try again.");
      setDepositStep("idle");
    }
  };

  // After approval succeeds, automatically call deposit
  useEffect(() => {
    if (isApproveConfirmed && depositStep === "approving" && depositAmountInput && address) {
      // Approval confirmed, now call deposit
      setDepositStep("depositing");
      const decimals = (tokenDecimals as number) || 6;
      const depositAmountWei = parseUnits(depositAmountInput, decimals);
      
      // Small delay to ensure approval is fully processed on-chain
      setTimeout(() => {
        try {
          console.log("Calling deposit on pool contract:", POOL_CONTRACT_ADDRESS, "Amount:", depositAmountWei.toString());
          writeDepositContract({
            address: POOL_CONTRACT_ADDRESS, // Make sure we're calling the POOL CONTRACT, not the token
            abi: POOL_ABI,
            functionName: "deposit",
            args: [depositAmountWei],
            chainId: baseSepolia.id,
          });
        } catch (error: any) {
          console.error("Error calling deposit:", error);
          // Check if error is due to role restriction
          const errorMsg = error?.message || error?.shortMessage || "";
          if (errorMsg.includes("LP_ROLE") || errorMsg.includes("AccessControl") || errorMsg.includes("role")) {
            setDepositError("Transaction failed: You don't have LP_ROLE. Please contact admin to be added to the LP allowlist.");
          } else {
            setDepositError(errorMsg || "Failed to deposit. Please try again.");
          }
          setDepositStep("idle");
        }
      }, 2000); // Increased delay to ensure approval is confirmed
    }
    
    // After deposit succeeds, update state
    if (isDepositConfirmed && depositStep === "depositing" && depositAmountInput && address && depositTxHash) {
      // Track LP deposit in backend
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const decimals = (tokenDecimals as number) || 6;
      const depositAmountWei = parseUnits(depositAmountInput, decimals).toString();
      
      fetch(`${API_BASE_URL}/api/admin/lp/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: depositAmountWei,
          wallet: address.toLowerCase(),
          txHash: depositTxHash,
        }),
      }).catch(err => console.error("Failed to track LP deposit:", err));
      
      // Explicitly refetch balances to update UI immediately
      refetchUserDeposit();
      refetchPoolBalance();
      refetchUserBalance();
      
      // Reset modal after deposit
      setTimeout(() => {
        setShowDepositModal(false);
        setDepositAmountInput("");
        setDepositError("");
        setDepositStep("idle");
        // Refetch again after a short delay to ensure on-chain state is updated
        setTimeout(() => {
          refetchUserDeposit();
          refetchPoolBalance();
          refetchUserBalance();
        }, 2000);
      }, 2000);
    }
  }, [isApproveConfirmed, isDepositConfirmed, depositStep, depositAmountInput, address, depositTxHash, tokenDecimals, refetchUserDeposit, refetchPoolBalance, refetchUserBalance, writeDepositContract]);

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!withdrawAmountInput || parseFloat(withdrawAmountInput) <= 0) {
      setWithdrawError("Please enter a valid withdraw amount");
      return;
    }

    const withdrawAmount = parseFloat(withdrawAmountInput);
    
    if (withdrawAmount > userDepositAmount) {
      setWithdrawError("Cannot withdraw more than your deposit balance");
      return;
    }

    if (withdrawAmount > maxWithdrawable) {
      setWithdrawError(`Cannot withdraw more than $${maxWithdrawable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Pool must maintain 20% reserve.`);
      return;
    }

    if (!isConnected || !address) {
      setWithdrawError("Please connect your wallet");
      return;
    }

    setWithdrawError("");

    try {
      const decimals = (tokenDecimals as number) || 6;
      const withdrawAmountWei = parseUnits(withdrawAmountInput, decimals);

      // Call withdraw on the POOL CONTRACT ADDRESS (not the token address)
      // IMPORTANT: The contract's withdraw() function has onlyOwner modifier
      setWithdrawStep("withdrawing");
      console.log("Calling withdraw on pool contract:", POOL_CONTRACT_ADDRESS, "Amount:", withdrawAmountWei.toString());
      console.log("WARNING: withdraw() function has onlyOwner modifier - transaction will fail if you're not the contract owner");
      writeWithdrawContract({
        address: POOL_CONTRACT_ADDRESS, // Make sure we're calling the POOL CONTRACT, not the token
        abi: POOL_ABI,
        functionName: "withdraw",
        args: [withdrawAmountWei],
        chainId: baseSepolia.id,
      });
    } catch (error: any) {
      console.error("Withdraw error:", error);
      // Check if error is due to onlyOwner restriction
      const errorMsg = error?.message || error?.shortMessage || "";
      if (errorMsg.includes("onlyOwner") || errorMsg.includes("not owner") || errorMsg.includes("Ownable")) {
        setWithdrawError("Transaction failed: Only the contract owner can withdraw. Please contact the contract owner or use an authorized account.");
      } else {
        setWithdrawError(errorMsg || "Failed to withdraw. Please check your deposit balance and try again.");
      }
      setWithdrawStep("idle");
    }
  };

  // After withdraw succeeds, update state
  useEffect(() => {
    if (isWithdrawConfirmed && withdrawStep === "withdrawing" && withdrawAmountInput && address && withdrawTxHash) {
      // Track LP withdrawal in backend
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const decimals = (tokenDecimals as number) || 6;
      const withdrawAmountWei = parseUnits(withdrawAmountInput, decimals).toString();
      
      fetch(`${API_BASE_URL}/api/admin/lp/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: withdrawAmountWei,
          wallet: address.toLowerCase(),
          txHash: withdrawTxHash,
        }),
      }).catch(err => console.error("Failed to track LP withdrawal:", err));
      
      // Explicitly refetch balances to update UI immediately
      refetchUserDeposit();
      refetchPoolBalance();
      refetchUserBalance();
      
      // Reset modal after withdraw
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawAmountInput("");
        setWithdrawError("");
        setWithdrawStep("idle");
        // Refetch again after a short delay to ensure on-chain state is updated
        setTimeout(() => {
          refetchUserDeposit();
          refetchPoolBalance();
          refetchUserBalance();
        }, 2000);
      }, 2000);
    }
  }, [isWithdrawConfirmed, withdrawStep, withdrawAmountInput, address, withdrawTxHash, tokenDecimals, refetchUserDeposit, refetchPoolBalance, refetchUserBalance]);

  // Calculate max withdrawable amount considering 20% pool reserve
  const poolBalance = tokenBalanceData && tokenDecimals !== undefined 
    ? parseFloat(formatUnits(tokenBalanceData as bigint, tokenDecimals as number))
    : 0;
  const reserveAmount = poolBalance * 0.2; // 20% reserve
  const maxWithdrawableFromPool = Math.max(0, poolBalance - reserveAmount); // Can withdraw up to 80% of pool
  const maxWithdrawable = Math.min(userDepositAmount, maxWithdrawableFromPool); // LP can't withdraw more than they deposited

  // Set max withdraw amount
  const handleMaxWithdraw = () => {
    const maxAmount = maxWithdrawable > 0 ? maxWithdrawable : 0;
    setWithdrawAmountInput(maxAmount.toFixed(2));
    setWithdrawError("");
  };

  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* Paena Branding */}
        <div className="p-6 border-b border-gray-200">
          <h1 
            className="text-3xl font-bold text-venmo-blue" 
            style={{ fontFamily: 'EB Garamond, Garamond, serif' }}
          >
            Paena
          </h1>
        </div>

        {/* User Profile Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-venmo-blue rounded-full flex items-center justify-center text-white font-semibold text-lg">
              LP
            </div>
            <div>
              <div className="font-semibold text-lg">
                {(() => {
                  const email = localStorage.getItem("user_email") || "";
                  // If email is "admin" or "lp", show "LP", otherwise show the email (capitalized)
                  const displayText = (email === "admin" || email === "lp") ? "LP" : (email ? email.charAt(0).toUpperCase() + email.slice(1) : "LP User");
                  return displayText;
                })()}
              </div>
              <div className="text-sm text-gray-500">Liquidity Provider</div>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-3xl font-bold mb-1">
              ${userDepositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <a href="#" className="text-sm text-venmo-blue hover:underline">
              Deposit balance
            </a>
          </div>

          {/* Connect to Wallet Button */}
          <div className="mb-4">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== "loading";
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === "authenticated");

                const displayAddress = account?.address
                  ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                  : "";

                return (
                  <div
                    {...(!ready && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      },
                    })}
                  >
                    {!connected ? (
                      <button
                        onClick={openConnectModal}
                        type="button"
                        className="w-full bg-transparent border-2 border-venmo-blue text-venmo-blue font-semibold py-3 px-4 rounded-2xl hover:bg-venmo-blue hover:text-white transition-colors"
                        style={{ borderRadius: '16px' }}
                      >
                        Connect to Wallet
                      </button>
                    ) : (
                      <button
                        onClick={openAccountModal}
                        type="button"
                        className="w-full bg-white border-2 border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors text-sm"
                        style={{ borderRadius: '16px' }}
                      >
                        {ensName || displayAddress}
                      </button>
                    )}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>

        {/* Navigation Links (empty) */}
        <nav className="flex-1 px-2 py-4 space-y-1"></nav>

        {/* Log out button */}
        <div className="p-6 mt-auto border-t border-gray-200">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full bg-transparent border-2 border-red-500 text-red-500 font-semibold py-3 px-4 rounded-2xl hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ borderRadius: '16px' }}
          >
            {isLoggingOut && (
              <svg 
                className="animate-spin h-5 w-5 text-red-500" 
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
            <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 bg-white overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Pool Information</h2>
            <p className="text-sm text-gray-500">View your deposits and pool statistics</p>
          </div>

          {/* Pool Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Your Deposit Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Your Deposit
              </label>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                ${userDepositAmount.toLocaleString('en-US', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <div className="text-xs text-gray-500">
                Total amount you've deposited
              </div>
            </div>

            {/* Total Pool Balance Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Total Pool Balance
                </label>
                <button
                  onClick={() => {
                    refetchPoolBalance();
                    refetchUserDeposit();
                    refetchUserBalance();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Refresh pool balance"
                  type="button"
                >
                  <svg 
                    className={`w-4 h-4 ${tokenBalanceLoading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                </button>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {tokenBalanceLoading ? (
                  "Loading..."
                ) : tokenBalanceError ? (
                  "Error loading"
                ) : tokenBalance ? (
                  `$${formatBalance(tokenBalance, (tokenDecimals as number) || 6)} mUSDC`
                ) : (
                  `$0.00 mUSDC`
                )}
              </div>
              <div className="text-xs text-gray-500">
                Total mUSDC balance in pool contract (auto-refreshes every 5 seconds)
              </div>
              {tokenBalanceError && (
                <div className="mt-2 text-xs text-red-500">
                  {tokenBalanceError.message || "Failed to load balance"}
                </div>
              )}
            </div>
          </div>

          {/* Earnings and APY Card - Full Width */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <label className="text-sm font-medium text-gray-700 mb-4 block">
              Earnings & Performance
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-600 mb-2">Earnings (7D)</div>
                <div className="text-3xl font-bold text-gray-900">
                  ${earnings.toLocaleString('en-US', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-2">Average APY (7 days)</div>
                <div className="text-3xl font-bold text-gray-900">
                  {averageAPY > 0 ? `${averageAPY.toFixed(2)}%` : "0.00%"}
                </div>
              </div>
            </div>
          </div>

          {/* Contract Address Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              Contract Address
            </label>
            <div className="flex items-center gap-3">
              <code className="text-sm font-mono text-gray-800 bg-white px-3 py-2 rounded border border-gray-300">
                {POOL_CONTRACT_ADDRESS}
              </code>
              <button
                onClick={() => {
                  window.open(`${BASE_SEPOLIA_EXPLORER}/address/${POOL_CONTRACT_ADDRESS}`, '_blank');
                }}
                className="text-sm text-venmo-blue hover:underline font-medium"
              >
                Search on block explorer
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Network: Base Sepolia Testnet
            </div>
          </div>

          {/* Deposit Liquidity Button - Full Width */}
          <div className="mb-4">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== "loading";
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === "authenticated");

                return (
                  <div
                    {...(!ready && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      },
                    })}
                  >
                    {!connected ? (
                      <button
                        onClick={openConnectModal}
                        type="button"
                        className="w-full bg-venmo-blue text-white font-semibold py-4 px-6 rounded-2xl hover:bg-blue-600 transition-colors"
                        style={{ borderRadius: '16px', minHeight: '52px' }}
                      >
                        Deposit Liquidity
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowDepositModal(true)}
                        type="button"
                        className="w-full bg-venmo-blue text-white font-semibold py-4 px-6 rounded-2xl hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        style={{ borderRadius: '16px', minHeight: '52px' }}
                    disabled={isApprovePending || isApproveConfirming || isDepositPending || isDepositConfirming || depositStep !== "idle"}
                  >
                    {(isApprovePending || isApproveConfirming || isDepositPending || isDepositConfirming || depositStep !== "idle") ? "Processing..." : "Deposit Liquidity"}
                      </button>
                    )}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>

          {/* Withdraw Button - Full Width */}
          <div className="mb-6">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== "loading";
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === "authenticated");

                return (
                  <div
                    {...(!ready && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      },
                    })}
                  >
                    {!connected ? (
                      <button
                        onClick={openConnectModal}
                        type="button"
                        className="w-full bg-transparent border-2 border-venmo-blue text-venmo-blue font-semibold py-4 px-6 rounded-2xl hover:bg-venmo-blue hover:text-white transition-colors"
                        style={{ borderRadius: '16px', minHeight: '52px' }}
                      >
                        Withdraw
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowWithdrawModal(true)}
                        type="button"
                        className="w-full bg-transparent border-2 border-venmo-blue text-venmo-blue font-semibold py-4 px-6 rounded-2xl hover:bg-venmo-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderRadius: '16px', minHeight: '52px' }}
                        disabled={isWithdrawPending || isWithdrawConfirming || withdrawStep !== "idle" || userDepositAmount <= 0}
                      >
                        {(isWithdrawPending || isWithdrawConfirming || withdrawStep !== "idle") ? "Processing..." : "Withdraw"}
                      </button>
                    )}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>

          {/* Deposit Modal */}
          {showDepositModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" style={{ borderRadius: '8px' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Deposit Liquidity</h3>
                  <button
                    onClick={() => {
                      // Always allow closing - reset state regardless of transaction status
                      // Note: We can't cancel a blockchain transaction once submitted,
                      // but we can reset our UI state and stop waiting for it
                      setShowDepositModal(false);
                      setDepositAmountInput("");
                      setDepositError("");
                      setDepositStep("idle");
                      // Reset transaction state by clearing any pending states
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    type="button"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Amount to Deposit ({tokenInfo?.tokenSymbol || "mUSDC"})
                  </label>
                  <input
                    type="number"
                    value={depositAmountInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseFloat(value) >= 0)) {
                        setDepositAmountInput(value);
                        setDepositError("");
                      }
                    }}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    disabled={depositStep !== "idle"}
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-venmo-blue focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {depositError && (
                    <div className="mt-2 text-sm text-red-600">{depositError}</div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {userTokenBalance !== undefined && tokenDecimals !== undefined ? (
                      <>Wallet Balance: {parseFloat(formatUnits(userTokenBalance as bigint, tokenDecimals as number)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tokenInfo?.tokenSymbol || "mUSDC"}</>
                    ) : (
                      "Loading balance..."
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Cancel deposit and reset all state
                      setShowDepositModal(false);
                      setDepositAmountInput("");
                      setDepositError("");
                      setDepositStep("idle");
                      // Note: Blockchain transactions can't be cancelled once submitted,
                      // but we reset the UI state so the user can start fresh
                    }}
                    className="flex-1 bg-transparent border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    style={{ borderRadius: '16px', minHeight: '52px' }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeposit}
                    disabled={!depositAmountInput || parseFloat(depositAmountInput) <= 0 || isApprovePending || isApproveConfirming || isDepositPending || isDepositConfirming || depositStep !== "idle"}
                    className="flex-1 bg-venmo-blue text-white font-semibold py-3 px-6 rounded-2xl hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    style={{ borderRadius: '16px', minHeight: '52px' }}
                  >
                    {depositStep === "approving" ? "Approving..." : depositStep === "depositing" ? "Depositing..." : isApprovePending || isApproveConfirming || isDepositPending || isDepositConfirming ? "Processing..." : "Deposit"}
                  </button>
                </div>

                {(isApprovePending || isApproveConfirming || isDepositPending || isDepositConfirming || depositStep !== "idle") && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-venmo-blue"></div>
                      <div>
                        <div className="font-semibold text-gray-900">Processing Transaction</div>
                        <div className="text-sm text-gray-600">
                          {depositStep === "approving" ? "Approving mUSDC spending..." : depositStep === "depositing" ? "Depositing to pool..." : isApprovePending || isDepositPending ? "Waiting for wallet confirmation..." : "Confirming transaction..."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isDepositConfirmed && depositStep === "depositing" && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="font-semibold text-green-900">Deposit Successful!</div>
                        <div className="text-sm text-green-700">Your liquidity has been deposited.</div>
                      </div>
                    </div>
                  </div>
                )}

                {(depositTxError || approveTxError) && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="font-semibold text-red-900">Transaction Failed</div>
                        <div className="text-sm text-red-700">{((depositTxError || approveTxError) as any)?.message || ((depositTxError || approveTxError) as any)?.shortMessage || "Please try again."}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Withdraw Modal */}
          {showWithdrawModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" style={{ borderRadius: '8px' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Withdraw Liquidity</h3>
                  <button
                    onClick={() => {
                      // Always allow closing - reset state regardless of transaction status
                      setShowWithdrawModal(false);
                      setWithdrawAmountInput("");
                      setWithdrawError("");
                      setWithdrawStep("idle");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    type="button"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Amount to Withdraw ({tokenInfo?.tokenSymbol || "mUSDC"})
                    </label>
                    <button
                      onClick={handleMaxWithdraw}
                      type="button"
                      className="text-sm text-venmo-blue hover:underline font-medium"
                      disabled={withdrawStep !== "idle" || maxWithdrawable <= 0}
                    >
                      Max: {maxWithdrawable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </button>
                  </div>
                  <input
                    type="number"
                    value={withdrawAmountInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseFloat(value) >= 0)) {
                        const numValue = parseFloat(value);
                        if (isNaN(numValue) || numValue <= maxWithdrawable) {
                          setWithdrawAmountInput(value);
                          setWithdrawError("");
                        } else {
                          if (numValue > userDepositAmount) {
                            setWithdrawError("Cannot withdraw more than your deposit balance");
                          } else {
                            setWithdrawError(`Cannot withdraw more than $${maxWithdrawable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Pool must maintain 20% reserve.`);
                          }
                        }
                      }
                    }}
                    placeholder="0.00"
                    min="0"
                    max={maxWithdrawable}
                    step="0.01"
                    disabled={withdrawStep !== "idle"}
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-venmo-blue focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {withdrawError && (
                    <div className="mt-2 text-sm text-red-600">{withdrawError}</div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    Available to withdraw: {maxWithdrawable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tokenInfo?.tokenSymbol || "mUSDC"}
                    {maxWithdrawable < userDepositAmount && (
                      <span className="text-gray-400 ml-1">(Limited by 20% pool reserve)</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Cancel withdraw and reset all state
                      setShowWithdrawModal(false);
                      setWithdrawAmountInput("");
                      setWithdrawError("");
                      setWithdrawStep("idle");
                    }}
                    className="flex-1 bg-transparent border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    style={{ borderRadius: '16px', minHeight: '52px' }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={!withdrawAmountInput || parseFloat(withdrawAmountInput) <= 0 || parseFloat(withdrawAmountInput) > maxWithdrawable || isWithdrawPending || isWithdrawConfirming || withdrawStep !== "idle"}
                    className="flex-1 bg-venmo-blue text-white font-semibold py-3 px-6 rounded-2xl hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    style={{ borderRadius: '16px', minHeight: '52px' }}
                  >
                    {withdrawStep === "withdrawing" ? "Withdrawing..." : isWithdrawPending || isWithdrawConfirming ? "Processing..." : "Withdraw"}
                  </button>
                </div>

                {(isWithdrawPending || isWithdrawConfirming || withdrawStep !== "idle") && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-venmo-blue"></div>
                      <div>
                        <div className="font-semibold text-gray-900">Processing Transaction</div>
                        <div className="text-sm text-gray-600">
                          {withdrawStep === "withdrawing" ? "Withdrawing from pool..." : isWithdrawPending ? "Waiting for wallet confirmation..." : "Confirming transaction..."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isWithdrawConfirmed && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="font-semibold text-green-900">Withdrawal Successful!</div>
                        <div className="text-sm text-green-700">Your liquidity has been withdrawn.</div>
                      </div>
                    </div>
                  </div>
                )}

                {withdrawTxError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="font-semibold text-red-900">Transaction Failed</div>
                        <div className="text-sm text-red-700 whitespace-pre-line">
                          {(withdrawTxError as any)?.message || (withdrawTxError as any)?.shortMessage || (withdrawTxError as any)?.cause?.message || "Transaction failed. Please check:\n- You have a deposit balance to withdraw\n- You have enough ETH for gas fees\n- The network is Base Sepolia\n- Try again"}
                        </div>
                        {((withdrawTxError as any)?.message?.includes("onlyOwner") || 
                          (withdrawTxError as any)?.message?.includes("not owner") ||
                          (withdrawTxError as any)?.shortMessage?.includes("onlyOwner")) && (
                          <div className="text-xs text-red-600 mt-2">
                            ⚠️ The withdraw function requires contract owner permissions. Only the contract owner can withdraw.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

