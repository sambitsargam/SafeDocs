import { useCallback, useEffect } from 'react';
import { useAppKit, useAppKitAccount, useAppKitNetwork, useSignMessage } from '@reown/appkit/react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface UseWalletReturn {
  isConnecting: boolean;
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  connectWallet: () => void;
  disconnectWallet: () => void;
  switchNetwork: (chainId: number) => void;
  signMessage: (message: string) => Promise<string>;
}

export const useWallet = (): UseWalletReturn => {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { signMessageAsync } = useSignMessage();
  const { login, logout } = useAuthStore();

  // Handle authentication when wallet connects
  useEffect(() => {
    if (isConnected && address && chainId) {
      authenticateWallet();
    }
  }, [isConnected, address, chainId]);

  const authenticateWallet = async () => {
    if (!address || !chainId) return;

    try {
      const numChainId = typeof chainId === 'number' ? chainId : parseInt(chainId as string, 10);

      // Generate authentication message
      const response = await fetch('/api/auth/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, chainId: numChainId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate authentication message');
      }

      const { message } = await response.json();

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Authenticate with backend
      const authResponse = await fetch('/api/auth/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          message,
          chainId: numChainId,
        }),
      });

      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authData = await authResponse.json();

// Helper function to get network info
export const getNetworkInfo = (chainId: number) => {
  const networks: Record<number, { name: string; currency: string; explorerUrl: string }> = {
    1: { name: 'Ethereum Mainnet', currency: 'ETH', explorerUrl: 'https://etherscan.io' },
    5: { name: 'Goerli Testnet', currency: 'ETH', explorerUrl: 'https://goerli.etherscan.io' },
    8453: { name: 'Base Mainnet', currency: 'ETH', explorerUrl: 'https://basescan.org' },
    84532: { name: 'Base Sepolia', currency: 'ETH', explorerUrl: 'https://sepolia.basescan.org' },
    314: { name: 'Filecoin Mainnet', currency: 'FIL', explorerUrl: 'https://filfox.info' },
    314159: { name: 'Filecoin Calibration', currency: 'tFIL', explorerUrl: 'https://calibration.filfox.info' },
  };

  return networks[chainId] || { 
    name: `Unknown Network (${chainId})`, 
    currency: 'ETH', 
    explorerUrl: '' 
  };
};const disconnectWallet = useCallback(() => {
    logout();
    toast.success('Wallet disconnected');
  }, [logout]);

  const switchNetwork = useCallback((_targetChainId: number) => {
    toast('Please switch network in your wallet');
  }, []);

  const signMessageCustom = useCallback(async (message: string): Promise<string> => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await signMessageAsync({ message });
      return signature;
    } catch (error: any) {
      if (error.name === 'UserRejectedRequestError') {
        throw new Error('Signature rejected by user');
      }
      throw new Error('Failed to sign message');
    }
  }, [isConnected, signMessageAsync]);

  return {
    isConnecting: false, // AppKit handles this internally
    isConnected,
    address: address || null,
    chainId: typeof chainId === 'number' ? chainId : (typeof chainId === 'string' ? parseInt(chainId, 10) : null),
    connectWallet,
    disconnectWallet,
    switchNetwork,
    signMessage: signMessageCustom,
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