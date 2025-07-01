import { 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  Keypair,
  SystemProgram
} from '@solana/web3.js';
import { GorbChainConnection } from '../connection/GorbChainConnection';
import { 
  GORBCHAIN_TOKEN_2022_PROGRAM_ID,
  TOKEN_2022_INSTRUCTIONS,
  TOKEN_2022_ACCOUNT_SIZE,
  TOKEN_2022_MINT_SIZE,
  SYSTEM_PROGRAM_ID,
  ERROR_MESSAGES
} from '../utils/constants';

export interface MintTokenParams {
  mintAddress: string | PublicKey;
  recipientAddress: string | PublicKey;
  amount: number;
  authority?: Keypair;
  createTokenAccount?: boolean;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  decimals?: number;
  supply?: number;
  authority?: Keypair;
  freezeAuthority?: PublicKey | null;
}

export interface TokenInfo {
  mintAddress: string;
  tokenAccountAddress?: string;
  signature: string;
  decimals: number;
  supply: number;
}

export class TokenMinter {
  constructor(private connection: GorbChainConnection) {}

  /**
   * Create a new Token-2022 mint
   */
  async createToken2022(params: CreateTokenParams): Promise<TokenInfo> {
    const {
      name,
      symbol,
      decimals = 9,
      supply = 0,
      authority,
      freezeAuthority = null
    } = params;

    if (!authority) {
      throw new Error('Authority keypair is required for token creation');
    }

    // Generate mint address
    const mintKeypair = Keypair.generate();
    const mintAddress = mintKeypair.publicKey;

    // Calculate rent exemption for mint account
    const mintRent = await this.connection.getMinimumBalanceForRentExemption(TOKEN_2022_MINT_SIZE);

    const transaction = new Transaction();

    // Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintAddress,
        lamports: mintRent,
        space: TOKEN_2022_MINT_SIZE,
        programId: GORBCHAIN_TOKEN_2022_PROGRAM_ID,
      })
    );

    // Initialize mint instruction data
    const initializeMintData = Buffer.alloc(35); // FIXED: Correct size for None freeze authority
    initializeMintData.writeUInt8(TOKEN_2022_INSTRUCTIONS.INITIALIZE_MINT2, 0);
    initializeMintData.writeUInt8(decimals, 1);
    authority.publicKey.toBuffer().copy(initializeMintData, 2);
    initializeMintData.writeUInt8(0, 34); // Option: None for freeze authority

    // Add initialize mint instruction
    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: mintAddress, isSigner: false, isWritable: true },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
        ],
        programId: GORBCHAIN_TOKEN_2022_PROGRAM_ID,
        data: initializeMintData,
      })
    );

    // Send transaction
    const signature = await this.connection.sendAndConfirmTransaction(
      transaction, 
      [authority, mintKeypair]
    );

    console.log(`Token mint created: ${mintAddress.toString()}`);
    console.log(`Transaction: ${signature}`);

    const result: TokenInfo = {
      mintAddress: mintAddress.toString(),
      signature,
      decimals,
      supply: 0
    };

    // If supply is specified, mint tokens to authority
    if (supply > 0) {
      const mintResult = await this.mintTo({
        mintAddress: mintAddress.toString(),
        recipientAddress: authority.publicKey.toString(),
        amount: supply,
        authority,
        createTokenAccount: true
      });
      
      result.tokenAccountAddress = mintResult.tokenAccountAddress;
      result.supply = supply;
    }

    return result;
  }

  /**
   * Mint tokens to a specific address
   */
  async mintTo(params: MintTokenParams): Promise<{ signature: string; tokenAccountAddress: string }> {
    const {
      mintAddress,
      recipientAddress,
      amount,
      authority,
      createTokenAccount = true
    } = params;

    if (!authority) {
      throw new Error('Authority keypair is required for minting');
    }

    const mintPubkey = typeof mintAddress === 'string' ? new PublicKey(mintAddress) : mintAddress;
    const recipientPubkey = typeof recipientAddress === 'string' ? new PublicKey(recipientAddress) : recipientAddress;

    // Generate token account
    const tokenAccountKeypair = Keypair.generate();
    const tokenAccountAddress = tokenAccountKeypair.publicKey;

    const transaction = new Transaction();

    if (createTokenAccount) {
      // Get rent exemption for token account
      const tokenAccountRent = await this.connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);

      // Create token account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: authority.publicKey,
          newAccountPubkey: tokenAccountAddress,
          lamports: tokenAccountRent,
          space: TOKEN_2022_ACCOUNT_SIZE,
          programId: GORBCHAIN_TOKEN_2022_PROGRAM_ID,
        })
      );

      // Initialize token account instruction data (InitializeAccount3 only needs discriminator)
      const initializeAccountData = Buffer.alloc(1);
      initializeAccountData.writeUInt8(TOKEN_2022_INSTRUCTIONS.INITIALIZE_ACCOUNT3, 0);

      // Add initialize account instruction
      transaction.add(
        new TransactionInstruction({
          keys: [
            { pubkey: tokenAccountAddress, isSigner: false, isWritable: true },
            { pubkey: mintPubkey, isSigner: false, isWritable: false },
            { pubkey: recipientPubkey, isSigner: false, isWritable: false },
            { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
          ],
          programId: GORBCHAIN_TOKEN_2022_PROGRAM_ID,
          data: initializeAccountData,
        })
      );
    }

    // Mint tokens instruction data
    const mintToData = Buffer.alloc(9);
    mintToData.writeUInt8(TOKEN_2022_INSTRUCTIONS.MINT_TO, 0);
    mintToData.writeBigUInt64LE(BigInt(amount * Math.pow(10, 9)), 1); // Assuming 9 decimals

    // Add mint to instruction
    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: mintPubkey, isSigner: false, isWritable: true },
          { pubkey: tokenAccountAddress, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        ],
        programId: GORBCHAIN_TOKEN_2022_PROGRAM_ID,
        data: mintToData,
      })
    );

    // Send transaction
    const signers = createTokenAccount ? [authority, tokenAccountKeypair] : [authority];
    const signature = await this.connection.sendAndConfirmTransaction(transaction, signers);

    console.log(`Minted ${amount} tokens to ${tokenAccountAddress.toString()}`);
    console.log(`Transaction: ${signature}`);

    return {
      signature,
      tokenAccountAddress: tokenAccountAddress.toString()
    };
  }

  /**
   * Get token mint information
   */
  async getMintInfo(mintAddress: string | PublicKey): Promise<any> {
    const mintPubkey = typeof mintAddress === 'string' ? new PublicKey(mintAddress) : mintAddress;
    
    const accountInfo = await this.connection.getAccountInfo(mintPubkey);
    if (!accountInfo) {
      throw new Error(ERROR_MESSAGES.MINT_NOT_FOUND);
    }

    // Parse mint data (simplified version)
    const data = accountInfo.data;
    if (data.length < 82) {
      throw new Error('Invalid mint account data');
    }

    return {
      address: mintPubkey.toString(),
      decimals: data[44],
      supply: data.readBigUInt64LE(36),
      mintAuthority: data.slice(4, 36),
      freezeAuthority: data.slice(46, 78),
    };
  }

  /**
   * Check if address has mint authority
   */
  async hasMintAuthority(mintAddress: string | PublicKey, authority: PublicKey): Promise<boolean> {
    try {
      const mintInfo = await this.getMintInfo(mintAddress);
      return Buffer.from(mintInfo.mintAuthority).equals(authority.toBuffer());
    } catch (error) {
      return false;
    }
  }
} 