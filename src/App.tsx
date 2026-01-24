import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Settings, 
  Zap, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy,
  LayoutDashboard,
  Plug,
  Wallet,
  RefreshCw,
  AlertCircle,
  Users,
  Check,
  ChevronDown,
  ExternalLink,
  Server,
  Monitor,
  Coins
} from 'lucide-react';

interface WalletAccount {
  name: string;
  address: string;
  isActive: boolean;
}

interface ConnectedInstance {
  id: string;
  browser: string;
  activeAccount: string;
  activeChain: string;
  isActive: boolean;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  type: 'send' | 'receive';
}

interface Token {
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
  chainId: number;
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [address, setAddress] = useState('0x0000...0000');
  const [accountName, setAccountName] = useState('Primary');
  const [balance, setBalance] = useState('0.00');
  const [network, setNetwork] = useState('Not Connected');
  const [chainId, setChainId] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isWrongWallet, setIsWrongWallet] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  
  // Multi-account state
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [instances, setInstances] = useState<ConnectedInstance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [connectedSites, setConnectedSites] = useState<any[]>([]);
  
  // MCP Status
  const [mcpConnected, setMcpConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Helper to get Vibe Wallet provider
  const getVibeProvider = () => {
    if (typeof window === 'undefined') return null;
    
    const eth = (window as any).ethereum;
    if (!eth) return null;

    // Direct check
    if (eth.isVibeWallet) return eth;

    // Check EIP-6963 providers if available
    if (eth.providers?.length) {
      return eth.providers.find((p: any) => p.isVibeWallet);
    }

    return null;
  };

  const updateNetwork = (hexId: string) => {
    const id = parseInt(hexId, 16);
    setChainId(id);
    const networks: Record<number, string> = {
      11155111: 'Sepolia',
      84532: 'Base Sepolia',
      421614: 'Arbitrum Sepolia',
      1: 'Ethereum Mainnet',
      137: 'Polygon',
      42161: 'Arbitrum One',
      10: 'Optimism',
      8453: 'Base'
    };
    setNetwork(networks[id] || `Chain ID: ${id}`);
  };

  // Fetch all wallet data
  const refreshData = useCallback(async () => {
    const provider = getVibeProvider();
    if (!provider) return;

    try {
      // Get accounts
      const accs = await provider.request({ method: 'eth_accounts' });
      if (accs.length > 0) {
        setAddress(accs[0]);
        
        // Get balance
        const bal = await provider.request({ 
          method: 'eth_getBalance', 
          params: [accs[0], 'latest'] 
        });
        setBalance((parseInt(bal, 16) / 1e18).toFixed(4));
        
        // Get chain
        const chain = await provider.request({ method: 'eth_chainId' });
        updateNetwork(chain);
        
        // Get account name
        try {
          const name = await provider.request({ method: 'eth_activeAccountName' });
          setAccountName(name);
        } catch {
          setAccountName('Vibe Account');
        }

        // Try to get wallet accounts list
        try {
          const accountsList = await provider.request({ method: 'wallet_listAccounts' });
          if (Array.isArray(accountsList)) {
            setAccounts(accountsList.map((a: any) => ({
              name: a.name,
              address: a.address,
              isActive: a.isActive
            })));
          }
        } catch {
          // Fallback - just use current account
          setAccounts([{ name: accountName, address: accs[0], isActive: true }]);
        }

        // Try to get tokens
        try {
          const tokensList = await provider.request({ method: 'wallet_getTokens' });
          if (Array.isArray(tokensList)) {
            setTokens(tokensList);
          }
        } catch {
          // No tokens
        }

        // Try to get connected sites
        try {
          const sites = await provider.request({ method: 'wallet_getConnectedSites' });
          if (Array.isArray(sites)) {
            setConnectedSites(sites);
          }
        } catch {
          // No sites
        }
        
        setLastUpdate(new Date());
        setIsConnected(true);
      }
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }, [accountName]);

  // Connect to Extension
  const connectWallet = async () => {
    const provider = getVibeProvider();
    
    if (provider) {
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        setAddress(accounts[0]);
        setIsConnected(true);
        setIsWrongWallet(false);
        
        await refreshData();
      } catch (error) {
        console.error('Connection failed:', error);
      }
    } else {
      // Check if ANY wallet is connected but not Vibe
      if ((window as any).ethereum) {
        setIsWrongWallet(true);
      } else {
        window.open('https://github.com/askar-ef/vibe-wallet', '_blank');
      }
    }
  };

  // Switch account
  const switchAccount = async (name: string) => {
    const provider = getVibeProvider();
    if (!provider) return;
    
    try {
      // This is a custom method we expose
      await provider.request({ 
        method: 'wallet_switchAccount', 
        params: [{ accountName: name }] 
      });
      setShowAccountSelector(false);
      await refreshData();
    } catch (e) {
      console.error('Failed to switch account:', e);
    }
  };

  useEffect(() => {
    const provider = getVibeProvider();
    if (provider) {
      // Listen for changes
      provider.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          refreshData();
        } else {
          setIsConnected(false);
          setAddress('0x0000...0000');
        }
      });

      provider.on('chainChanged', (chainId: string) => {
        updateNetwork(chainId);
        refreshData();
      });

      // Auto-connect if already authorized
      provider.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          connectWallet();
        }
      });
    } else if ((window as any).ethereum) {
      setIsWrongWallet(true);
    }

    // Auto-refresh every 10 seconds
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Check MCP status via storage
  useEffect(() => {
    const checkMcpStatus = async () => {
      const provider = getVibeProvider();
      if (!provider) return;
      
      try {
        const status = await provider.request({ method: 'wallet_getMcpStatus' });
        setMcpConnected(status?.connected || false);
        
        // Try to get instances info if available
        if (status?.instances && Array.isArray(status.instances)) {
          setInstances(status.instances);
        }
      } catch {
        // Fallback - just check if extension is responding
        setMcpConnected(isConnected);
      }
    };

    // Also set up placeholder for transactions (would need block explorer API)
    setTransactions([]);

    checkMcpStatus();
    const interval = setInterval(checkMcpStatus, 5000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
  };

  return (
    <div className="flex h-screen bg-dark text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-zinc-950/50 border-r border-white/5 flex flex-col p-8 z-20">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <Zap className="text-primary fill-primary/20" size={28} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter italic">VIBE</h1>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${mcpConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">{accountName}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Overview" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="Accounts" 
            active={activeTab === 'accounts'} 
            onClick={() => setActiveTab('accounts')} 
          />
          <NavItem 
            icon={<Coins size={20} />} 
            label="Tokens" 
            active={activeTab === 'tokens'} 
            onClick={() => setActiveTab('tokens')} 
          />
          <NavItem 
            icon={<Activity size={20} />} 
            label="Transactions" 
            active={activeTab === 'transactions'} 
            onClick={() => setActiveTab('transactions')} 
          />
          <NavItem 
            icon={<Plug size={20} />} 
            label="Connections" 
            active={activeTab === 'connections'} 
            onClick={() => setActiveTab('connections')} 
          />
          <NavItem 
            icon={<Server size={20} />} 
            label="MCP Status" 
            active={activeTab === 'mcp'} 
            onClick={() => setActiveTab('mcp')} 
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>

        <div className="mt-auto">
          {!isConnected ? (
            <button 
              onClick={connectWallet}
              className="w-full py-4 bg-primary rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Plug size={18} /> Connect Wallet
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse"></div>
                <span className="text-xs font-semibold text-zinc-300">{network}</span>
              </div>
              <div 
                onClick={copyAddress}
                className="bg-zinc-900/50 rounded-lg p-2 flex items-center justify-between group cursor-pointer border border-transparent hover:border-white/10 transition-colors"
              >
                <span className="text-[10px] font-mono text-zinc-500 uppercase">{address.slice(0, 6)}...{address.slice(-4)}</span>
                <Copy size={12} className="text-zinc-600 group-hover:text-primary" />
              </div>
              {lastUpdate && (
                <p className="text-[9px] text-zinc-600 mt-2 text-center">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0B] relative">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-10 border-b border-white/5 bg-dark/40 backdrop-blur-xl z-10">
          <h2 className="font-bold text-xl">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
          <div className="flex items-center gap-5">
            <button 
              onClick={refreshData}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowAccountSelector(!showAccountSelector)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{accountName}</span>
                  <span className="text-sm font-mono text-zinc-300">{address.slice(0, 6)}...{address.slice(-4)}</span>
                </div>
                <ChevronDown size={16} className={`text-zinc-500 transition-transform ${showAccountSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {showAccountSelector && accounts.length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                  {accounts.map((acc, i) => (
                    <button
                      key={i}
                      onClick={() => switchAccount(acc.name)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                        acc.isActive ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          acc.isActive ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {acc.name[0]}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">{acc.name}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{acc.address.slice(0, 6)}...{acc.address.slice(-4)}</p>
                        </div>
                      </div>
                      {acc.isActive && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={`w-10 h-10 rounded-2xl p-[1px] ${isConnected ? 'bg-gradient-to-br from-primary to-secondary' : 'bg-white/10'}`}>
              <div className="w-full h-full bg-zinc-900 rounded-[15px] flex items-center justify-center">
                <Wallet size={18} className={isConnected ? 'text-primary' : 'text-zinc-600'} />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 z-10">
          {isWrongWallet && !isConnected ? (
             <div className="h-full flex flex-col items-center justify-center space-y-6 text-center animate-fade-in">
                <div className="w-24 h-24 bg-red-500/10 rounded-[32px] flex items-center justify-center border border-red-500/20 mb-4">
                  <AlertCircle size={40} className="text-red-500" />
                </div>
                <h3 className="text-3xl font-black italic tracking-tighter">WRONG WALLET DETECTED</h3>
                <p className="text-zinc-500 max-w-xs mx-auto text-sm">The Dashboard is exclusive to Vibe Wallet. Please disable other extensions or set Vibe Wallet as your primary provider.</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-8 py-4 bg-white/5 rounded-2xl font-bold text-sm hover:bg-white/10 border border-white/10 transition-all shadow-lg"
                >
                  Retry Detection
                </button>
             </div>
          ) : !isConnected ? (
             <div className="h-full flex flex-col items-center justify-center space-y-6 text-center animate-fade-in">
                <div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center border border-primary/20 mb-4">
                  <Plug size={40} className="text-primary" />
                </div>
                <h3 className="text-3xl font-black italic tracking-tighter">VIBE NOT CONNECTED</h3>
                <p className="text-zinc-500 max-w-xs mx-auto text-sm">Connect your Vibe Wallet extension to access the dashboard and manage your assets.</p>
                <button 
                  onClick={connectWallet}
                  className="px-8 py-4 bg-primary rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Connect Wallet
                </button>
             </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-10 animate-fade-in">
              {activeTab === 'dashboard' && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 p-10 rounded-[32px] bg-zinc-900/40 border border-white/5 relative overflow-hidden group shadow-2xl">
                      <div className="relative z-10">
                        <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-4">Total Portfolio</p>
                        <div className="flex items-baseline gap-4 mb-10">
                          <h3 className="text-6xl font-black tracking-tighter italic">{balance} <span className="text-primary not-italic">ETH</span></h3>
                          <span className="text-zinc-500 font-medium text-lg">= ${(parseFloat(balance) * 2500).toFixed(2)}</span>
                        </div>
                        <div className="flex gap-4">
                          <button className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-primary rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                            <ArrowUpRight size={18} /> Send
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-white/5 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all border border-white/5">
                            <ArrowDownLeft size={18} /> Receive
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-white/5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-bold text-sm">Network</h4>
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        </div>
                        <p className="text-2xl font-bold mb-1">{network}</p>
                        <p className="text-xs text-zinc-500">Chain ID: {chainId}</p>
                      </div>
                      
                      <div className="mt-6 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-zinc-500">MCP Server</span>
                          <div className={`flex items-center gap-1.5 ${mcpConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${mcpConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
                            <span className="text-[10px] font-bold uppercase">{mcpConnected ? 'Connected' : 'Connecting'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Account</span>
                          <span className="text-xs font-bold text-white">{accountName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold">Recent Activity</h3>
                      <button 
                        onClick={() => setActiveTab('transactions')}
                        className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1"
                      >
                        View All <ExternalLink size={12} />
                      </button>
                    </div>
                    {transactions.length > 0 ? (
                      <div className="space-y-3">
                        {transactions.slice(0, 5).map((tx, i) => (
                          <TransactionRow key={i} tx={tx} />
                        ))}
                      </div>
                    ) : (
                      <div className="p-20 rounded-[32px] bg-zinc-900/20 border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500">
                         <Activity size={40} className="mb-4 opacity-20" />
                         <p className="text-sm">No recent transactions found on {network}.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'accounts' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">Wallet Accounts</h3>
                      <p className="text-sm text-zinc-500 mt-1">Manage your wallet accounts across all connected instances</p>
                    </div>
                  </div>
                  
                  {accounts.length > 0 ? (
                    <div className="grid gap-4">
                      {accounts.map((acc, i) => (
                        <div 
                          key={i}
                          className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                            acc.isActive 
                              ? 'bg-primary/5 border-primary/30' 
                              : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                          }`}
                          onClick={() => switchAccount(acc.name)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${
                                acc.isActive ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {acc.name[0]}
                              </div>
                              <div>
                                <p className="font-bold text-lg">{acc.name}</p>
                                <p className="text-sm font-mono text-zinc-500">{acc.address}</p>
                              </div>
                            </div>
                            {acc.isActive && (
                              <div className="bg-primary/20 px-3 py-1 rounded-full">
                                <span className="text-xs font-bold text-primary">Active</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-20 rounded-[32px] bg-zinc-900/20 border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500">
                       <Users size={40} className="mb-4 opacity-20" />
                       <p className="text-sm">Connect your wallet to view accounts</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tokens' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">Token Balances</h3>
                  
                  {/* Native Token */}
                  <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-2xl">
                        E
                      </div>
                      <div>
                        <p className="font-bold text-lg">ETH</p>
                        <p className="text-sm text-zinc-500">{network}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{balance} ETH</p>
                      <p className="text-sm text-zinc-500">= ${(parseFloat(balance) * 2500).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {tokens.length > 0 ? (
                    <div className="space-y-3">
                      {tokens.map((token, i) => (
                        <div key={i} className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-lg font-bold">
                              {token.symbol[0]}
                            </div>
                            <div>
                              <p className="font-bold text-lg">{token.symbol}</p>
                              <p className="text-xs font-mono text-zinc-500">{token.address.slice(0, 10)}...</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{token.balance} {token.symbol}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 rounded-[32px] bg-zinc-900/20 border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500">
                       <Coins size={32} className="mb-4 opacity-20" />
                       <p className="text-sm">No custom tokens added</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'transactions' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">Transaction History</h3>
                  
                  {transactions.length > 0 ? (
                    <div className="space-y-3">
                      {transactions.map((tx, i) => (
                        <TransactionRow key={i} tx={tx} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-20 rounded-[32px] bg-zinc-900/20 border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500">
                       <Activity size={40} className="mb-4 opacity-20" />
                       <p className="text-sm">No transactions found on {network}.</p>
                       <p className="text-xs text-zinc-600 mt-2">Transactions will appear here after you send or receive assets.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'connections' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">Connected Sites</h3>
                  
                  {connectedSites.length > 0 ? (
                    <div className="space-y-3">
                      {connectedSites.map((site, i) => (
                        <div key={i} className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                              <Plug size={18} className="text-zinc-400" />
                            </div>
                            <div>
                              <p className="font-bold">{site.origin}</p>
                              <p className="text-xs text-zinc-500">Connected: {new Date(site.connectedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button className="px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                            Disconnect
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-20 rounded-[32px] bg-zinc-900/20 border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500">
                       <Plug size={40} className="mb-4 opacity-20" />
                       <p className="text-sm">No sites connected</p>
                       <p className="text-xs text-zinc-600 mt-2">Connected dApps will appear here</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'mcp' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">MCP Server Status</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-8 rounded-2xl bg-zinc-900/40 border border-white/5">
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                          mcpConnected ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
                        }`}>
                          <Server size={28} className={mcpConnected ? 'text-green-400' : 'text-yellow-400'} />
                        </div>
                        <div>
                          <p className="font-bold text-lg">MCP Connection</p>
                          <p className={`text-sm ${mcpConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                            {mcpConnected ? 'Connected' : 'Connecting...'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Server</span>
                          <span className="font-mono">ws://localhost:8080/mcp</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Status</span>
                          <span className={mcpConnected ? 'text-green-400' : 'text-yellow-400'}>
                            {mcpConnected ? 'Online' : 'Reconnecting'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-8 rounded-2xl bg-zinc-900/40 border border-white/5">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Monitor size={28} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">Extension Instance</p>
                          <p className="text-sm text-zinc-500">Current Browser</p>
                        </div>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Active Account</span>
                          <span className="font-medium">{accountName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Network</span>
                          <span className="font-medium">{network}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Address</span>
                          <span className="font-mono text-xs">{address.slice(0, 10)}...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {instances.length > 0 && (
                    <div className="mt-8">
                      <h4 className="font-bold mb-4">Connected Instances</h4>
                      <div className="space-y-3">
                        {instances.map((inst, i) => (
                          <div key={i} className={`p-4 rounded-xl border ${
                            inst.isActive ? 'bg-primary/5 border-primary/30' : 'bg-zinc-900/40 border-white/5'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Monitor size={18} className={inst.isActive ? 'text-primary' : 'text-zinc-500'} />
                                <div>
                                  <p className="font-medium">{inst.browser}</p>
                                  <p className="text-xs text-zinc-500">{inst.activeAccount} / {inst.activeChain}</p>
                                </div>
                              </div>
                              {inst.isActive && (
                                <span className="text-[10px] font-bold text-primary uppercase">Active</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold">Settings</h3>
                  <div className="p-8 rounded-2xl bg-zinc-900/40 border border-white/5">
                    <h4 className="font-bold mb-4">About</h4>
                    <p className="text-sm text-zinc-400">Vibe Wallet Dashboard v1.0.0</p>
                    <p className="text-xs text-zinc-500 mt-2">MCP-controlled wallet for developers and AI agents.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${
        active 
          ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'
      }`}
    >
      <div className={`${active ? 'text-white' : 'text-zinc-500 group-hover:text-primary transition-colors'}`}>
        {icon}
      </div>
      <span className="font-bold text-sm tracking-tight">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
    </button>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isReceive = tx.type === 'receive';
  
  return (
    <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isReceive ? 'bg-green-500/10' : 'bg-primary/10'
        }`}>
          {isReceive ? (
            <ArrowDownLeft size={18} className="text-green-400" />
          ) : (
            <ArrowUpRight size={18} className="text-primary" />
          )}
        </div>
        <div>
          <p className="font-medium">{isReceive ? 'Received' : 'Sent'}</p>
          <p className="text-xs font-mono text-zinc-500">{tx.hash.slice(0, 10)}...</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold ${isReceive ? 'text-green-400' : 'text-white'}`}>
          {isReceive ? '+' : '-'}{tx.value} ETH
        </p>
        <p className="text-xs text-zinc-500">{new Date(tx.timestamp).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

export default App;
