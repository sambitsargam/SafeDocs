import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface WalletState {
  isConnecting: boolean;
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
}

interface UseWalletReturn extends WalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<string>;
}

export const useWallet = (): UseWalletReturn => {
  const { login, logout } = useAuthStore();
  
  const [walletState, setWalletState] = useState<WalletState>({
    isConnecting: false,
    isConnected: false,
    address: null,
    chainId: null,
    provider: null,
    signer: null,
  });

  // Check if wallet is already connected
  useEffect(() => {
    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setWalletState(prev => ({
            ...prev,
            address: accounts[0],
          }));
        }
      };

      const handleChainChanged = (chainId: string) => {
        setWalletState(prev => ({
          ...prev,
          chainId: parseInt(chainId, 16),
        }));
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const checkConnection = async () => {
    try {
      if (!window.ethereum) return;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      
      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();

        setWalletState({
          isConnecting: false,
          isConnected: true,
          address,
          chainId: Number(network.chainId),
          provider,
          signer,
        });
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('Please install MetaMask or another Web3 wallet');
      return;
    }

    setWalletState(prev => ({ ...prev, isConnecting: true }));

    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      // Generate authentication message
      const response = await fetch('/api/auth/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, chainId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate authentication message');
      }

      const { message } = await response.json();

      // Sign the message
      const signature = await signer.signMessage(message);

      // Authenticate with backend
      const authResponse = await fetch('/api/auth/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message,
          chainId,
        }),
      });

      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authData = await authResponse.json();

      // Update wallet state
      setWalletState({
        isConnecting: false,
        isConnected: true,
        address,
        chainId,
        provider,
        signer,
      });

      // Update auth store
      login(authData.user, authData.wallet);

      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      setWalletState(prev => ({ 
        ...prev, 
        isConnecting: false,
        isConnected: false,
        address: null,
        chainId: null,
        provider: null,
        signer: null,
      }));
      
      if (error.code === 4001) {
        toast.error('Wallet connection rejected by user');
      } else {
        toast.error('Failed to connect wallet: ' + error.message);
      }
    }
  }, [login]);

  const disconnectWallet = useCallback(() => {
    setWalletState({
      isConnecting: false,
      isConnected: false,
      address: null,
      chainId: null,
      provider: null,
      signer: null,
    });
    
    logout();
    toast.success('Wallet disconnected');
  }, [logout]);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) {
      toast.error('No wallet detected');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      
      toast.success('Network switched successfully');
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added to wallet
        toast.error('Please add this network to your wallet first');
      } else {
        toast.error('Failed to switch network');
      }
    }
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!walletState.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      return await walletState.signer.signMessage(message);
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('Signature rejected by user');
      }
      throw new Error('Failed to sign message');
    }
  }, [walletState.signer]);

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    signMessage,
  };
};

// Helper function to format wallet address
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper function to get network info
export const getNetworkInfo = (chainId: number) => {
  const networks: Record<number, { name: string; currency: string; explorerUrl: string }> = {
    1: { name: 'Ethereum Mainnet', currency: 'ETH', explorerUrl: 'https://etherscan.io' },
    5: { name: 'Goerli Testnet', currency: 'ETH', explorerUrl: 'https://goerli.etherscan.io' },
    314: { name: 'Filecoin Mainnet', currency: 'FIL', explorerUrl: 'https://filfox.info' },
    314159: { name: 'Filecoin Calibration', currency: 'tFIL', explorerUrl: 'https://calibration.filfox.info' },
  };

  return networks[chainId] || { 
    name: `Unknown Network (${chainId})`, 
    currency: 'ETH', 
    explorerUrl: '' 
  };
};