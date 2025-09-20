import { 
  REGEX_PATTERNS,
  CRYPTO_CONSTANTS 
} from './constants';
import { HashAlgorithm } from './types';

/**
 * Utility functions for SafeDocs
 */

// String utilities
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const truncateString = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

export const formatWalletAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  return REGEX_PATTERNS.EMAIL.test(email);
};

export const isValidWalletAddress = (address: string): boolean => {
  return REGEX_PATTERNS.WALLET_ADDRESS.test(address);
};

export const isValidIPFSCid = (cid: string): boolean => {
  return REGEX_PATTERNS.IPFS_CID.test(cid);
};

export const isValidHash = (hash: string, algorithm: HashAlgorithm = HashAlgorithm.SHA256): boolean => {
  switch (algorithm) {
    case HashAlgorithm.SHA256:
    case HashAlgorithm.KECCAK256:
      return REGEX_PATTERNS.HASH_SHA256.test(hash);
    case HashAlgorithm.SHA512:
      return /^[a-fA-F0-9]{128}$/.test(hash);
    default:
      return false;
  }
};

export const isValidUUID = (uuid: string): boolean => {
  return REGEX_PATTERNS.UUID.test(uuid);
};

// Date utilities
export const formatDate = (date: Date | string, format: 'short' | 'long' | 'iso' = 'short'): string => {
  const d = new Date(date);
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString();
    case 'long':
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'iso':
      return d.toISOString();
    default:
      return d.toLocaleDateString();
  }
};

export const isExpired = (expirationDate: Date | string): boolean => {
  return new Date(expirationDate) < new Date();
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const calculateRetentionDate = (createdAt: Date, retentionDays: number): Date => {
  return addDays(createdAt, retentionDays);
};

// Cryptography utilities
export const generateSalt = (length: number = CRYPTO_CONSTANTS.SALT_LENGTH): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateIV = (length: number = CRYPTO_CONSTANTS.IV_LENGTH): Uint8Array => {
  const iv = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    iv[i] = Math.floor(Math.random() * 256);
  }
  return iv;
};

// File utilities
export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

export const getMimeTypeFromExtension = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
};

export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
};

// Array utilities
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const unique = <T>(array: T[]): T[] => {
  return [...new Set(array)];
};

export const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const group = String(item[key]);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

// URL utilities
export const buildApiUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  const url = new URL(endpoint, process.env.API_BASE_URL || 'http://localhost:4000');
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }
  
  return url.toString();
};

export const buildIPFSUrl = (cid: string, gateway = 'https://ipfs.io/ipfs'): string => {
  return `${gateway}/${cid}`;
};

// Error utilities
export const createError = (code: string, message: string, details?: Record<string, any>): Error => {
  const error = new Error(message) as any;
  error.code = code;
  error.details = details;
  return error;
};

export const isApiError = (error: any): error is { code: string; message: string; details?: any } => {
  return error && typeof error.code === 'string' && typeof error.message === 'string';
};

// Async utilities
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const retry = async <T>(
  fn: () => Promise<T>, 
  maxRetries: number = 3, 
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries) break;
      await sleep(delay * Math.pow(2, i)); // Exponential backoff
    }
  }
  
  throw lastError!;
};

export const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
    
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
};

// Object utilities
export const pick = <T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const omit = <T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
};

export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const cloned = {} as any;
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone((obj as any)[key]);
    });
    return cloned;
  }
  return obj;
};

// Number utilities
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatFileSize = (bytes: number): string => {
  return formatBytes(bytes);
};

export const parseFileSize = (sizeStr: string): number => {
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  
  if (!match) throw new Error('Invalid file size format');
  
  const [, size, unit] = match;
  return parseFloat(size) * units[unit.toUpperCase() as keyof typeof units];
};

// Blockchain utilities
export const formatEthAddress = (address: string): string => {
  return formatWalletAddress(address);
};

export const isZeroAddress = (address: string): boolean => {
  return address === '0x0000000000000000000000000000000000000000';
};

export const compareAddresses = (addr1: string, addr2: string): boolean => {
  return addr1.toLowerCase() === addr2.toLowerCase();
};

// Browser utilities
export const copyToClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
};

export const downloadFile = (content: string | Blob, filename: string): void => {
  const blob = typeof content === 'string' ? new Blob([content]) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const getDeviceInfo = (): string => {
  return navigator.userAgent;
};

export const getIPAddress = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
};