import { PublicKey } from '@solana/web3.js';

// GorbChain Network Configuration
export const GORBCHAIN_RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
export const GORBCHAIN_EXPLORER = 'https://explorer.gorbchain.xyz';

// GorbChain Custom Program IDs
export const GORBCHAIN_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
export const GORBCHAIN_ATA_PROGRAM_ID = new PublicKey('BWBbPGpceCtFCUuMFjYUYpHEnagcT58bNi9c44VJ4rkW');
export const GORBCHAIN_SPL_TOKEN_PROGRAM_ID = new PublicKey('8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS');
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
export const RENT_PROGRAM_ID = new PublicKey('SysvarRent111111111111111111111111111111111');

// Token Account Sizes
export const TOKEN_2022_MINT_SIZE = 82;
export const TOKEN_2022_ACCOUNT_SIZE = 165;
export const SPL_TOKEN_MINT_SIZE = 82;
export const SPL_TOKEN_ACCOUNT_SIZE = 165;

// Default Token Configuration
export const DEFAULT_DECIMALS = 9;
export const DEFAULT_COMMITMENT = 'confirmed';

// Instruction Types for Token-2022
export const TOKEN_2022_INSTRUCTIONS = {
  INITIALIZE_MINT: 0,
  INITIALIZE_ACCOUNT: 1,
  INITIALIZE_MULTISIG: 2,
  TRANSFER: 3,
  APPROVE: 4,
  REVOKE: 5,
  SET_AUTHORITY: 6,
  MINT_TO: 7,
  BURN: 8,
  CLOSE_ACCOUNT: 9,
  FREEZE_ACCOUNT: 10,
  THAW_ACCOUNT: 11,
  TRANSFER_CHECKED: 12,
  APPROVE_CHECKED: 13,
  MINT_TO_CHECKED: 14,
  BURN_CHECKED: 15,
  INITIALIZE_ACCOUNT2: 16,
  SYNC_NATIVE: 17,
  INITIALIZE_ACCOUNT3: 18,
  INITIALIZE_MULTISIG2: 19,
  INITIALIZE_MINT2: 20,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_ADDRESS: 'Invalid address provided',
  INSUFFICIENT_FUNDS: 'Insufficient SOL balance for transaction fees',
  ACCOUNT_NOT_FOUND: 'Token account not found',
  MINT_NOT_FOUND: 'Token mint not found',
  UNAUTHORIZED: 'Unauthorized: Not the mint authority',
  NETWORK_ERROR: 'Network error: Unable to connect to GorbChain RPC',
  TRANSACTION_FAILED: 'Transaction failed to confirm',
} as const;

// Standard Solana Program IDs (for comparison/warnings)
export const STANDARD_SOLANA_PROGRAM_IDS = {
  TOKEN: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  TOKEN_2022: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
  ATA: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
} as const; 