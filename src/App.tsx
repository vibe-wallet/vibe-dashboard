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
  Server,
  Monitor,
  Coins,
  Globe,
  Layers
} from 'lucide-react';

interface WalletAccount {
  name: string;
  address: string;
  type: 'evm' | 'solana';
  isActive: boolean;
}

interface ConnectedInstance {
  id: string;
  browser: string;
  activeAccount: string;
  activeChain: string;
  isActive: boolean;
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
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const [chainType, setChainType] = useState<'evm' | 'solana'>('evm');
  
  // Multi-account state
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [instances, setInstances] = useState<ConnectedInstance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
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

  const updateNetwork = useCallback((idOrKey: string) => {
    if (!idOrKey) return;
    try {
      // Handle Solana keys directly
      if (idOrKey === 'solana-devnet') {
        setNetwork('Solana Devnet');
        setChainId(0);
        return;
      }
      if (idOrKey === 'solana-mainnet') {
        setNetwork('Solana Mainnet');
        setChainId(0);
        return;
      }

      const id = typeof idOrKey === 'string' && idOrKey.startsWith('0x') 
        ? parseInt(idOrKey, 16) 
        : parseInt(idOrKey);
      
      if (isNaN(id)) return;
      
      setChainId(id);
      const networks: Record<number, string> = {
        11155111: 'Sepolia',
        84532: 'Base Sepolia',
        421614: 'Arbitrum Sepolia',
        1: 'Ethereum Mainnet'
      };
      setNetwork(networks[id] || `Chain ID: ${id}`);
    } catch (e) {
      console.error('Failed to update network:', e);
    }
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all wallet data
  const refreshData = useCallback(async () => {
    const provider = getVibeProvider();
    if (!provider || isRefreshing) return;

    try {
      setIsRefreshing(true);
      // Get all accounts from our custom tool (it includes type and active status)
      const accountsList = await provider.request({ method: 'wallet_listAccounts' });
      if (!Array.isArray(accountsList)) {
        setIsRefreshing(false);
        return;
      }


      const formattedAccounts = accountsList.map((a: any) => ({
        name: a.name,
        address: a.address,
        type: a.type || 'evm',
        isActive: a.isActive
      }));

      setAccounts(formattedAccounts);
      setIsConnected(true);

      // Find active account
      const active = formattedAccounts.find(a => a.isActive);
      if (active) {
        setAccountName(active.name);
        setAddress(active.address);
        // Only set chainType based on active if we haven't manually toggled it? 
        // Or just always follow active.
        // setChainType(active.type); 
      }

      // Get balance for current active
      if (active) {
        try {
          if (active.type === 'solana') {
            const bal = await provider.request({ method: 'solana_getBalance' });
            setBalance((parseFloat(bal) / 1e9).toFixed(4));
          } else {
            const bal = await provider.request({ 
              method: 'eth_getBalance', 
              params: [active.address, 'latest'] 
            });
            const b = typeof bal === 'string' && bal.startsWith('0x') ? BigInt(bal) : BigInt(bal || 0);
            setBalance((Number(b) / 1e18).toFixed(4));
          }
        } catch (e) {
          console.error('Balance fetch failed:', e);
        }
      }

      // Get chain
      try {
        const chain = await provider.request({ method: 'eth_chainId' });
        updateNetwork(chain);
      } catch {}

      // Get history
      try {
        const history = await provider.request({ method: 'wallet_getTransactionHistory' });
        if (Array.isArray(history)) {
          setTransactions(history.map(tx => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.params?.to || 'Contract',
            value: tx.params?.value ? (BigInt(tx.params.value).toString()) : '0',
            timestamp: tx.timestamp,
            status: 'success',
            type: tx.type === 'deploy' ? 'send' : tx.type,
            walletType: tx.walletType
          })));
        }
      } catch {}

      // Try to get tokens
      try {
        const tokensList = await provider.request({ method: 'wallet_getTokens' });
        if (Array.isArray(tokensList)) {
          setTokens(tokensList);
        }
      } catch {}

      // Try to get connected sites
      try {
        const sites = await provider.request({ method: 'wallet_getConnectedSites' });
        if (Array.isArray(sites)) {
          setConnectedSites(sites);
        }
      } catch {}

      setLastUpdate(new Date());
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [updateNetwork, isRefreshing]);

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

  const switchAccount = async (name: string) => {
    const provider = getVibeProvider();
    if (!provider) return;
    
    try {
      console.log('Switching account to:', name);
      await provider.request({ 
        method: 'wallet_selectAccount', 
        params: { accountName: name }
      });
      setShowAccountSelector(false);
      // Wait a bit for storage to propagate
      setTimeout(() => refreshData(), 500);
    } catch (e) {
      console.error('Failed to switch account:', e);
    }
  };

  // Switch network
  const switchNetwork = async (chainKey: string) => {
    const provider = getVibeProvider();
    if (!provider) return;

    try {
      await provider.request({
        method: 'wallet_switchNetwork',
        params: { chain: chainKey }
      });
      setShowNetworkSelector(false);
      await refreshData();
    } catch (e) {
      console.error('Failed to switch network:', e);
    }
  };

  useEffect(() => {
    const provider = getVibeProvider();
    if (provider) {
      // Single combined refresh for any changes
      const triggerRefresh = () => refreshData();

      provider.on('accountsChanged', triggerRefresh);
      provider.on('chainChanged', triggerRefresh);

      // Initial Eager Connection
      provider.request({ method: 'eth_accounts' }).then(async (accs: string[]) => {
        if (accs.length > 0) {
          await refreshData();
        } else {
          try {
            await provider.request({ method: 'eth_requestAccounts' });
            await refreshData();
          } catch (e) {
            console.log('Eager connection declined');
          }
        }
      });
    } else if ((window as any).ethereum) {
      setIsWrongWallet(true);
    }

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
                className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-white/5 transition-all group"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] group-hover:text-primary transition-colors italic">{accountName}</span>
                  <span className="text-xs font-mono text-zinc-300 font-bold group-hover:text-white transition-colors">{address.slice(0, 6)}...{address.slice(-4)}</span>
                </div>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-300 ${showAccountSelector ? 'rotate-180 text-primary' : ''}`} />
              </button>
              
              {showAccountSelector && accounts.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountSelector(false)} />
                  <div className="absolute right-0 top-full mt-3 w-64 bg-[#0A0A0A] border border-white/10 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 z-50 animate-fade-in ring-1 ring-white/5 overflow-hidden">
                    <div className="p-3 border-b border-white/5 mb-1 bg-white/[0.02]">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Switch Account</span>
                    </div>
                    {accounts.map((acc, i) => (
                      <button
                        key={i}
                        onClick={() => switchAccount(acc.name)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 mb-1 ${
                          acc.isActive 
                            ? 'bg-primary/10 border border-primary/20 text-primary' 
                            : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                            acc.isActive 
                              ? (acc.type === 'solana' ? 'bg-secondary text-white shadow-[0_0_15px_rgba(20,184,166,0.4)]' : 'bg-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]')
                              : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {acc.name[0]}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs font-black uppercase italic tracking-tighter ${acc.isActive ? (acc.type === 'solana' ? 'text-secondary' : 'text-primary') : ''}`}>{acc.name}</p>
                              <span className={`text-[7px] font-black px-1 py-0.2 rounded border ${acc.type === 'solana' ? 'bg-secondary/10 border-secondary/20 text-secondary' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                                {acc.type?.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono opacity-50 tracking-tighter">{acc.address.slice(0, 10)}...{acc.address.slice(-8)}</p>
                          </div>
                        </div>
                        {acc.isActive && <Check size={14} className="animate-in zoom-in duration-300" />}
                      </button>
                    ))}
                  </div>
                </>
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
                    
                    <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-white/5 flex flex-col justify-between relative group cursor-pointer hover:border-primary/30 transition-all"
                      onClick={() => setShowNetworkSelector(!showNetworkSelector)}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-bold text-sm">Network</h4>
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                             <ChevronDown size={14} className={`text-zinc-600 transition-transform ${showNetworkSelector ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        <p className="text-2xl font-bold mb-1 group-hover:text-primary transition-colors">{network}</p>
                        <p className="text-xs text-zinc-500 font-mono tracking-tighter">ID: {chainId}</p>
                      </div>

                      {showNetworkSelector && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 animate-fade-in ring-1 ring-white/5">
                          {[
                            { id: 'sepolia', name: 'Sepolia' },
                            { id: 'base-sepolia', name: 'Base Sepolia' },
                            { id: 'arbitrum-sepolia', name: 'Arbitrum Sepolia' },
                            { id: 'solana-devnet', name: 'Solana Devnet' },
                            { id: 'solana-mainnet', name: 'Solana Mainnet' }
                          ].map((net) => (
                            <button
                              key={net.id}
                              onClick={(e) => { e.stopPropagation(); switchNetwork(net.id); }}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group/item ${
                                network.includes(net.name) 
                                  ? 'bg-primary/10 border border-primary/20' 
                                  : 'hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              {network.includes(net.name) ? (
                                <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                              ) : (
                                <div className="w-2 h-2 rounded-full border border-zinc-600" />
                              )}
                              <span className={`text-xs font-black uppercase tracking-widest italic ${network.includes(net.name) ? 'text-primary' : 'text-zinc-400 group-hover/item:text-zinc-200'}`}>
                                {net.name}
                              </span>
                            </button>
                          ))}

                        </div>
                      )}
                      
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

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Accounts Section */}
                    <div className="space-y-6 h-full flex flex-col">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Users size={20} className="text-primary" /> Accounts
                        </h3>
                        
                        {/* Chain Type Toggle */}
                        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 h-fit">
                           <button 
                             onClick={() => setChainType('evm')}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chainType === 'evm' ? 'bg-primary text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                           >
                             EVM
                           </button>
                           <button 
                             onClick={() => setChainType('solana')}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chainType === 'solana' ? 'bg-secondary text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                           >
                             SOL
                           </button>
                        </div>
                      </div>
                      <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {accounts.filter(a => a.type === chainType).map((acc, i) => (
                          <div 
                            key={i}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                              acc.isActive 
                                ? (acc.type === 'solana' ? 'bg-secondary/5 border-secondary/30' : 'bg-primary/5 border-primary/30')
                                : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                            }`}
                            onClick={() => switchAccount(acc.name)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
                                  acc.isActive 
                                    ? (acc.type === 'solana' ? 'bg-secondary text-white shadow-[0_0_15px_rgba(20,184,166,0.4)]' : 'bg-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]')
                                    : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'
                                }`}>
                                  {acc.name[0]}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className={`font-bold text-sm ${acc.isActive ? (acc.type === 'solana' ? 'text-secondary' : 'text-primary') : ''}`}>{acc.name}</p>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${acc.type === 'solana' ? 'bg-secondary/10 border-secondary/20 text-secondary' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                                      {acc.type?.toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-[10px] font-mono text-zinc-500">{acc.address.slice(0, 10)}...{acc.address.slice(-8)}</p>
                                </div>
                              </div>
                              {acc.isActive && <Check size={14} className={acc.type === 'solana' ? 'text-secondary' : 'text-primary'} />}
                            </div>
                          </div>
                        ))}
                        {accounts.filter(a => a.type === chainType).length === 0 && (
                          <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
                             <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold">No {chainType.toUpperCase()} accounts found</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tokens Section */}
                    <div className="space-y-6 h-full flex flex-col">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Coins size={20} className="text-primary" /> Tokens
                      </h3>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between group hover:bg-zinc-900/60 transition-all">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border ${chainType === 'solana' ? 'bg-secondary text-white border-secondary/20' : 'bg-zinc-100 text-black border-white/10'}`}>
                              {chainType === 'solana' ? 'S' : 'Ξ'}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{chainType === 'solana' ? 'SOL' : 'ETH'}</p>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">{network}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-black text-sm ${chainType === 'solana' ? 'text-secondary' : 'text-white'}`}>{balance} {chainType === 'solana' ? 'SOL' : 'ETH'}</p>
                            <p className="text-[10px] text-zinc-500 font-medium">${(parseFloat(balance) * (chainType === 'solana' ? 140 : 2500)).toFixed(2)}</p>
                          </div>
                        </div>
                        {tokens.filter(t => (chainType === 'solana' ? t.chainId === 0 : t.chainId !== 0)).map((token, i) => (
                          <div key={i} className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between hover:bg-zinc-900/60 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-sm font-bold border border-white/5">{token.symbol[0]}</div>
                              <div>
                                <p className="font-bold text-sm">{token.symbol}</p>
                                <p className="text-[10px] text-zinc-500 font-mono tracking-tighter">{token.address.slice(0, 10)}...</p>
                              </div>
                            </div>
                            <div className="text-right font-black text-sm text-zinc-300">{token.balance} {token.symbol}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Transactions Section */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Activity size={20} className="text-primary" /> Recent Activity
                      </h3>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {transactions.length > 0 ? (
                        <div className="space-y-3">
                          {transactions.slice(0, 20).map((tx, i) => (
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
                  </div>

                </>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* MCP Server Status */}
                    <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-white/5 shadow-xl">
                      <div className="flex items-center gap-4 mb-8">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                          mcpConnected ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
                        }`}>
                          <Server size={28} className={mcpConnected ? 'text-green-400' : 'text-yellow-400'} />
                        </div>
                        <div>
                          <p className="font-bold text-lg">MCP Server</p>
                          <p className={`text-sm ${mcpConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                            {mcpConnected ? 'Connected' : 'Connecting...'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4 text-sm">
                        <div className="flex justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                          <span className="text-zinc-500 font-medium">Server URL</span>
                          <span className="font-mono text-zinc-300 italic">vibe-wallet-mcp.fly.dev</span>
                        </div>
                        <div className="flex justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                          <span className="text-zinc-500 font-medium">Status</span>
                          <span className={mcpConnected ? 'text-green-400 font-bold' : 'text-yellow-400 font-bold animate-pulse'}>
                            {mcpConnected ? 'Online' : 'Reconnecting'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Connected Sites */}
                    <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-white/5 shadow-xl flex flex-col">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Plug size={20} className="text-primary" /> Connected Sites
                        </h3>
                      </div>
                      <div className="flex-1 min-h-[150px]">
                        {connectedSites.length > 0 ? (
                          <div className="space-y-3">
                            {connectedSites.map((site, i) => (
                              <div key={i} className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center justify-between hover:bg-black/40 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                                    <Globe size={14} className="text-zinc-400" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-xs">{site.origin}</p>
                                    <p className="text-[9px] text-zinc-500">Connected: {new Date(site.connectedAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <button className="px-3 py-1.5 text-[10px] font-black uppercase italic text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all border border-red-500/10">
                                  Disconnect
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-6">
                            <Plug size={32} className="mb-2 opacity-10" />
                            <p className="text-[11px] font-medium uppercase tracking-widest">No active connections</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Connected Instances */}
                  <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-white/5 shadow-xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Monitor size={20} className="text-primary" /> Connected Instances
                    </h3>
                    {instances.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {instances.map((inst, i) => (
                          <div key={i} className={`p-5 rounded-2xl border transition-all ${
                            inst.isActive ? 'bg-primary/5 border-primary/30 shadow-[0_0_20px_rgba(139,92,246,0.05)]' : 'bg-black/20 border-white/5'
                          }`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inst.isActive ? 'bg-primary/20 text-primary' : 'bg-zinc-800 text-zinc-500'}`}>
                                  <Monitor size={20} />
                                </div>
                                <div>
                                  <p className="font-bold text-sm uppercase tracking-tighter">{inst.browser}</p>
                                  <p className="text-[10px] text-zinc-500 font-mono italic">{inst.id}</p>
                                </div>
                              </div>
                              {inst.isActive && (
                                <div className="px-2 py-1 bg-primary rounded-full text-[8px] font-black uppercase tracking-widest italic">Active</div>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500 uppercase font-bold tracking-widest">Account</span>
                                <span className="text-zinc-300">{inst.activeAccount}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500 uppercase font-bold tracking-widest">Network</span>
                                <span className="text-zinc-300">{inst.activeChain}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-white/5 rounded-[24px]">
                        <Activity size={32} className="mb-2 opacity-10" />
                        <p className="text-xs uppercase tracking-[0.2em] font-bold">No other instances connected</p>
                      </div>
                    )}
                  </div>

                  <div className="p-8 rounded-[32px] bg-zinc-900/40 border border-white/5">
                    <h4 className="font-black italic uppercase tracking-tighter text-xl mb-4">Vibe Wallet v1.2.1</h4>
                    <p className="text-sm text-zinc-500 font-medium">Zero-Config AI-native Ethereum wallet powered by MCP. Built for the future of agentic coding.</p>
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

function TransactionRow({ tx }: { tx: any }) {
  const isReceive = tx.type === 'receive';
  const isDeploy = tx.to === 'Contract';
  const isSolana = tx.walletType === 'solana';
  
  return (
    <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center justify-between hover:bg-zinc-900/60 transition-all group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
          isReceive ? 'bg-green-500/10 border-green-500/20' : 
          isDeploy ? 'bg-secondary/10 border-secondary/20' :
          'bg-primary/10 border-primary/20'
        }`}>
          {isReceive ? (
            <ArrowDownLeft size={18} className="text-green-400" />
          ) : isDeploy ? (
            <Layers size={18} className="text-secondary" />
          ) : (
            <ArrowUpRight size={18} className="text-primary" />
          )}
        </div>
        <div>
          <p className="font-black text-[11px] uppercase tracking-widest italic text-white group-hover:text-primary transition-colors flex items-center gap-2">
            {isReceive ? 'Received' : isDeploy ? 'Contract Deployment' : 'Sent'}
            <span className={`text-[7px] not-italic px-1 py-0.5 rounded border ${isSolana ? 'bg-secondary/10 border-secondary/20 text-secondary' : 'bg-primary/10 border-primary/20 text-primary'}`}>
              {isSolana ? 'SOL' : 'EVM'}
            </span>
          </p>
          <p className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors">
            {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-black tracking-tight ${isReceive ? 'text-green-400' : 'text-white'}`}>
          {isReceive ? '+' : '-'}{isSolana ? (parseFloat(tx.value) / 1e9).toFixed(4) : (Number(tx.value) / 1e18).toFixed(4)} <span className="text-[10px] opacity-40 font-normal">{isSolana ? 'SOL' : 'ETH'}</span>
        </p>
        <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default App;
