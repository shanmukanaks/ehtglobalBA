"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { baseSepolia } from "wagmi/chains";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// API base URL - adjust if needed
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Contract addresses
const POOL_CONTRACT_ADDRESS = "0x6a8E895a2ED39F240f016216e9ED76FafCB0F805" as `0x${string}`;
const MUSDC_TOKEN_ADDRESS = "0x261084cb1E6ac1900719634A19E56BB9c18B809A" as `0x${string}`;

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const timeOptions = [
  { label: "1 minute", value: 1 / 60 },
  { label: "1 hour", value: 1 },
  { label: "3 hours", value: 3 },
  { label: "12 hours", value: 12 },
  { label: "24 hours", value: 24 },
  { label: "1 week", value: 168 },
  { label: "1 month", value: 720 },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  
  const [userEmail, setUserEmail] = useState<string>("");
  const [applications, setApplications] = useState<Array<{
    id: string;
    wallet: string;
    status: string;
    suggestedLimit?: number | null;
    approvedLimit?: number | null;
    dueDate?: Date | null;
    createdAt: Date;
    method: string;
    user?: {
      id: string;
      wallet: string;
    };
    documents?: Array<{
      id: string;
      path: string;
      status: string;
      createdAt: Date;
    }>;
  }>>([]);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState(24); // hours
  const [isLoading, setIsLoading] = useState(true);
  const [approvalModal, setApprovalModal] = useState<{
    open: boolean;
    wallet: string;
    applicationId?: string;
    suggestedLimit?: number;
  }>({ open: false, wallet: "" });
  const [approvalLimit, setApprovalLimit] = useState<string>("");
  const [approvalDueDate, setApprovalDueDate] = useState<string>("");
  const [approvalError, setApprovalError] = useState<string>("");
  const [isApproving, setIsApproving] = useState(false);
  
  // Edit limit modal state
  const [editLimitModal, setEditLimitModal] = useState<{
    open: boolean;
    wallet: string;
    applicationId?: string;
    currentLimit?: number;
  }>({ open: false, wallet: "" });
  const [editLimit, setEditLimit] = useState<string>("");
  const [editLimitError, setEditLimitError] = useState<string>("");
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [totalAdvancementFees, setTotalAdvancementFees] = useState<number>(0);
  const [advancementCount, setAdvancementCount] = useState<number>(0);
  const [uniqueUserCount, setUniqueUserCount] = useState<number>(0);
  const [poolBalance, setPoolBalance] = useState<number>(0);
  const [totalDebt, setTotalDebt] = useState<number>(0);
  const [transactionHistory, setTransactionHistory] = useState<Array<{
    type: "advancement" | "repayment" | "lp_deposit" | "lp_withdraw";
    wallet: string;
    principal?: number | null;
    fee?: number;
    amount?: number;
    totalAmount?: number | null;
    txHash: string;
    timestamp: string;
    createdAt: Date;
  }>>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Chart data - track historical pool balance and advanced amount
  const [chartData, setChartData] = useState<Array<{
    time: string;
    poolBalance: number;
    advancedAmount: number;
  }>>([]);

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
    document.title = "Paena - Admin";
  }, []);

  // Fetch pool balance from contract (same as LP dashboard)
  const { data: poolBalanceData } = useReadContract({
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

  // Update pool balance when data changes
  useEffect(() => {
    if (poolBalanceData) {
      const balance = parseFloat(formatUnits(poolBalanceData as bigint, 6));
      setPoolBalance(balance);
    }
  }, [poolBalanceData]);
  
  // Update chart data when both pool balance and total debt are available
  useEffect(() => {
    if (poolBalance > 0 || totalDebt > 0) {
      const now = new Date();
      const timeLabel = now.toLocaleTimeString("en-US", { 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: false
      });
      
      setChartData(prev => {
        // Check if we should update the last point (same minute) or add a new one
        const lastPoint = prev[prev.length - 1];
        const shouldUpdate = lastPoint && lastPoint.time === timeLabel;
        
        if (shouldUpdate && prev.length > 0) {
          // Update the last data point
          const updated = [...prev];
          updated[updated.length - 1] = {
            time: timeLabel,
            poolBalance: poolBalance,
            advancedAmount: totalDebt,
          };
          return updated;
        } else {
          // Add new data point
          const newData = [...prev, {
            time: timeLabel,
            poolBalance: poolBalance,
            advancedAmount: totalDebt,
          }];
          // Keep only last 20 data points to avoid clutter
          return newData.slice(-20);
        }
      });
    }
  }, [poolBalance, totalDebt]);

  // Fetch total debt from backend
  const fetchTotalDebt = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/total-debt`);
      if (response.ok) {
        const data = await response.json();
        const debt = parseFloat(formatUnits(BigInt(data.totalDebt || "0"), 6));
        setTotalDebt(debt);
        // Chart data will be updated by the useEffect that watches poolBalance and totalDebt
      }
    } catch (error) {
      console.error("Error fetching total debt:", error);
    }
  };


  // Fetch applications from backend
  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      console.log("Fetching applications from:", `${API_BASE_URL}/api/admin/applications`);
      const response = await fetch(`${API_BASE_URL}/api/admin/applications`);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Applications fetched:", data.applications?.length || 0, "applications");
        setApplications(data.applications || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch applications:", response.status, errorData);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on mount only - no automatic refresh
  // Using useRef to track if we've already done the initial fetch
  const hasFetchedRef = useRef(false);
  
  useEffect(() => {
    if (!hasFetchedRef.current) {
      fetchApplications();
      fetchAdvancementFees();
      fetchTotalDebt();
      fetchTransactionHistory();
      hasFetchedRef.current = true;
      
      // Set up auto-refresh after initial fetch
      const refreshInterval = setInterval(() => {
        fetchTotalDebt();
        fetchTransactionHistory();
        fetchAdvancementFees();
      }, 5000);
      
      return () => clearInterval(refreshInterval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    const email = localStorage.getItem("user_email") || "";
    setUserEmail(email);
  }, []);

  // Helper function to truncate email
  const truncateEmail = (email: string, maxLength: number = 25) => {
    if (email.length <= maxLength) return email;
    return email.substring(0, maxLength - 3) + "...";
  };

  // Calculate metrics based on selected time period
  const calculateMetrics = () => {
    const hoursAgo = selectedTimePeriod;
    const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    // Filter applications within time period
    const recentApps = applications.filter(app => new Date(app.createdAt) >= cutoffDate);
    
    // Pool balance comes from contract (same as LP dashboard)
    // Total advancement is the amount currently lent out (total debt)
    // Use actual fees from backend instead of calculating from applications
    const totalAdvancementFee = totalAdvancementFees;
    
    return { poolBalance, totalAdvancements: totalDebt, totalAdvancementFee, count: recentApps.length };
  };

  // Fetch advancement fees from backend
  const fetchAdvancementFees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/advancement-fees`);
      if (response.ok) {
        const data = await response.json();
        setTotalAdvancementFees(data.totalFees || 0);
        setAdvancementCount(data.advancementCount || 0);
        setUniqueUserCount(data.uniqueUserCount || 0);
      }
    } catch (error) {
      console.error("Error fetching advancement fees:", error);
    }
  };

  // Fetch transaction history from backend
  const fetchTransactionHistory = async () => {
    try {
      console.log("Fetching transaction history from:", `${API_BASE_URL}/api/admin/transaction-history`);
      const response = await fetch(`${API_BASE_URL}/api/admin/transaction-history`);
      if (response.ok) {
        const data = await response.json();
        console.log("Transaction history fetched:", data.transactions?.length || 0, "transactions");
        console.log("Transaction history data:", data.transactions);
        setTransactionHistory(data.transactions || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch transaction history:", response.status, errorData);
      }
    } catch (error) {
      console.error("Error fetching transaction history:", error);
    }
  };

  const metrics = calculateMetrics();
  const displayPoolBalance = metrics.poolBalance;
  const totalAdvancements = metrics.totalAdvancements;
  const totalAdvancementFee = metrics.totalAdvancementFee;

  const handleApproveClick = (wallet: string, applicationId: string, suggestedLimit?: number | null) => {
    setApprovalModal({ open: true, wallet, applicationId, suggestedLimit: suggestedLimit ? suggestedLimit / 1000000 : undefined });
    setApprovalLimit(suggestedLimit ? (suggestedLimit / 1000000).toString() : "");
    // Default due date to 30 days from now
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    setApprovalDueDate(defaultDueDate.toISOString().split('T')[0]);
    setApprovalError("");
  };

  const handleApproveSubmit = async () => {
    if (!approvalLimit || parseFloat(approvalLimit) <= 0) {
      setApprovalError("Please enter a valid credit limit");
      return;
    }

    if (!approvalDueDate) {
      setApprovalError("Please select a due date");
      return;
    }

    setIsApproving(true);
    setApprovalError("");

    try {
      // Convert limit to smallest units (6 decimals for USDC)
      const limitInSmallestUnits = Math.floor(parseFloat(approvalLimit) * 1000000);
      // Convert due date to unix timestamp (seconds)
      const dueDateUnix = Math.floor(new Date(approvalDueDate).getTime() / 1000);

      const response = await fetch(`${API_BASE_URL}/api/admin/applications/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: approvalModal.wallet,
          applicationId: approvalModal.applicationId,
          approvedLimit: limitInSmallestUnits,
          dueDate: dueDateUnix,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Close modal and refresh applications
        setApprovalModal({ open: false, wallet: "", applicationId: undefined });
        setApprovalLimit("");
        setApprovalDueDate("");
        // Refetch applications
        const refreshResponse = await fetch(`${API_BASE_URL}/api/admin/applications`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setApplications(refreshData.applications || []);
        }
      } else {
        setApprovalError(data.error || "Failed to approve application");
      }
    } catch (error: any) {
      setApprovalError(error?.message || "Failed to approve application");
    } finally {
      setIsApproving(false);
    }
  };

  const handleEditLimitClick = (wallet: string, applicationId: string, currentLimit?: number | null) => {
    setEditLimitModal({ open: true, wallet, applicationId, currentLimit: currentLimit ? currentLimit / 1000000 : undefined });
    setEditLimit(currentLimit ? (currentLimit / 1000000).toString() : "");
    setEditLimitError("");
  };

  const handleEditLimitSubmit = async () => {
    if (!editLimit || parseFloat(editLimit) <= 0) {
      setEditLimitError("Please enter a valid credit limit");
      return;
    }

    setIsEditingLimit(true);
    setEditLimitError("");

    try {
      // Convert limit to smallest units (6 decimals for USDC)
      const limitInSmallestUnits = Math.floor(parseFloat(editLimit) * 1000000);
      // Get current due date from the application or default to 30 days from now
      const application = applications.find(app => app.id === editLimitModal.applicationId);
      let dueDateUnix;
      if (application?.dueDate) {
        dueDateUnix = Math.floor(new Date(application.dueDate).getTime() / 1000);
      } else {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30);
        dueDateUnix = Math.floor(defaultDueDate.getTime() / 1000);
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/applications/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: editLimitModal.wallet,
          applicationId: editLimitModal.applicationId,
          approvedLimit: limitInSmallestUnits,
          dueDate: dueDateUnix,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Close modal and refresh applications
        setEditLimitModal({ open: false, wallet: "", applicationId: undefined });
        setEditLimit("");
        // Refetch applications to show updated limit
        const refreshResponse = await fetch(`${API_BASE_URL}/api/admin/applications`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setApplications(refreshData.applications || []);
        }
      } else {
        setEditLimitError(data.error || "Failed to update credit limit");
      }
    } catch (error: any) {
      setEditLimitError(error?.message || "Failed to update credit limit");
    } finally {
      setIsEditingLimit(false);
    }
  };

  const handleDelete = async (applicationId: string) => {
    if (!confirm("Are you sure you want to delete this application? The user will need to upload a paystub again to apply.")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log("Application deleted successfully:", data);
        // Refresh applications list
        fetchApplications();
        alert("Application deleted successfully. The user's credit limit has been reset to 0.");
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to delete application:", errorData);
        alert(errorData.error || "Failed to delete application");
      }
    } catch (error: any) {
      console.error("Error deleting application:", error);
      alert("Failed to delete application. Please try again.");
    }
  };

  const handleReject = async (applicationId: string) => {
    if (!confirm("Are you sure you want to reject this application? The user's credit limit will be reset to 0.")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Application rejected successfully:", data);
        // Refetch applications to get updated status
        const refreshResponse = await fetch(`${API_BASE_URL}/api/admin/applications`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setApplications(refreshData.applications || []);
        }
        alert("Application rejected successfully. The user's credit limit has been reset to 0.");
      } else {
        console.error("Failed to reject application:", data);
        alert(data.error || "Failed to reject application");
      }
    } catch (error: any) {
      console.error("Error rejecting application:", error);
      alert("Failed to reject application. Please try again.");
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
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
              A
            </div>
            <div>
              <div className="font-semibold text-lg">
                {userEmail ? truncateEmail(userEmail) : "Admin"}
              </div>
              <div className="text-sm text-gray-500">Administrator</div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
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
        <div className="max-w-6xl mx-auto p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h2>
            <p className="text-sm text-gray-500">Manage user applications and view metrics</p>
          </div>

          {/* Metrics and Graph Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            {/* Time Period Selector and Refresh Button */}
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Time Period:</label>
              <div className="flex flex-wrap gap-2">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTimePeriod(option.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTimePeriod === option.value
                        ? "bg-venmo-blue text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    style={{ borderRadius: '8px' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              </div>
              <button
                onClick={() => {
                  fetchApplications();
                  fetchAdvancementFees();
                  fetchTotalDebt();
                  fetchTransactionHistory();
                }}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-venmo-blue text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                style={{ borderRadius: '8px' }}
                title="Refresh metrics"
              >
                <svg 
                  className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
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
                <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Pool Balance */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Pool Balance
                </label>
                <div className="text-3xl font-bold text-gray-900">
                  ${displayPoolBalance.toLocaleString('en-US', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Current pool balance (mUSDC)
                </div>
              </div>

              {/* Total Advancement */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Total Advancement
                </label>
                <div className="text-3xl font-bold text-gray-900">
                  ${totalAdvancements.toLocaleString('en-US', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Currently lent out
                </div>
              </div>

              {/* Total Advancement Fee */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Total Advancement Fee
                </label>
                <div className="text-3xl font-bold text-gray-900">
                  ${totalAdvancementFee.toLocaleString('en-US', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {advancementCount} {advancementCount === 1 ? 'advancement' : 'advancements'} from {uniqueUserCount} {uniqueUserCount === 1 ? 'user' : 'users'}
                </div>
              </div>
            </div>

            {/* Chart Visualization */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 h-64">
              <h4 className="text-sm font-medium text-gray-700 mb-4">Pool Balance vs Advanced Amount</h4>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="poolBalance" 
                      name="Pool Balance" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="advancedAmount" 
                      name="Advanced Amount" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-2">📊</div>
                    <div className="text-gray-500 text-sm">Collecting data...</div>
                    <div className="text-gray-400 text-xs mt-1">Chart will appear as data becomes available</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transaction History */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (confirm("Are you sure you want to clear all transaction history? This action cannot be undone.")) {
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/admin/transaction-history`, {
                          method: "DELETE",
                        });
                        if (response.ok) {
                          setTransactionHistory([]);
                        } else {
                          alert("Failed to clear transaction history");
                        }
                      } catch (error) {
                        console.error("Error clearing transaction history:", error);
                        alert("Failed to clear transaction history");
                      }
                    }
                  }}
                  disabled={isLoading || transactionHistory.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  style={{ borderRadius: '8px' }}
                  title="Clear transaction history"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                  <span>Clear</span>
                </button>
                <button
                  onClick={() => {
                    fetchTransactionHistory();
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-venmo-blue text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  style={{ borderRadius: '8px' }}
                  title="Refresh transaction history"
                >
                  <svg 
                    className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
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
                  <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
                </button>
              </div>
            </div>

            {transactionHistory.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <div className="text-gray-500">No transactions found</div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                  {transactionHistory.map((tx, index) => {
                    const txDate = new Date(tx.timestamp || tx.createdAt);
                    const truncatedWallet = `${tx.wallet.slice(0, 6)}...${tx.wallet.slice(-4)}`;
                    
                    // Determine transaction type display
                    let typeLabel = '';
                    let typeColor = '';
                    let displayAmount = '';
                    
                    if (tx.type === 'advancement') {
                      typeLabel = 'Advancement';
                      typeColor = 'bg-blue-100 text-blue-800';
                      // Show only principal amount for advancements (fee is paid on repayment)
                      if (tx.principal !== null && tx.principal !== undefined) {
                        displayAmount = `$${tx.principal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      } else {
                        displayAmount = 'N/A';
                      }
                    } else if (tx.type === 'repayment') {
                      typeLabel = 'Repayment';
                      typeColor = 'bg-green-100 text-green-800';
                      displayAmount = tx.totalAmount 
                        ? `$${tx.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'N/A';
                    } else if (tx.type === 'lp_deposit') {
                      typeLabel = 'LP Deposit';
                      typeColor = 'bg-purple-100 text-purple-800';
                      displayAmount = tx.amount 
                        ? `$${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'N/A';
                    } else if (tx.type === 'lp_withdraw') {
                      typeLabel = 'LP Withdraw';
                      typeColor = 'bg-orange-100 text-orange-800';
                      displayAmount = tx.amount 
                        ? `$${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'N/A';
                    }
                    
                    return (
                      <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeColor}`}>
                                {typeLabel}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {displayAmount}
                              </span>
                              {tx.type === 'repayment' && tx.principal !== null && tx.principal !== undefined && tx.fee !== undefined && (
                                <span className="text-xs text-gray-500">
                                  (Principal: ${tx.principal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Fee: ${tx.fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              Wallet: <span className="font-mono">{truncatedWallet}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {txDate.toLocaleDateString("en-US", { 
                                month: "short", 
                                day: "numeric", 
                                year: "numeric" 
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {txDate.toLocaleTimeString("en-US", { 
                                hour: "2-digit", 
                                minute: "2-digit",
                                hour12: true
                              })}
                            </div>
                            {tx.txHash && (
                              <a
                                href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-venmo-blue hover:underline mt-1 inline-block"
                              >
                                View TX
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Users List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">User Applications</h3>
                <button
                  onClick={() => {
                    fetchApplications();
                    fetchAdvancementFees();
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-venmo-blue text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  style={{ borderRadius: '8px' }}
                  title="Refresh applications"
                >
                <svg 
                  className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
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
                <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
            
            {isLoading ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-venmo-blue mx-auto mb-4"></div>
                <div className="text-gray-500">Loading applications...</div>
              </div>
            ) : applications.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <div className="text-gray-500">No applications found</div>
              </div>
            ) : (
              /* Applications Table */
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="divide-y divide-gray-200">
                  {applications.map((app) => {
                    const user = app.user || (app as any).user;
                    const userId = user?.id || "";
                    const wallet = user?.wallet || app.wallet;
                    const suggestedLimit = app.suggestedLimit ? app.suggestedLimit / 1000000 : null;
                    const approvedLimit = app.approvedLimit ? app.approvedLimit / 1000000 : null;
                    const documents = app.documents || [];
                    const latestDocument = documents.length > 0 ? documents[0] : null;
                    
                    // Extract filename from path (handles both filename-only and full paths)
                    const getFilename = (filePath: string) => {
                      if (!filePath) return "";
                      const parts = filePath.split(/[/\\]/);
                      return parts[parts.length - 1];
                    };
                    
                    return (
                      <div key={app.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-venmo-blue rounded-full flex items-center justify-center text-white font-semibold">
                                {wallet ? wallet.slice(2, 4).toUpperCase() : "?"}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <div className="font-semibold text-gray-900 font-mono text-sm">
                                    {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Unknown"}
                                  </div>
                                  {userId && (
                                    <span className="text-xs text-gray-400 font-mono">
                                      ID: {userId.slice(0, 8)}...
                                    </span>
                                  )}
                            </div>
                              <div className="text-sm text-gray-500">
                                  Applied: {formatDate(app.createdAt)}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="text-xs text-gray-400">
                                    Method: {app.method || "unknown"}
                                  </div>
                                  {latestDocument && latestDocument.path && (
                                    <a
                                      href={`${API_BASE_URL}/api/uploads/file/${encodeURIComponent(getFilename(latestDocument.path))}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-venmo-blue hover:underline flex items-center gap-1"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      View Paystub
                                    </a>
                                  )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                              <div className="text-sm text-gray-500">
                                {app.status === "approved" ? "Approved Limit" : suggestedLimit ? "Suggested Limit" : "Amount"}
                              </div>
                            <div className="font-semibold text-gray-900">
                                ${(approvedLimit || suggestedLimit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                              {app.status === "pending" ? (
                              <>
                                <button
                                    onClick={() => handleApproveClick(wallet, app.id, app.suggestedLimit || undefined)}
                                  className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                                  style={{ borderRadius: '8px' }}
                                >
                                  Approve
                                </button>
                                <button
                                    onClick={() => handleReject(app.id)}
                                  className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                                  style={{ borderRadius: '8px' }}
                                >
                                  Reject
                                </button>
                                  <button
                                    onClick={() => handleDelete(app.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Delete application"
                                    type="button"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              ) : app.status === "approved" ? (
                                <>
                                  <button
                                    onClick={() => handleEditLimitClick(wallet, app.id, app.approvedLimit || undefined)}
                                    className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                                    style={{ borderRadius: '8px' }}
                                  >
                                    Edit Limit
                                  </button>
                                  <span
                                    className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                                  >
                                    Approved
                                  </span>
                                  <button
                                    onClick={() => handleDelete(app.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Delete application"
                                    type="button"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                              </>
                            ) : (
                                <>
                              <span
                                    className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"
                                  >
                                    Rejected
                              </span>
                                  <button
                                    onClick={() => handleDelete(app.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Delete application"
                                    type="button"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Edit Limit Modal */}
          {editLimitModal.open && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Edit Credit Limit</h3>
                
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Wallet Address
                  </label>
                  <div className="text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded border">
                    {editLimitModal.wallet}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Credit Limit (USD)
                  </label>
                  <input
                    type="number"
                    value={editLimit}
                    onChange={(e) => setEditLimit(e.target.value)}
                    placeholder="5000.00"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-venmo-blue"
                  />
                  {editLimitModal.currentLimit && (
                    <div className="text-xs text-gray-500 mt-1">
                      Current: ${editLimitModal.currentLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {editLimitError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm text-red-700">{editLimitError}</div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditLimitModal({ open: false, wallet: "" });
                      setEditLimit("");
                      setEditLimitError("");
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditLimitSubmit}
                    disabled={isEditingLimit}
                    className="flex-1 bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isEditingLimit ? "Updating..." : "Update Limit"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Approval Modal */}
          {approvalModal.open && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Approve Application</h3>
                
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Wallet Address
                  </label>
                  <div className="text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded border">
                    {approvalModal.wallet}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Credit Limit (USD)
                  </label>
                  <input
                    type="number"
                    value={approvalLimit}
                    onChange={(e) => setApprovalLimit(e.target.value)}
                    placeholder="5000.00"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-venmo-blue"
                  />
                  {approvalModal.suggestedLimit && (
                    <div className="text-xs text-gray-500 mt-1">
                      Suggested: ${approvalModal.suggestedLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={approvalDueDate}
                    onChange={(e) => setApprovalDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-venmo-blue"
                  />
                </div>

                {approvalError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm text-red-700">{approvalError}</div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setApprovalModal({ open: false, wallet: "" });
                      setApprovalLimit("");
                      setApprovalDueDate("");
                      setApprovalError("");
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApproveSubmit}
                    disabled={isApproving}
                    className="flex-1 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isApproving ? "Approving..." : "Approve"}
                  </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

