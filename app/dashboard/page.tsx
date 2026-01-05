"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useEnsName, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { defineChain } from "viem";
import { ProtectedRoute } from "../components/ProtectedRoute";

// Define Base Sepolia testnet
const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
    public: {
      http: ['https://sepolia.base.org'],
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

const USDC_TOKEN_ADDRESS = "0x261084cb1E6ac1900719634A19E56BB9c18B809A" as `0x${string}`;

// ERC20 ABI for approve, allowance, transfer, and balanceOf
const ERC20_ABI = [
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
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Pool contract ABI - functions needed for user dashboard
const POOL_ABI = [
  {
    name: "draw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "lineOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "limit", type: "uint256" },
      { name: "debt", type: "uint256" },
      { name: "dueDate", type: "uint64" },
    ],
  },
  {
    name: "freeLiquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ address });
  
  // Get user email and Plaid connection data from localStorage
  const [userEmail, setUserEmail] = useState<string>("");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [incomeData, setIncomeData] = useState<{
    income?: number;
    payPeriod?: string;
    payFrequency?: string;
  } | null>(null);
  
  // Function to update account data from localStorage
  const updateAccountData = () => {
    // Get email from localStorage
    const email = localStorage.getItem("user_email") || "";
    // Ensure we're on user dashboard - if email is "admin" or "lp", use "user" instead
    const displayEmail = (email === "admin" || email === "lp") ? "user" : email;
    setUserEmail(displayEmail);
    
    // Check if user has pending application
    const pendingApp = localStorage.getItem("has_pending_application") === "true";
    setHasPendingApplication(pendingApp);
    
    // Get Plaid connection data
    const plaidDataStr = localStorage.getItem("plaid_connection");
    if (plaidDataStr) {
      try {
        const plaidData = JSON.parse(plaidDataStr);
        
        // Handle institution name - could be string or object
        let institutionName = "Unknown Bank";
        if (typeof plaidData.institution === "string") {
          institutionName = plaidData.institution;
        } else if (plaidData.institution?.name) {
          institutionName = plaidData.institution.name;
        }
        
        const accounts = plaidData.accounts || [];
        
        // Get first account name/mask if available
        let accountInfo = institutionName;
        if (accounts.length > 0) {
          const firstAccount = accounts[0];
          
          // Try multiple fields for account name
          const accountName = firstAccount.name || 
                             firstAccount.official_name || 
                             firstAccount.type || 
                             firstAccount.subtype || 
                             "";
          
          if (accountName && accountName !== institutionName) {
            accountInfo = `${accountName} • ${institutionName}`;
          } else if (firstAccount.mask) {
            accountInfo = `****${firstAccount.mask} • ${institutionName}`;
          } else if (firstAccount.type && firstAccount.subtype) {
            accountInfo = `${firstAccount.type} ${firstAccount.subtype} • ${institutionName}`;
          }
        }
        
        setBankAccount(accountInfo);
        console.log("Updated bank account display:", accountInfo, "from data:", plaidData);
      } catch (e) {
        console.error("Error parsing Plaid data:", e);
        setBankAccount("");
      }
    } else {
      // Clear bank account if no Plaid data
      setBankAccount("");
    }
  };

  // Fetch income data
  const fetchIncomeData = async () => {
    const accessToken = localStorage.getItem("plaid_access_token");
    if (!accessToken) return;

    try {
      const response = await fetch("/api/plaid/income", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      const data = await response.json();
      if (response.ok) {
        if (data.income) {
          // Use actual income data
          setIncomeData({
            income: data.income.gross_annual / (data.income.pay_frequency === "biweekly" ? 26 : data.income.pay_frequency === "monthly" ? 12 : 52),
            payPeriod: data.income.pay_period_start && data.income.pay_period_end 
              ? `${new Date(data.income.pay_period_start).toLocaleDateString()} - ${new Date(data.income.pay_period_end).toLocaleDateString()}`
              : "Current Period",
            payFrequency: data.income.pay_frequency || "biweekly",
          });
        } else if (data.mockData) {
          // Use mock data
          const grossAnnual = data.income.gross_annual || 75000;
          const frequency = data.income.pay_frequency || "biweekly";
          const periodAmount = frequency === "biweekly" ? grossAnnual / 26 
            : frequency === "monthly" ? grossAnnual / 12 
            : grossAnnual / 52;
          
          setIncomeData({
            income: Math.round(periodAmount),
            payPeriod: data.income.pay_period_start && data.income.pay_period_end
              ? `${new Date(data.income.pay_period_start).toLocaleDateString()} - ${new Date(data.income.pay_period_end).toLocaleDateString()}`
              : "Current Period",
            payFrequency: frequency,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching income data:", error);
    }
  };

  useEffect(() => {
    // Initial load
    updateAccountData();
    fetchIncomeData();

    // Listen for storage events (when Plaid data is updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "plaid_connection" || e.key === "user_email" || e.key === "plaid_access_token") {
        updateAccountData();
        if (e.key === "plaid_access_token") {
          fetchIncomeData();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also check for updates when page becomes visible (in case localStorage was updated in same tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateAccountData();
        fetchIncomeData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check for updates periodically (as fallback for same-tab updates)
    const interval = setInterval(() => {
      updateAccountData();
    }, 1000); // Check every second

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);
  
  // Helper function to truncate email
  const truncateEmail = (email: string, maxLength: number = 25) => {
    if (email.length <= maxLength) return email;
    return email.substring(0, maxLength - 3) + "...";
  };
  
  // State for loan page
  const [showLoanPage, setShowLoanPage] = useState(false);
  const [showRepayPage, setShowRepayPage] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [transactionError, setTransactionError] = useState<string>("");
  const [repayTransactionStatus, setRepayTransactionStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [allowanceApproved, setAllowanceApproved] = useState(false); // Track if USDC allowance is approved
  // Track previous balance/debt values to detect changes
  const [previousUsdcBalance, setPreviousUsdcBalance] = useState<number | null>(null);
  const [previousDebt, setPreviousDebt] = useState<number | null>(null);
  const [expectedAdvancementAmount, setExpectedAdvancementAmount] = useState<number | null>(null);
  
  // Initialize history from localStorage if available
  const getHistoryFromStorage = (): Array<{ amount: number; date: Date; type: 'advancement' | 'repayment' }> => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('advancement_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((item: any) => ({
          ...item,
          date: new Date(item.date) // Convert date string back to Date object
        }));
      }
    } catch (error) {
      console.error("Error loading history from localStorage:", error);
    }
    return [];
  };
  
  const [advancementHistory, setAdvancementHistory] = useState<Array<{ amount: number; date: Date; type: 'advancement' | 'repayment' }>>(getHistoryFromStorage); // Track advancement and repayment history
  const [inputError, setInputError] = useState<string>(""); // Track if input exceeds available amount
  
  // Load tracked transaction hashes from localStorage
  const getTrackedHashesFromStorage = (key: string): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      }
    } catch (error) {
      console.error(`Error loading tracked hashes from localStorage (${key}):`, error);
    }
    return new Set();
  };
  
  // Track which transaction hashes have already been processed to prevent duplicate tracking
  const trackedAdvancementTxHashes = useRef<Set<string>>(getTrackedHashesFromStorage('tracked_advancement_tx_hashes'));
  const trackedRepaymentTxHashes = useRef<Set<string>>(getTrackedHashesFromStorage('tracked_repayment_tx_hashes'));
  // Track which transaction hashes have already been added to history to prevent duplicate history entries
  const historyAddedTxHashes = useRef<Set<string>>(getTrackedHashesFromStorage('history_added_tx_hashes'));
  
  // Save tracked hashes to localStorage
  const saveTrackedHashesToStorage = (key: string, hashes: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(hashes)));
    } catch (error) {
      console.error(`Error saving tracked hashes to localStorage (${key}):`, error);
    }
  };
  
  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('advancement_history', JSON.stringify(advancementHistory));
    } catch (error) {
      console.error("Error saving history to localStorage:", error);
    }
  }, [advancementHistory]);
  
  // Upload paystub state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [hasPendingApplication, setHasPendingApplication] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Note: Application creation no longer happens automatically on wallet connect
  // Applications are only created when the user uploads a paystub via handleUploadPaystub

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
    document.title = "Paena - User";
  }, []);

  // Fetch credit line from contract
  const { data: creditLineData, refetch: refetchCreditLine } = useReadContract({
    address: POOL_CONTRACT_ADDRESS,
    abi: POOL_ABI,
    functionName: "lineOf",
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Fetch free liquidity from contract
  const { data: freeLiquidityData, refetch: refetchFreeLiquidity } = useReadContract({
    address: POOL_CONTRACT_ADDRESS,
    abi: POOL_ABI,
    functionName: "freeLiquidity",
    chainId: baseSepolia.id,
    query: {
      refetchInterval: 5000,
    },
  });

  // Parse credit line data
  const creditLimit = creditLineData?.[0] ? parseFloat(formatUnits(creditLineData[0] as bigint, 6)) : 0;
  const currentDebt = creditLineData?.[1] ? parseFloat(formatUnits(creditLineData[1] as bigint, 6)) : 0;
  const dueDateTimestamp = creditLineData?.[2] ? Number(creditLineData[2]) : 0;
  const paybackDate = dueDateTimestamp > 0 ? new Date(dueDateTimestamp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const freeLiquidity = freeLiquidityData ? parseFloat(formatUnits(freeLiquidityData as bigint, 6)) : 0;
  
  // Calculate available advance amount (limit minus current debt)
  // currentDebt from contract is already just the principal (doesn't include fee)
  // The fee is tracked separately and doesn't reduce their available credit limit
  const availableAdvanceAmount = Math.max(0, creditLimit - currentDebt);
  const status: "Approved" | "Pending Review" = creditLimit > 0 ? "Approved" : "Pending Review";
  
  // Update hasPendingApplication when status changes to Approved (application was approved)
  useEffect(() => {
    if (status === "Approved" && hasPendingApplication) {
      setHasPendingApplication(false);
      localStorage.removeItem("has_pending_application");
    }
  }, [status, hasPendingApplication]);
  
  // Write contract hooks for draw
  const { writeContract: writeDrawContract, data: drawTxHash, isPending: isDrawPending, error: drawTxError } = useWriteContract();
  const { isLoading: isDrawConfirming, isSuccess: isDrawConfirmed } = useWaitForTransactionReceipt({
    hash: drawTxHash,
  });

  // Backup: Track advancement when transaction is confirmed (in case balance detection missed it)
  useEffect(() => {
    if (isDrawConfirmed && drawTxHash && expectedAdvancementAmount !== null && expectedAdvancementAmount > 0 && address) {
      // Only track if we haven't already tracked this transaction hash
      if (!trackedAdvancementTxHashes.current.has(drawTxHash)) {
        const ADVANCEMENT_FEE = 0.99;
        const principal = expectedAdvancementAmount;
        
        // Mark this transaction hash as tracked
        trackedAdvancementTxHashes.current.add(drawTxHash);
        saveTrackedHashesToStorage('tracked_advancement_tx_hashes', trackedAdvancementTxHashes.current);
        
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        fetch(`${API_BASE_URL}/api/admin/advancement-fee`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wallet: address.toLowerCase(),
            amount: ADVANCEMENT_FEE,
            principal: principal,
            txHash: drawTxHash,
          }),
        }).then(response => {
          if (response.ok) {
            console.log("Advancement tracked successfully in backend (via transaction confirmation)");
          } else {
            console.error("Failed to track advancement:", response.status);
            trackedAdvancementTxHashes.current.delete(drawTxHash);
            saveTrackedHashesToStorage('tracked_advancement_tx_hashes', trackedAdvancementTxHashes.current);
          }
        }).catch(err => {
          console.error("Failed to track advancement:", err);
          trackedAdvancementTxHashes.current.delete(drawTxHash);
          saveTrackedHashesToStorage('tracked_advancement_tx_hashes', trackedAdvancementTxHashes.current);
        });
        
        // Add to history (only if not already added)
        if (!historyAddedTxHashes.current.has(drawTxHash)) {
          historyAddedTxHashes.current.add(drawTxHash);
          saveTrackedHashesToStorage('history_added_tx_hashes', historyAddedTxHashes.current);
          setAdvancementHistory(prev => [{ amount: principal, date: new Date(), type: 'advancement' }, ...prev]);
        }
      }
    }
  }, [isDrawConfirmed, drawTxHash, expectedAdvancementAmount, address]);

  // Write contract hooks for repay
  const { writeContract: writeRepayContract, data: repayTxHash, isPending: isRepayPending, error: repayTxError } = useWriteContract();
  const { isLoading: isRepayConfirming, isSuccess: isRepayConfirmed } = useWaitForTransactionReceipt({
    hash: repayTxHash,
  });

  // Backup: Track repayment when transaction is confirmed (in case debt detection missed it)
  useEffect(() => {
    if (isRepayConfirmed && repayTxHash && repayAmount && address) {
      // Only track if we haven't already tracked this transaction hash
      if (!trackedRepaymentTxHashes.current.has(repayTxHash)) {
        const ADVANCEMENT_FEE = 0.99;
        const amountToRepay = parseFloat(repayAmount);
        const principalRepaid = amountToRepay - ADVANCEMENT_FEE;
        
        if (!isNaN(amountToRepay) && amountToRepay > 0 && principalRepaid >= 0) {
          // Mark this transaction hash as tracked
          trackedRepaymentTxHashes.current.add(repayTxHash);
          saveTrackedHashesToStorage('tracked_repayment_tx_hashes', trackedRepaymentTxHashes.current);
          
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          fetch(`${API_BASE_URL}/api/admin/repayment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wallet: address.toLowerCase(),
              principal: principalRepaid,
              fee: ADVANCEMENT_FEE,
              txHash: repayTxHash,
            }),
          }).then(response => {
            if (response.ok) {
              console.log("Repayment tracked successfully in backend (via transaction confirmation)");
            } else {
              console.error("Failed to track repayment:", response.status);
              trackedRepaymentTxHashes.current.delete(repayTxHash);
              saveTrackedHashesToStorage('tracked_repayment_tx_hashes', trackedRepaymentTxHashes.current);
            }
          }).catch(err => {
            console.error("Failed to track repayment:", err);
            trackedRepaymentTxHashes.current.delete(repayTxHash);
            saveTrackedHashesToStorage('tracked_repayment_tx_hashes', trackedRepaymentTxHashes.current);
          });
          
          // Add to history (only if not already added)
          if (!historyAddedTxHashes.current.has(repayTxHash)) {
            historyAddedTxHashes.current.add(repayTxHash);
            saveTrackedHashesToStorage('history_added_tx_hashes', historyAddedTxHashes.current);
            setAdvancementHistory(prev => [{ amount: amountToRepay, date: new Date(), type: 'repayment' }, ...prev]);
          }
        }
      }
    }
  }, [isRepayConfirmed, repayTxHash, repayAmount, address]);

  // Write contract hooks for USDC approve
  const { writeContract: writeApproveContract, data: approveTxHash, isPending: isApprovePending } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Check USDC allowance
  const { data: usdcAllowance } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && isConnected ? [address, POOL_CONTRACT_ADDRESS] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!address && isConnected && showRepayPage,
      refetchInterval: 3000,
    },
  });

  // Fetch user's USDC balance to detect when advancement succeeds
  const { data: usdcBalanceData, refetch: refetchUsdcBalance } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: (query) => {
        // Refetch every 2 seconds when transaction is processing, otherwise every 10 seconds
        return transactionStatus === "processing" || repayTransactionStatus === "processing" ? 2000 : 10000;
      },
    },
  });

  const usdcBalance = usdcBalanceData ? parseFloat(formatUnits(usdcBalanceData as bigint, 6)) : 0;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { 
      month: "long", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const handleAdvanceNow = () => {
    setShowLoanPage(true);
    setIsLoading(true);
    // Simulate loading for 0.5 seconds
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleGetFunds = async () => {
    if (!loanAmount || parseFloat(loanAmount) <= 0) {
      setInputError("Please enter a valid amount");
      return;
    }

    if (!isConnected || !address) {
      setTransactionError("Please connect your wallet");
      setTransactionStatus("error");
      return;
    }

    const amount = parseFloat(loanAmount);
    
    // Validate amount doesn't exceed available advance
    if (amount > availableAdvanceAmount) {
      setInputError(`Amount exceeds available limit of $${availableAdvanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      setTransactionStatus("error");
      return;
    }

    // Validate amount doesn't exceed pool liquidity
    if (amount > freeLiquidity) {
      setTransactionError(`Amount exceeds available pool liquidity of $${freeLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      setTransactionStatus("error");
      return;
    }

    // Validate user has credit line
    if (creditLimit === 0) {
      setTransactionError("No credit line approved. Please wait for approval.");
      setTransactionStatus("error");
      return;
    }

    // Note: We don't check for existing debt here - the contract will enforce "one loan at a time"
    // The availableAdvanceAmount calculation already accounts for existing debt

    setInputError("");
    setTransactionError("");
    setTransactionStatus("processing");
    
    // Capture current balance before transaction to detect when it changes
    setPreviousUsdcBalance(usdcBalance);
    setExpectedAdvancementAmount(amount);
    
    try {
      const ADVANCEMENT_FEE = 0.99;
      const totalAmount = amount + ADVANCEMENT_FEE;
      
      // Validate amount doesn't exceed available advance (fee doesn't count toward credit limit)
      if (amount > availableAdvanceAmount) {
        setInputError(`Amount exceeds available limit of $${availableAdvanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        setTransactionStatus("error");
        setPreviousUsdcBalance(null);
        setExpectedAdvancementAmount(null);
        return;
      }

      // Validate only the amount (not the fee) against pool liquidity
      // The fee never leaves the vault - it's just added to what the user owes
      if (amount > freeLiquidity) {
        setTransactionError(`Amount exceeds available pool liquidity of $${freeLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        setTransactionStatus("error");
        setPreviousUsdcBalance(null);
        setExpectedAdvancementAmount(null);
        return;
      }
      
      // Convert amount to wei (USDC has 6 decimals)
      // Only draw the advancement amount - the fee is not drawn from the vault
      // The fee will be added to what the user owes when they repay
      const amountWei = parseUnits(amount.toFixed(6), 6);
      
      // Call draw function on contract with only the amount (not amount + fee)
      // This withdraws only the amount from the vault and sets debt to amount
      // The fee will be tracked separately and added to repayment amount
      writeDrawContract({
        address: POOL_CONTRACT_ADDRESS,
        abi: POOL_ABI,
        functionName: "draw",
        args: [amountWei],
        chainId: baseSepolia.id,
      });
    } catch (error: any) {
      console.error("Error calling draw:", error);
      setTransactionError(error?.message || error?.shortMessage || "Failed to initiate transaction. Please try again.");
      setTransactionStatus("error");
      setPreviousUsdcBalance(null);
      setExpectedAdvancementAmount(null);
    }
  };

  // Write contract hook for transferring fee to pool (for repayment)
  const { writeContract: writeFeeTransferContract, data: feeTransferTxHash, isPending: isFeeTransferPending } = useWriteContract();
  const { isLoading: isFeeTransferConfirming, isSuccess: isFeeTransferConfirmed } = useWaitForTransactionReceipt({
    hash: feeTransferTxHash,
  });

  // Track balance change for advancement success detection
  useEffect(() => {
    if (transactionStatus === "processing" && expectedAdvancementAmount !== null && previousUsdcBalance !== null) {
      // Check if USDC balance increased by approximately the expected amount
      const balanceIncrease = usdcBalance - previousUsdcBalance;
      // Allow small tolerance for rounding/fees
      if (balanceIncrease >= expectedAdvancementAmount * 0.99) {
        console.log("Balance increased, advancement successful!");
      setTransactionStatus("success");
        refetchCreditLine();
        
        // Track advancement in backend (similar to how repayments are tracked)
        const ADVANCEMENT_FEE = 0.99;
        const principal = expectedAdvancementAmount;
        
        // Only track if we have all required data and haven't tracked this transaction hash yet
        if (principal > 0 && address && drawTxHash && !trackedAdvancementTxHashes.current.has(drawTxHash)) {
          // Mark this transaction hash as tracked to prevent duplicate tracking
          trackedAdvancementTxHashes.current.add(drawTxHash);
          saveTrackedHashesToStorage('tracked_advancement_tx_hashes', trackedAdvancementTxHashes.current);
          
          // Record advancement in backend
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          fetch(`${API_BASE_URL}/api/admin/advancement-fee`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wallet: address.toLowerCase(),
              amount: ADVANCEMENT_FEE,
              principal: principal,
              txHash: drawTxHash,
            }),
          }).then(response => {
            if (response.ok) {
              console.log("Advancement tracked successfully in backend");
            } else {
              console.error("Failed to track advancement:", response.status);
              // Remove from tracked set if tracking failed so it can be retried
              trackedAdvancementTxHashes.current.delete(drawTxHash);
              saveTrackedHashesToStorage('tracked_advancement_tx_hashes', trackedAdvancementTxHashes.current);
            }
          }).catch(err => {
            console.error("Failed to track advancement:", err);
            // Remove from tracked set if tracking failed so it can be retried
            trackedAdvancementTxHashes.current.delete(drawTxHash);
            saveTrackedHashesToStorage('tracked_advancement_tx_hashes', trackedAdvancementTxHashes.current);
          });
        }
        
        // Add to history (only if not already added)
        if (expectedAdvancementAmount > 0 && drawTxHash && !historyAddedTxHashes.current.has(drawTxHash)) {
          historyAddedTxHashes.current.add(drawTxHash);
          saveTrackedHashesToStorage('history_added_tx_hashes', historyAddedTxHashes.current);
          setAdvancementHistory(prev => [{ amount: expectedAdvancementAmount, date: new Date(), type: 'advancement' }, ...prev]);
        }
        
        // Reset and close modal after showing success
        // Don't reset expectedAdvancementAmount immediately - keep it for a bit longer
        // to allow backup tracking mechanisms to work
        setTimeout(() => {
          setLoanAmount("");
          setTransactionStatus("idle");
          setTransactionError("");
          setShowLoanPage(false);
          setPreviousUsdcBalance(null);
          // Keep expectedAdvancementAmount for a bit longer to allow backup tracking
          setTimeout(() => {
            setExpectedAdvancementAmount(null);
          }, 5000); // Keep it for 5 seconds after success
          // Force refetch to ensure state is updated for next advance
          setTimeout(() => {
            refetchCreditLine();
            refetchUsdcBalance();
        }, 500);
        }, 2000);
      }
    }
  }, [usdcBalance, transactionStatus, expectedAdvancementAmount, previousUsdcBalance, refetchCreditLine, refetchUsdcBalance, address, drawTxHash]);

  // Track debt change for repayment success detection
  useEffect(() => {
    if (repayTransactionStatus === "processing" && previousDebt !== null && previousDebt > 0) {
      // Check if debt decreased (repayment succeeded)
      if (currentDebt < previousDebt) {
        console.log("Debt decreased, repayment successful!");
        setRepayTransactionStatus("success");
        refetchCreditLine();
        refetchUsdcBalance();
        
        // Track repayment in backend (only after balance changes, since that's when fee is paid)
        const ADVANCEMENT_FEE = 0.99;
        const amountToRepay = parseFloat(repayAmount);
        const principalRepaid = amountToRepay - ADVANCEMENT_FEE;
        
        // Only track if we have all required data and haven't tracked this transaction hash yet
        if (!isNaN(amountToRepay) && amountToRepay > 0 && address && principalRepaid >= 0 && repayTxHash && !trackedRepaymentTxHashes.current.has(repayTxHash)) {
          // Mark this transaction hash as tracked to prevent duplicate tracking
          trackedRepaymentTxHashes.current.add(repayTxHash);
          saveTrackedHashesToStorage('tracked_repayment_tx_hashes', trackedRepaymentTxHashes.current);
          
          // Record repayment in backend
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          fetch(`${API_BASE_URL}/api/admin/repayment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wallet: address.toLowerCase(),
              principal: principalRepaid,
              fee: ADVANCEMENT_FEE,
              txHash: repayTxHash,
            }),
          }).then(response => {
            if (response.ok) {
              console.log("Repayment tracked successfully in backend");
            } else {
              console.error("Failed to track repayment:", response.status);
              // Remove from tracked set if tracking failed so it can be retried
              trackedRepaymentTxHashes.current.delete(repayTxHash);
              saveTrackedHashesToStorage('tracked_repayment_tx_hashes', trackedRepaymentTxHashes.current);
            }
          }).catch(err => {
            console.error("Failed to track repayment:", err);
            // Remove from tracked set if tracking failed so it can be retried
            trackedRepaymentTxHashes.current.delete(repayTxHash);
            saveTrackedHashesToStorage('tracked_repayment_tx_hashes', trackedRepaymentTxHashes.current);
          });
          
          // Add to history (only if not already added)
          if (!historyAddedTxHashes.current.has(repayTxHash)) {
            historyAddedTxHashes.current.add(repayTxHash);
            saveTrackedHashesToStorage('history_added_tx_hashes', historyAddedTxHashes.current);
            setAdvancementHistory(prev => [{ amount: amountToRepay, date: new Date(), type: 'repayment' }, ...prev]);
          }
        }
        
        // Reset and close modal after showing success
        setTimeout(() => {
          setRepayAmount("");
          setAllowanceApproved(false);
          setShowRepayPage(false);
          setRepayTransactionStatus("idle");
          setPreviousDebt(null);
        }, 2000);
      }
    }
  }, [currentDebt, repayTransactionStatus, previousDebt, repayAmount, address, repayTxHash, refetchCreditLine, refetchUsdcBalance]);

  // Handle draw transaction errors
  useEffect(() => {
    if (drawTxError) {
      const errorMsg = (drawTxError as any)?.message || (drawTxError as any)?.shortMessage || String(drawTxError);
      if (errorMsg.includes("exceeds limit")) {
        setTransactionError(`Amount exceeds your approved credit limit of $${creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      } else if (errorMsg.includes("pool illiquid")) {
        setTransactionError(`Pool does not have enough liquidity. Available: $${freeLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      } else if (errorMsg.includes("one loan at a time") || errorMsg.includes("debt")) {
        setTransactionError("You already have an active loan. Please repay before requesting a new advance.");
      } else if (errorMsg.includes("no credit")) {
        setTransactionError("No credit line approved. Please wait for approval.");
      } else {
        setTransactionError(errorMsg || "Transaction failed. Please try again.");
      }
      setTransactionStatus("error");
      setPreviousUsdcBalance(null);
      setExpectedAdvancementAmount(null);
    }
  }, [drawTxError, creditLimit, freeLiquidity]);

  const handleMaxAmount = () => {
    // Set to the minimum of available advance and free liquidity
    // Fee doesn't count toward credit limit or liquidity check - it never leaves the vault
    const maxAmount = Math.min(availableAdvanceAmount, freeLiquidity);
    setLoanAmount(maxAmount.toFixed(2));
    setInputError("");
  };

  const handleRepayNow = () => {
    setShowRepayPage(true);
    const ADVANCEMENT_FEE = 0.99;
    const totalOwed = currentDebt + ADVANCEMENT_FEE;
    setRepayAmount(totalOwed.toFixed(2)); // Pre-fill with total owed (principal + fee)
    setRepayTransactionStatus("idle");
    setAllowanceApproved(false);
  };

  const handleRepayMax = () => {
    const ADVANCEMENT_FEE = 0.99;
    const totalOwed = currentDebt + ADVANCEMENT_FEE;
    setRepayAmount(totalOwed.toFixed(2));
  };

  // Check if allowance is sufficient for total amount (principal + fee)
  const ADVANCEMENT_FEE = 0.99;
  const totalOwed = currentDebt + ADVANCEMENT_FEE;
  const totalOwedWei = totalOwed > 0 ? parseUnits(totalOwed.toFixed(6), 6) : BigInt(0);
  const repayAmountWei = repayAmount ? parseUnits(repayAmount, 6) : BigInt(0);
  // Allowance must cover the total owed (principal + fee), not just the input amount
  const hasEnoughAllowance = usdcAllowance && totalOwedWei > 0 ? usdcAllowance >= totalOwedWei : false;

  const handleApproveAllowance = () => {
    if (!address || !isConnected) return;
    
    // Approve the total amount needed (principal + fee)
    const ADVANCEMENT_FEE = 0.99;
    const totalOwed = currentDebt + ADVANCEMENT_FEE;
    const amount = parseUnits(totalOwed.toFixed(6), 6);
    
    writeApproveContract({
      address: USDC_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [POOL_CONTRACT_ADDRESS, amount],
      chainId: baseSepolia.id,
    });
  };

  // Handle approve success
  useEffect(() => {
    if (isApproveConfirmed) {
      setAllowanceApproved(true);
    }
  }, [isApproveConfirmed]);

  const handleRepay = () => {
    if (!repayAmount || parseFloat(repayAmount) <= 0) return;
    if (!address || !isConnected) {
      setRepayTransactionStatus("error");
      return;
    }
    
    const ADVANCEMENT_FEE = 0.99;
    const amountToRepay = parseFloat(repayAmount);
    const totalOwed = currentDebt + ADVANCEMENT_FEE;
    
    // Validate repayment amount matches total owed (principal + fee)
    if (Math.abs(amountToRepay - totalOwed) > 0.01) {
      setRepayTransactionStatus("error");
      return;
    }
    
    // Check if allowance is sufficient for total amount (principal + fee)
    const totalWei = parseUnits(totalOwed.toFixed(6), 6);
    if (usdcAllowance && typeof usdcAllowance === 'bigint') {
      if (usdcAllowance < totalWei) {
        setRepayTransactionStatus("error");
        return;
      }
    } else {
      setRepayTransactionStatus("error");
      return;
    }
    
    // Capture current debt before transaction to detect when it changes
    setPreviousDebt(currentDebt);
    setRepayTransactionStatus("processing");
    
    try {
      // Convert amounts to wei (USDC has 6 decimals)
      const debtWei = parseUnits(currentDebt.toFixed(6), 6);
      const feeWei = parseUnits(ADVANCEMENT_FEE.toFixed(6), 6);

      // First, repay the principal debt to the contract
      // The contract requires exact repayment of L.debt
      writeRepayContract({
        address: POOL_CONTRACT_ADDRESS,
        abi: POOL_ABI,
        functionName: "repay",
        args: [debtWei],
        chainId: baseSepolia.id,
      });
      
      // After repay succeeds, we'll transfer the fee separately
      // This will be handled in the useEffect when repay is confirmed
    } catch (error: any) {
      console.error("Error calling repay:", error);
      setRepayTransactionStatus("error");
      setPreviousDebt(null);
    }
  };

  // Handle repay transaction success - transfer fee separately
  useEffect(() => {
    if (isRepayConfirmed && repayTxHash && address && repayAmount && !isFeeTransferPending && !feeTransferTxHash && !isFeeTransferConfirmed) {
      const ADVANCEMENT_FEE = 0.99;
      const feeWei = parseUnits(ADVANCEMENT_FEE.toFixed(6), 6);
      
      console.log("Repaying principal confirmed, now transferring fee:", ADVANCEMENT_FEE);
      setRepayTransactionStatus("processing"); // Update status to show we're transferring fee
      // Transfer the fee to the pool
      writeFeeTransferContract({
        address: USDC_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [POOL_CONTRACT_ADDRESS, feeWei],
        chainId: baseSepolia.id,
      });
    }
  }, [isRepayConfirmed, repayTxHash, address, repayAmount, writeFeeTransferContract, isFeeTransferPending, feeTransferTxHash, isFeeTransferConfirmed]);

  // Handle repay transaction - transfer fee after principal repayment
  useEffect(() => {
    if (isRepayConfirmed && repayTxHash && address && repayAmount && !isFeeTransferPending && !feeTransferTxHash && !isFeeTransferConfirmed) {
      const ADVANCEMENT_FEE = 0.99;
      const feeWei = parseUnits(ADVANCEMENT_FEE.toFixed(6), 6);
      
      console.log("Repaying principal confirmed, now transferring fee:", ADVANCEMENT_FEE);
      // Transfer the fee to the pool
      writeFeeTransferContract({
        address: USDC_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [POOL_CONTRACT_ADDRESS, feeWei],
        chainId: baseSepolia.id,
      });
    }
  }, [isRepayConfirmed, repayTxHash, address, repayAmount, writeFeeTransferContract, isFeeTransferPending, feeTransferTxHash, isFeeTransferConfirmed]);

  // Handle repay transaction errors
  useEffect(() => {
    if (repayTxError) {
      const errorMsg = (repayTxError as any)?.message || (repayTxError as any)?.shortMessage || String(repayTxError);
      console.error("Repay transaction error:", errorMsg);
      setRepayTransactionStatus("error");
      setPreviousDebt(null);
    }
  }, [repayTxError]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setUploadError("Please upload a PDF or PNG/JPEG image file");
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File size must be less than 10MB");
        return;
      }
      
      setSelectedFile(file);
      setUploadError("");
    }
  };

  const handleUploadPaystub = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file to upload");
      return;
    }

    // No wallet required - user is identified by email

    setUploadStatus("uploading");
    setUploadError("");

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      // Send both email and wallet (if connected) to ensure proper user linking
      const userEmail = localStorage.getItem("user_email") || "";
      if (!userEmail) {
        setUploadError("Please log in first");
        setUploadStatus("error");
        return;
      }
      formData.append("email", userEmail);
      
      // Include wallet address if connected (required by button, but double-check)
      if (address && isConnected) {
        formData.append("wallet", address.toLowerCase());
        console.log("Including wallet address in upload:", address);
      }

      console.log("Sending upload request to:", `${API_BASE_URL}/api/uploads/paystub`);
      
      const response = await fetch(`${API_BASE_URL}/api/uploads/paystub`, {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", response.status, response.statusText);
      console.log("Response ok:", response.ok);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      // Read response body once
      const responseText = await response.text();
      console.log("Response text:", responseText);

      if (!response.ok) {
        console.error("Server error response:", responseText);
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText || response.statusText };
        }
        setUploadError(errorData.error || `Server error: ${response.status} ${response.statusText}`);
        setUploadStatus("error");
        return;
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("Parsed response data:", data);
      } catch (e) {
        console.error("Failed to parse JSON response:", responseText);
        setUploadError(`Server returned invalid response: ${responseText}`);
        setUploadStatus("error");
        return;
      }

      if (data.ok) {
        console.log("Application submitted successfully!");
        setUploadStatus("success");
        setHasPendingApplication(true);
        // Store in localStorage to persist across page refreshes
        localStorage.setItem("has_pending_application", "true");
        // Reset file selection
        setSelectedFile(null);
        // Close modal automatically after 1.5 seconds to show success message
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadStatus("idle");
          setUploadError("");
        }, 1500);
      } else {
        console.error("Upload failed:", data);
        setUploadError(data.error || "Failed to upload paystub. Please try again.");
        setUploadStatus("error");
      }
    } catch (error: any) {
      console.error("Network error uploading paystub:", error);
      console.error("Error details:", {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      });
      
      // Check if it's a network/CORS error
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        setUploadError(`Cannot connect to server. Make sure the backend is running at ${API_BASE_URL}`);
      } else {
        setUploadError(error?.message || "Failed to upload paystub. Please try again.");
      }
      setUploadStatus("error");
    }
  };

  return (
    <ProtectedRoute>
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
              U1
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
              <div className="font-semibold text-lg">
                  {userEmail ? (userEmail.charAt(0).toUpperCase() + userEmail.slice(1)) : "User"}
                </div>
                {hasPendingApplication && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
                    Application in Review
                  </span>
                )}
              </div>
              {bankAccount && (
                <div className="text-sm text-gray-500">{bankAccount}</div>
              )}
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-3xl font-bold mb-1">${currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <a href="#" className="text-sm text-venmo-blue hover:underline">
              Advanced balance
            </a>
          </div>

          {/* Income Information */}
          {incomeData && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Pay Period</div>
              <div className="text-sm font-medium text-gray-900 mb-2">{incomeData.payPeriod || "Current Period"}</div>
              <div className="text-xs text-gray-600 mb-1">Income</div>
              <div className="text-lg font-semibold text-gray-900">
                ${incomeData.income?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                {incomeData.payFrequency && (
                  <span className="text-xs text-gray-500 ml-1">
                    / {incomeData.payFrequency === "biweekly" ? "biweekly" : incomeData.payFrequency === "monthly" ? "month" : "week"}
                  </span>
                )}
              </div>
            </div>
          )}

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
          
          {/* Upload Paystub Button */}
          <button 
            onClick={() => setShowUploadModal(true)}
            disabled={!isConnected || !address}
            className={`w-full border-2 font-semibold py-3 px-4 rounded-2xl transition-colors mb-4 ${
              !isConnected || !address
                ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                : 'bg-transparent border-venmo-blue text-venmo-blue hover:bg-venmo-blue hover:text-white'
            }`}
            style={{ borderRadius: '16px' }}
            title={!isConnected || !address ? 'Please connect your wallet first' : ''}
          >
            {status === "Approved" ? "Reapply" : "Apply Now"}
          </button>

          {currentDebt > 0 && (
            <button 
              onClick={handleRepayNow}
              className="w-full bg-transparent border-2 border-venmo-blue text-venmo-blue font-semibold py-3 px-4 rounded-2xl hover:bg-venmo-blue hover:text-white transition-colors" 
              style={{ borderRadius: '16px' }}
            >
              Repay Now
            </button>
          )}
        </div>

        {/* Logout Button */}
        <div className="mt-auto p-6">
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full bg-transparent border-2 border-red-600 text-red-600 font-semibold py-3 px-4 rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" 
            style={{ borderRadius: '16px' }}
          >
            {isLoggingOut && (
              <svg 
                className="animate-spin h-5 w-5 text-red-600" 
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

      {/* Right Main Content Area */}
      <div className="flex-1 bg-white overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto p-8">
          {!showLoanPage ? (
            <>
              {/* Credit Offer Dashboard */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900">Make an Advancement</h2>
                      <button
                        onClick={() => {
                    refetchCreditLine();
                    refetchFreeLiquidity();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-venmo-blue text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                  style={{ borderRadius: '8px' }}
                  title="Refresh credit information"
                >
                  <svg 
                    className="w-5 h-5" 
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
                  <span>Refresh</span>
                      </button>
              </div>

              {/* Status Badge */}
              <div className="mb-6">
                {status === "Approved" ? (
                  <span className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800 font-semibold">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center px-4 py-2 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Pending Review
                  </span>
                )}
              </div>

              {/* Credit Offer Card */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 mb-6">
                <div className="space-y-6">
                  {/* Approved Advance Amount and Remaining Balance */}
                  <div className="grid grid-cols-2 gap-6">
                  {/* Approved Advance Amount */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      Approved Advance Amount
                    </label>
                    <div className="text-4xl font-bold text-gray-900">
                        ${creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    
                    {/* Remaining Balance Available to Advance */}
                    <div>
                      <label className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        Remaining Balance Available to Advance
                      </label>
                      <div className="text-4xl font-bold text-gray-900">
                        ${availableAdvanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Payback Date */}
                  <div className="border-t border-gray-200 pt-6">
                    <label className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                      Payback Date
                    </label>
                    <div className="text-2xl font-semibold text-gray-900">
                      {formatDate(paybackDate)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {Math.ceil((paybackDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days from now
                    </div>
                  </div>

                  {/* Action Button */}
                  {status === "Approved" && (
                    <div className="border-t border-gray-200 pt-6">
                      <button 
                        onClick={handleAdvanceNow}
                        disabled={availableAdvanceAmount === 0}
                        className={`w-full font-semibold py-3 px-6 rounded-2xl transition-colors ${
                          availableAdvanceAmount === 0
                            ? 'bg-transparent border-2 border-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-venmo-blue text-white hover:bg-blue-600'
                        }`}
                        style={{ borderRadius: '16px' }}
                      >
                        Advance Now
                      </button>
                      {availableAdvanceAmount === 0 && (
                        <p className="text-sm text-gray-600 text-center mt-4">
                          Please repay your outstanding balance to make a new advancement.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Horizontal Divider */}
              {advancementHistory.length > 0 && (
                <div className="border-t border-gray-200 my-6"></div>
              )}

              {/* Advancement and Repayment History */}
              {advancementHistory.filter(item => !isNaN(item.amount) && item.amount > 0).length > 0 && (
                <div className="space-y-4">
                  {advancementHistory
                    .filter(item => !isNaN(item.amount) && item.amount > 0)
                    .map((item, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-gray-900">
                            ${item.amount.toLocaleString('en-US', { 
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                            <span>{item.type === 'advancement' ? 'Advanced amount' : 'Repayment amount'}</span>
                            {item.type === 'repayment' && (
                              <span className="text-xs text-gray-400">
                                (Principal: ${(item.amount - 0.99).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fee: $0.99)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {item.date.toLocaleDateString("en-US", { 
                              month: "short", 
                              day: "numeric", 
                              year: "numeric" 
                            })}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.date.toLocaleTimeString("en-US", { 
                              hour: "2-digit", 
                              minute: "2-digit",
                              hour12: true
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {isLoading ? (
                // Loading State with Shimmer Animation
                <div className="space-y-6">
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded-lg mb-6 w-48 shimmer"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-100 rounded-lg p-6 h-40 shimmer"></div>
                      <div className="bg-gray-100 rounded-lg p-6 h-40 shimmer"></div>
                      <div className="bg-gray-100 rounded-lg p-6 h-32 shimmer"></div>
                      <div className="bg-gray-100 rounded-lg p-6 h-32 shimmer"></div>
                    </div>
                  </div>
                </div>
              ) : (
                // Advancement Page with Bento Box Layout
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Advancement</h2>
                    <p className="text-sm text-gray-500">Enter the amount you'd like to advance</p>
                  </div>

                  {/* Bento Box Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Loan Amount Input Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                      <label className="text-sm font-medium text-gray-700 mb-3 block">
                        Loan Amount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={loanAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              setLoanAmount(value);
                              setInputError("");
                            } else {
                              const numValue = parseFloat(value);
                              // Fee doesn't count toward credit limit or liquidity - it never leaves the vault
                              const maxAmount = Math.min(availableAdvanceAmount, freeLiquidity);
                              
                              if (numValue >= 0 && numValue <= maxAmount) {
                                setLoanAmount(value);
                                setInputError("");
                              } else if (numValue > maxAmount) {
                                setLoanAmount(value);
                                if (numValue > availableAdvanceAmount) {
                                  setInputError(`Amount exceeds available limit of $${availableAdvanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                } else if (numValue > freeLiquidity) {
                                  setInputError(`Amount exceeds pool liquidity of $${freeLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Maximum: $${maxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                }
                              }
                              // If negative, don't update (prevents negative values)
                            }
                          }}
                          onBlur={() => {
                            // When user leaves the field, if error exists, reset to max
                            if (inputError && loanAmount) {
                              const numValue = parseFloat(loanAmount);
                              // Fee doesn't count - it never leaves the vault
                              const maxAmount = Math.min(availableAdvanceAmount, freeLiquidity);
                              if (numValue > maxAmount) {
                                setLoanAmount(maxAmount.toFixed(2));
                                setInputError("");
                              }
                            }
                          }}
                          placeholder={`Max: $${Math.min(availableAdvanceAmount, freeLiquidity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          min="0"
                          max={Math.min(availableAdvanceAmount, freeLiquidity)}
                          className={`w-full px-4 py-3 text-2xl font-bold bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                            inputError 
                              ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 focus:ring-venmo-blue focus:border-transparent'
                          }`}
                        />
                        <button
                          onClick={handleMaxAmount}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm text-venmo-blue hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Max
                        </button>
                      </div>
                      {inputError ? (
                        <div className="mt-2 text-xs text-red-600 font-medium">
                          {inputError}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-gray-500">
                          Advancement fee: $0.99
                        </div>
                      )}
                    </div>

                    {/* Amount Available to Advance Card */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <label className="text-sm font-medium text-gray-700 mb-3 block">
                        Amount available to advance
                      </label>
                      <div className="text-3xl font-bold text-gray-900">
                        ${availableAdvanceAmount.toLocaleString()}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Your current limit
                      </div>
                    </div>

                    {/* Get Funds Button Card */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 col-span-1 md:col-span-2 space-y-4">
                      <button
                        onClick={handleGetFunds}
                        disabled={!loanAmount || parseFloat(loanAmount) <= 0 || transactionStatus === "processing" || transactionStatus === "success" || !!inputError || isDrawPending || isDrawConfirming}
                        className="w-full bg-venmo-blue text-white font-semibold py-4 px-6 rounded-2xl hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        style={{ borderRadius: '16px', minHeight: '52px' }}
                      >
                        {(transactionStatus === "processing" || isDrawPending || isDrawConfirming) ? "Processing..." : transactionStatus === "success" ? "Funds Received" : "Get Funds"}
                      </button>
                      <button
                        onClick={() => setShowLoanPage(false)}
                        className="w-full bg-transparent border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                        style={{ borderRadius: '16px' }}
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Transaction Status Card */}
                    {(transactionStatus !== "idle" || isDrawPending || isDrawConfirming) && (
                      <div className={`${
                        (transactionStatus === "success" || isDrawConfirmed) && !isDrawPending && !isDrawConfirming
                          ? "bg-green-50 border-green-200" 
                          : transactionStatus === "error"
                          ? "bg-red-50 border-red-200"
                          : "bg-yellow-50 border-yellow-200"
                      } border rounded-lg p-6 col-span-1 md:col-span-2`}>
                        <div className="flex items-center gap-3">
                          {((transactionStatus === "processing" || isDrawPending || isDrawConfirming) && !isDrawConfirmed) && (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-venmo-blue"></div>
                              <div>
                                <div className="font-semibold text-gray-900">Processing Transaction</div>
                                <div className="text-sm text-gray-600">
                                  {isDrawPending ? "Waiting for wallet confirmation..." : isDrawConfirming ? "Processing advancement..." : "Please wait while we process your transaction..."}
                                </div>
                              </div>
                            </>
                          )}
                          {(transactionStatus === "success" || (isDrawConfirmed && !isDrawPending && !isDrawConfirming)) && (
                            <>
                              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <div className="font-semibold text-green-900">Transaction Successful</div>
                                <div className="text-sm text-green-700">Your USDC balance has been updated!</div>
                              </div>
                            </>
                          )}
                          {transactionStatus === "error" && !isDrawPending && !isDrawConfirming && (
                            <>
                              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <div className="font-semibold text-red-900">Transaction Failed</div>
                                <div className="text-sm text-red-700">{transactionError || "Please try again."}</div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Repay Modal Overlay */}
      {showRepayPage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: '8px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Repay Advance</h3>
              <button
                onClick={() => {
                  setShowRepayPage(false);
                  setRepayTransactionStatus("idle");
                  setRepayAmount("");
                  setAllowanceApproved(false);
                }}
                className="text-gray-400 hover:text-gray-600"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Amount Owed */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Amount Owed</div>
              <div className="text-2xl font-bold text-gray-900">
                ${(currentDebt + 0.99).toLocaleString('en-US', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Principal: ${currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fee: $0.99
              </div>
            </div>

            {/* Repayment Amount Input */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Repayment Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setRepayAmount(value);
                    } else {
                      const numValue = parseFloat(value);
                      const ADVANCEMENT_FEE = 0.99;
                      const maxOwed = currentDebt + ADVANCEMENT_FEE;
                      if (numValue >= 0 && numValue <= maxOwed) {
                        setRepayAmount(value);
                      } else if (numValue > maxOwed) {
                        setRepayAmount(maxOwed.toFixed(2));
                      }
                    }
                  }}
                  placeholder={`Total owed: $${(currentDebt + 0.99).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  min="0"
                  max={currentDebt + 0.99}
                  className="w-full px-4 py-3 text-xl font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-venmo-blue focus:border-transparent pr-16"
                />
                <button
                  onClick={handleRepayMax}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm text-venmo-blue hover:bg-blue-50 rounded-lg transition-colors font-semibold"
                >
                  Max
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Total owed: ${(currentDebt + 0.99).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Principal: ${currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fee: $0.99)
              </div>
            </div>

            {/* Approve USDC if needed */}
            {!hasEnoughAllowance && currentDebt > 0 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm text-yellow-800 mb-2">
                  You need to approve USDC spending first (Total: ${(currentDebt + 0.99).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </div>
                <button
                  onClick={handleApproveAllowance}
                  disabled={isApprovePending || isApproveConfirming || !address || !isConnected || currentDebt <= 0}
                  className="w-full bg-yellow-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isApprovePending || isApproveConfirming ? "Approving..." : `Approve $${(currentDebt + 0.99).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </button>
              </div>
            )}

            {/* Transaction Status */}
            {(repayTransactionStatus !== "idle" || isRepayPending || isRepayConfirming || isFeeTransferPending || isFeeTransferConfirming) && (
              <div className={`mb-4 p-4 rounded-lg ${
                repayTransactionStatus === "success" 
                  ? "bg-green-50 border border-green-200" 
                  : repayTransactionStatus === "error"
                  ? "bg-red-50 border border-red-200"
                  : "bg-yellow-50 border border-yellow-200"
              }`}>
                <div className="flex items-center gap-3">
                  {((repayTransactionStatus === "processing" || isRepayPending || isRepayConfirming || isFeeTransferPending || isFeeTransferConfirming) && !(isRepayConfirmed && isFeeTransferConfirmed)) && (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-venmo-blue"></div>
                      <div className="text-sm text-gray-700">
                        {isRepayPending ? "Sending transaction..." : 
                         isRepayConfirming ? "Waiting for confirmation..." : 
                         isFeeTransferPending ? "Transferring fee..." :
                         isFeeTransferConfirming ? "Confirming fee transfer..." :
                         "Processing repayment..."}
                      </div>
                    </>
                  )}
                  {(repayTransactionStatus === "success" || (isRepayConfirmed && isFeeTransferConfirmed && !isRepayPending && !isRepayConfirming && !isFeeTransferPending && !isFeeTransferConfirming)) && (
                    <>
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm text-green-700 font-medium">Repayment successful!</div>
                    </>
                  )}
                  {repayTransactionStatus === "error" && !isRepayPending && !isRepayConfirming && !isFeeTransferPending && !isFeeTransferConfirming && (
                    <>
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm text-red-700">
                        {repayTxError ? ((repayTxError as any)?.shortMessage || (repayTxError as any)?.message || "Repayment failed. Please try again.") : "Repayment failed. Please try again."}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRepayPage(false);
                  setRepayTransactionStatus("idle");
                  setRepayAmount("");
                  setAllowanceApproved(false);
                }}
                className="flex-1 bg-transparent border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                style={{ borderRadius: '16px' }}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleRepay}
                disabled={
                  !repayAmount || 
                  parseFloat(repayAmount) <= 0 || 
                  Math.abs(parseFloat(repayAmount) - (currentDebt + 0.99)) > 0.01 || 
                  repayTransactionStatus === "processing" || 
                  repayTransactionStatus === "success" ||
                  !hasEnoughAllowance ||
                  !address ||
                  !isConnected ||
                  currentDebt <= 0
                }
                className="flex-1 bg-venmo-blue text-white font-semibold py-3 px-6 rounded-2xl hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                style={{ borderRadius: '16px', minHeight: '52px' }}
                title={
                  !address || !isConnected ? "Please connect your wallet" :
                  currentDebt <= 0 ? "No outstanding balance to repay" :
                  !hasEnoughAllowance ? "Please approve USDC spending first" :
                  !repayAmount || parseFloat(repayAmount) <= 0 ? "Please enter repayment amount" :
                  Math.abs(parseFloat(repayAmount) - (currentDebt + 0.99)) > 0.01 ? `Amount must equal total owed: $${(currentDebt + 0.99).toFixed(2)}` :
                  ""
                }
              >
                {repayTransactionStatus === "processing" ? "Processing..." : repayTransactionStatus === "success" ? "Repaid" : "Repay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Paystub Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" style={{ borderRadius: '8px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Apply for Credit</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setUploadError("");
                  setUploadStatus("idle");
                }}
                className="text-gray-400 hover:text-gray-600"
                type="button"
                disabled={uploadStatus === "uploading"}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Upload Paystub (PDF or PNG)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-venmo-blue transition-colors relative">
                {selectedFile ? (
                  <>
                    {/* Cross icon at top-right */}
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        const input = document.getElementById("paystub-upload") as HTMLInputElement;
                        if (input) input.value = "";
                      }}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-sm font-medium text-gray-900 mb-1 text-center">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="file"
                      id="paystub-upload"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="paystub-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm text-gray-600 mb-1">
                        Click to browse or drag and drop
                      </span>
                      <span className="text-xs text-gray-500">
                        PDF, PNG, or JPEG (max 10MB)
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-700">{uploadError}</div>
              </div>
            )}

            {uploadStatus === "success" && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-green-700 font-medium">Application submitted successfully! Your application is now pending review.</div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setUploadError("");
                  setUploadStatus("idle");
                }}
                className="flex-1 bg-transparent border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
                style={{ borderRadius: '16px' }}
                type="button"
                disabled={uploadStatus === "uploading"}
              >
                {uploadStatus === "success" ? "Close" : "Cancel"}
              </button>
              <button
                onClick={handleUploadPaystub}
                disabled={!selectedFile || uploadStatus === "uploading" || uploadStatus === "success"}
                className="flex-1 bg-venmo-blue text-white font-semibold py-3 px-6 rounded-2xl hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                style={{ borderRadius: '16px', minHeight: '52px' }}
              >
                {uploadStatus === "uploading" ? "Submitting..." : uploadStatus === "success" ? "Applied" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
