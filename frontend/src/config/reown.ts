import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, filecoin, filecoinCalibration } from '@reown/appkit/networks';

// Get project ID from environment or use a default for development
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'YOUR_PROJECT_ID';

// Define metadata
const metadata = {
  name: 'SafeDocs',
  description: 'Permanent, Compliant, and Verifiable e-Signatures',
  url: 'https://safedocs.io',
  icons: ['https://safedocs.io/icon.png']
};

// Create Reown AppKit instance
export const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [filecoin, filecoinCalibration, mainnet],
  defaultNetwork: filecoinCalibration,
  projectId,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: false,
    onramp: false
  }
});

export default appKit;
