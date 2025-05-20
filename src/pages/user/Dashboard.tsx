import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { Calendar, ChevronDown, CircleDollarSign, DollarSign, Eye, EyeOff, History, User } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { users, transactions } from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Layout } from "@/components/Layout";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  date_time: string;
  status: string;
  category?: string;
  recipient_details?: any;
}

export default function Dashboard() {
  const { currentUser, updateCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [spendingData, setSpendingData] = useState<Record<string, number>>({});
  const [selectedMonth, setSelectedMonth] = useState("4"); // Default to May (0-based index)
  const [selectedYear, setSelectedYear] = useState("2025"); // Default to 2025
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCredit = (type: string) => {
    const lower = type.toLowerCase();
    return lower.includes("deposit") || lower.includes("credit") || lower.includes("received");
  };

  const isDebit = (type: string) => {
    const lower = type.toLowerCase();
    return lower.includes("withdraw") || lower.includes("debit") || lower.includes("sent") || lower.includes("transfer");
  };

  // Group transactions by date
  const groupTransactionsByDate = (transactions: Transaction[]) => {
    const grouped: { [key: string]: Transaction[] } = {};
    transactions.forEach((tx) => {
      const date = formatDate(tx.date_time).split(" ")[0]; // Get date part (e.g., "05/19/2025")
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(tx);
    });
    // Sort dates in descending order (most recent first)
    return Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((date) => ({ date, transactions: grouped[date] }));
  };

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        if (!currentUser?.id) throw new Error("No user ID available");
        const userResponse = await users.getById(currentUser.id);
        setUserDetails(userResponse);
        updateCurrentUser({ ...currentUser, avatar: userResponse.avatar });

        const transactionsResponse = await transactions.getByUserId(currentUser.id);
        setRecentTransactions(transactionsResponse.slice(0, 5));

        // Filter transactions for selected month and year
        const selectedTransactions = transactionsResponse.filter((tx: Transaction) => {
          const txDate = new Date(tx.date_time);
          return (
            txDate.getMonth() === parseInt(selectedMonth) &&
            txDate.getFullYear() === parseInt(selectedYear)
          );
        });

        // Calculate spending per category from actual transactions
        const spending = selectedTransactions.reduce((acc: Record<string, number>, tx: Transaction) => {
          if (!isDebit(tx.type)) return acc; // Only include debit transactions
          
          const description = tx.description?.toLowerCase() || "";
          const categoryText = tx.category?.toLowerCase() || "";
          const typeText = tx.type?.toLowerCase() || "";
          let category: string;

          if (
            description.includes("bank") || categoryText.includes("bank") ||
            typeText.includes("bank") || description.includes("account")
          ) {
            category = "Bank Transfer";
          } else if (description.includes("p2p") || description.includes("peer")) {
            category = "P2P Transfer";
          } else if (description.includes("wire")) {
            category = "Wire Transfer";
          } else if (description.includes("cash") || tx.type.toLowerCase().includes("withdraw")) {
            category = "Cash";
          } else if (tx.type.toLowerCase().includes("deposit")) {
            category = "Deposit";
          } else {
            category = "Other";
          }
          
          const amount = Number(tx.amount) || 0; // Ensure positive amount for spending
          acc[category] = (acc[category] || 0) + amount;
          return acc;
        }, {});

        // Only include categories that have transactions
        setSpendingData(spending);

      } catch (error: any) {
        console.error("Error fetching user data:", error);
        toast.error(error.message || "Failed to load your account data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser?.id) {
      fetchUserData();
    }
  }, [currentUser?.id, selectedMonth, selectedYear]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("Avatar input changed");
    const file = event.target.files?.[0];
    if (file) {
      console.log("Selected file:", { name: file.name, size: file.size, type: file.type });
      if (!file.type.match("image/jpeg|image/png|image/jpg")) {
        console.error("Invalid file type:", file.type);
        toast.error("Please select a valid image file (JPEG, JPG, or PNG)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        console.error("File too large:", file.size);
        toast.error("Image size should be less than 10MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log("Avatar preview generated:", result.substring(0, 50) + "...");
        setAvatarPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !currentUser?.id) {
      console.error("Missing avatarFile or user ID", { avatarFile, userId: currentUser?.id });
      return;
    }
    try {
      console.log("Uploading avatar for user:", currentUser.id);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        console.log("Base64 string length:", base64.length);
        const response = await users.updateAvatar(currentUser.id, { avatar: base64 });
        console.log("Avatar update response:", response);
        if (response.avatar) {
          setUserDetails({ ...userDetails, avatar: response.avatar });
          updateCurrentUser({ ...currentUser, avatar: response.avatar });
          setAvatarFile(null);
          setAvatarPreview(null);
          toast.success("Avatar updated successfully");
        } else {
          console.error("No avatar in response:", response);
          toast.error("Failed to update avatar: Invalid response");
        }
      };
      reader.readAsDataURL(avatarFile);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar. Please try again.");
    }
  };

  const removeAvatar = async () => {
    if (!currentUser?.id) return;
    try {
      console.log("Removing avatar for user:", currentUser.id);
      await users.deleteAvatar(currentUser.id);
      setAvatarPreview(null);
      setAvatarFile(null);
      setUserDetails({ ...userDetails, avatar: undefined });
      updateCurrentUser({ ...currentUser, avatar: undefined });
      toast.success("Avatar removed successfully");
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error("Failed to remove avatar. Please try again.");
    }
  };

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance);
  };

  const triggerFileInput = () => {
    console.log("Change Avatar button clicked");
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input ref is not assigned");
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <Navbar />
        <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 w-48 bg-muted rounded mx-auto mb-4"></div>
            <div className="h-4 w-24 bg-muted rounded mx-auto"></div>
          </div>
        </div>
        <Footer />
      </Layout>
    );
  }

  // Define categories with distinct colors
  const categoryColors: Record<string, string> = {
    "P2P Transfer": "#60A5FA", // Blue
    "Bank Transfer": "#8B5CF6", // Purple
    "Wire Transfer": "#EC4899", // Pink
    "Deposit": "#22C55E", // Green
    "Withdraw": "#EF4444", // Red
    "Cash": "#6B7280", // Gray
    "Other": "#F59E0B", // Amber
  };

  // Ensure all categories are displayed, even with $0.00
  const allCategories = Object.keys(categoryColors);
  const categories = allCategories.map((category) => ({
    name: category,
    amount: spendingData[category] || 0,
    color: categoryColors[category],
  }));

  const totalSpending = Object.values(spendingData).reduce((sum, value) => sum + value, 0);
  const highestCategory = categories.reduce(
    (max, category) => (category.amount > max.amount ? category : max),
    categories[0] || { name: "None", amount: 0, color: "#6B7280" }
  );
  const highestPercentage = totalSpending > 0 ? Math.round((highestCategory.amount / totalSpending) * 100) : 0;

  const chartData = {
    labels: categories.map((c) => c.name),
    datasets: [
      {
        data: categories.map((c) => c.amount),
        backgroundColor: categories.map((c) => c.color),
        borderColor: categories.map((c) => c.color),
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: {
        display: false, // Hide default legend, use custom grid below
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.label}: ${formatCurrency(context.raw)}`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  // Month names for the dropdown
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Years for the dropdown (last 5 years up to 2025)
  const years = Array.from({ length: 5 }, (_, i) => (2025 - i).toString());

  return (
    <Layout>
      <Navbar />
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Welcome, {currentUser?.fullName || currentUser?.username}!</h1>
            <p className="text-muted-foreground">Here's your financial summary and recent activities.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Profile Card */}
            <Card className="bg-[#1F2937] text-white hover:scale-105 transition-transform duration-300">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-6 w-6 mr-2 text-bank-gold" />
                  Your Profile
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Manage your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24 border-2 border-bank-gold rounded-full">
                  <AvatarImage src={avatarPreview || userDetails?.avatar || ""} />
                  <AvatarFallback className="bg-bank-gold text-bank-dark-text text-2xl">
                    {currentUser?.fullName 
                      ? currentUser.fullName.substring(0, 2).toUpperCase() 
                      : currentUser?.username?.substring(0, 2).toUpperCase() || "NU"
                    }
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2 w-full">
                  <input
                    ref={fileInputRef}
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleAvatarChange}
                    className="sr-only"
                    onClick={() => console.log("Avatar input clicked")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={triggerFileInput}
                    className="w-full bg-transparent border-bank-gold text-bank-gold hover:bg-bank-gold hover:text-bank-dark-text"
                  >
                    Change Profile Picture
                  </Button>
                  {avatarFile && (
                    <div className="flex gap-2">
                      <Button 
                        onClick={uploadAvatar} 
                        variant="default" 
                        className="flex-1 bg-bank-gold hover:bg-bank-gold/90 text-bank-dark-text"
                      >
                        Save
                      </Button>
                      <Button 
                        onClick={() => {
                          setAvatarFile(null);
                          setAvatarPreview(null);
                        }} 
                        variant="destructive" 
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {(userDetails?.avatar || avatarPreview) && !avatarFile && (
                    <Button 
                      onClick={removeAvatar} 
                      variant="destructive" 
                      className="w-full"
                    >
                      Remove Profile Picture
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* Balance Card */}
            <Card className="bg-[#1F2937] text-white hover:scale-105 transition-transform duration-300">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <CircleDollarSign className="h-6 w-6 mr-2 text-bank-gold" />
                    Current Balance
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={toggleBalanceVisibility}
                    className="text-white hover:text-bank-gold"
                  >
                    {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Available funds in your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-bank-gold">
                  {showBalance 
                    ? formatCurrency(parseFloat(userDetails?.balance || "0")) 
                    : "••••••••"
                  }
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-sm text-gray-300">
                  Last updated: {formatDate(new Date().toISOString())}
                </p>
              </CardFooter>
            </Card>
            {/* Quick Actions Card */}
            <Card className="bg-[#1F2937] text-white hover:scale-105 transition-transform duration-300">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-6 w-6 mr-2 text-bank-gold" />
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Common banking operations
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button 
                  onClick={() => navigate("/transfer")} 
                  className="w-full bg-bank-gold hover:bg-bank-gold/90 text-bank-dark-text"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Transfer Money
                </Button>
                <Button 
                  onClick={() => navigate("/transactions")} 
                  className="w-full bg-transparent border border-bank-gold text-bank-gold hover:bg-bank-gold hover:text-bank-dark-text"
                >
                  <History className="h-4 w-4 mr-2" />
                  Transaction History
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-transparent text-gray-300 hover:text-white"
                  onClick={() => toast.info("Settings feature coming soon!")}
                >
                  Settings
                </Button>
              </CardContent>
            </Card>
          </div>
          {/* Spending Breakdown */}
          <div className="mt-10">
            <Card className="bg-[#1F2937] text-white hover:scale-105 transition-transform duration-300">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center text-bank-gold">
                    Costs
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-[100px] border-gray-300 dark:border-none text-gray-900 dark:text-white">
                        <SelectValue placeholder="Month" />
                        <ChevronDown className="h-4 w-4 ml-2 text-gray-900 dark:text-white" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthNames.map((month, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-[100px] border-gray-300 dark:border-none text-gray-900 dark:text-white">
                        <Calendar className="h-4 w-4 mr-2 text-gray-900 dark:text-white" />
                        <SelectValue placeholder="Year" />
                        <ChevronDown className="h-4 w-4 ml-2 text-gray-900 dark:text-white" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CardDescription className="text-gray-300">
                  Breakdown of your expenses for {monthNames[parseInt(selectedMonth)]} {selectedYear}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {totalSpending > 0 ? (
                  <>
                    <div className="relative flex justify-center items-center">
                      <div className="absolute text-center">
                        <p className="text-sm text-white">{highestCategory.name}</p>
                        <p className="text-2xl font-bold text-white">{formatCurrency(highestCategory.amount)}</p>
                        <p className="text-sm text-white">{highestPercentage}%</p>
                      </div>
                      <div className="w-48 h-48">
                        <Doughnut data={chartData} options={chartOptions} />
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4 w-full max-w-md">
                      {categories.map((category) => (
                        <div key={category.name} className="flex items-center">
                          <span
                            className="w-4 h-4 rounded-full mr-2"
                            style={{ backgroundColor: category.color }}
                          ></span>
                          <span className="text-sm text-white">
                            {category.name} {formatCurrency(category.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-white">
                    No expenses found for {monthNames[parseInt(selectedMonth)]} {selectedYear}.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {/* Recent Transactions */}
          <div className="mt-10">
            <Card className="bg-[#1F2937] text-white hover:scale-105 transition-transform duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-bank-gold">
                  <History className="h-6 w-6 mr-2 text-bank-gold" />
                  Recent Transactions
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Your last 5 transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentTransactions.length > 0 ? (
                  <div className="space-y-6">
                    {groupTransactionsByDate(recentTransactions).map((group, index) => (
                      <div key={group.date}>
                        {/* Date Header */}
                        <div className="text-sm font-medium text-gray-400 mb-2">{group.date}</div>
                        {/* Transactions for this date */}
                        <div className="space-y-4">
                          {group.transactions.map((transaction) => (
                            <div 
                              key={transaction.id} 
                              className="flex justify-between items-center p-3 border-b last:border-0 hover:bg-muted/50 rounded-lg transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${
                                  isCredit(transaction.type) ? "bg-green-100 text-green-600" :
                                  isDebit(transaction.type) ? "bg-red-100 text-red-600" :
                                  "bg-blue-100 text-blue-600"
                                }`}>
                                  <CircleDollarSign className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-medium text-white">{transaction.type}</p>
                                  <p className="text-sm text-white">{transaction.description || "Transaction"}</p>
                                  <p className="text-xs text-white">{formatDate(transaction.date_time)}</p>
                                </div>
                              </div>
                              <div className={`text-right font-semibold ${
                                isCredit(transaction.type) ? "text-green-600" :
                                isDebit(transaction.type) ? "text-red-600" : ""
                              }`}>
                                {isCredit(transaction.type) ? "+" : isDebit(transaction.type) ? "-" : ""}
                                {formatCurrency(transaction.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Separator Line (not shown after the last group) */}
                        {index < groupTransactionsByDate(recentTransactions).length - 1 && (
                          <hr className="my-4 border-t border-gray-500 dark:border-gray-400 w-full" style={{ height: "1px" }} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-white">
                    No transactions found.
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button 
                  variant="link" 
                  onClick={() => navigate("/transactions")}
                  className="text-bank-gold hover:text-bank-gold/80"
                >
                  View All Transactions
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </Layout>
  );
}