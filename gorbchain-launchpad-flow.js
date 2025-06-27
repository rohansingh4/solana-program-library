const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SystemProgram,
} = require('@solana/web3.js');

const fs = require('fs');

// ==========================================
// GORBCHAIN LAUNCHPAD CONFIGURATION
// ==========================================

const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const CUSTOM_ATA_PROGRAM_ID = new PublicKey('BWBbPGpceCtFCUuMFjYUYpHEnagcT58bNi9c44VJ4rkW');
const TOKEN_MINT = new PublicKey('BNGkFwWsBZ71K5S9s5oqLeTfj55ghvHgPQRYCxd64eNU');

const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// ==========================================
// LAUNCHPAD-STYLE FUNCTIONS
// ==========================================

// Function 1: Get or Create "ATA-like" Address
function getGorbChainTokenAddress(owner, mint = TOKEN_MINT) {
  // This mimics ATA address derivation but uses our custom ATA program
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), CUSTOM_TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    CUSTOM_ATA_PROGRAM_ID
  );
  return address;
}

// Function 2: Check if "ATA-like" account exists
async function checkTokenAccountExists(owner) {
  const tokenAddress = getGorbChainTokenAddress(owner);
  const accountInfo = await connection.getAccountInfo(tokenAddress);
  
  return {
    address: tokenAddress.toString(),
    exists: accountInfo !== null,
    balance: accountInfo ? await getTokenBalance(tokenAddress) : 0
  };
}

// Function 3: Get token balance
async function getTokenBalance(tokenAccount) {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(tokenAccount));
    if (!accountInfo || accountInfo.data.length < 64) return 0;
    
    // Token-2022 account structure: amount is at bytes 64-72 (little-endian u64)
    const amount = accountInfo.data.readBigUInt64LE(64);
    return Number(amount) / Math.pow(10, 9); // Convert from lamports (9 decimals)
  } catch (error) {
    return 0;
  }
}

// Function 4: Create "ATA-like" Account (Step 1 of launchpad flow)
async function createTokenAccount(userWallet, userAddress) {
  try {
    console.log('🔧 Step 1: Creating Token Account (ATA-like)...');
    
    const userPubkey = new PublicKey(userAddress);
    const tokenAddress = getGorbChainTokenAddress(userPubkey);
    
    console.log(`👤 User: ${userAddress}`);
    console.log(`🏦 Token Account: ${tokenAddress.toString()}`);
    
    // Check if already exists
    const existingAccount = await connection.getAccountInfo(tokenAddress);
    if (existingAccount) {
      console.log('✅ Token account already exists!');
      return {
        success: true,
        tokenAccount: tokenAddress.toString(),
        signature: null,
        message: 'Account already exists'
      };
    }
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: userWallet.publicKey,
    });
    
    // Create ATA instruction (corrected format)
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: userWallet.publicKey, isSigner: true, isWritable: true },        // Funding account
        { pubkey: tokenAddress, isSigner: false, isWritable: true },              // ATA address
        { pubkey: userPubkey, isSigner: false, isWritable: false },               // Owner
        { pubkey: TOKEN_MINT, isSigner: false, isWritable: false },               // Mint
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // System program
        { pubkey: CUSTOM_TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
      ],
      programId: CUSTOM_ATA_PROGRAM_ID,
      data: Buffer.from([0]), // Create instruction
    }));
    
    // Sign and send
    transaction.sign(userWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    
    // Wait for confirmation
    await confirmTransaction(signature);
    
    console.log('✅ Token account created successfully!');
    console.log(`📋 Transaction: ${signature}`);
    
    return {
      success: true,
      tokenAccount: tokenAddress.toString(),
      signature: signature,
      message: 'Token account created'
    };
    
  } catch (error) {
    console.error('❌ Token account creation failed:', error.message);
    
    // Fallback: Create manual token account
    console.log('🔄 Falling back to manual token account creation...');
    return await createManualTokenAccount(userWallet, userAddress);
  }
}

// Function 5: Fallback - Create Manual Token Account
async function createManualTokenAccount(userWallet, userAddress) {
  console.log('🔧 Creating manual token account (fallback method)...');
  
  const userPubkey = new PublicKey(userAddress);
  const tokenAccountKeypair = Keypair.generate();
  
  console.log(`🏦 Manual Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
  
  const lamports = await connection.getMinimumBalanceForRentExemption(165); // Token-2022 account size
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  
  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: userWallet.publicKey,
  });
  
  // Create account
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: userWallet.publicKey,
      newAccountPubkey: tokenAccountKeypair.publicKey,
      space: 165,
      lamports: lamports,
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
    })
  );
  
  // Initialize account
  const initAccountData = Buffer.alloc(1 + 32);
  initAccountData[0] = 18; // InitializeAccount3
  userPubkey.toBuffer().copy(initAccountData, 1);
  
  transaction.add(new TransactionInstruction({
    keys: [
      { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: userPubkey, isSigner: false, isWritable: false },
    ],
    programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
    data: initAccountData,
  }));
  
  // Sign and send
  transaction.sign(userWallet, tokenAccountKeypair);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });
  
  await confirmTransaction(signature);
  
  console.log('✅ Manual token account created successfully!');
  console.log(`📋 Transaction: ${signature}`);
  
  return {
    success: true,
    tokenAccount: tokenAccountKeypair.publicKey.toString(),
    tokenAccountKeypair: Array.from(tokenAccountKeypair.secretKey),
    signature: signature,
    message: 'Manual token account created',
    isManual: true
  };
}

// Function 6: Mint Tokens (Step 2 of launchpad flow)
async function mintToTokenAccount(userWallet, tokenAccount, amount) {
  try {
    console.log('🪙 Step 2: Minting Tokens...');
    console.log(`🏦 Token Account: ${tokenAccount}`);
    console.log(`💰 Amount: ${amount} GSUP`);
    
    const tokenAccountPubkey = new PublicKey(tokenAccount);
    const mintAmount = amount * Math.pow(10, 9); // 9 decimals
    
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: userWallet.publicKey,
    });
    
    // MintTo instruction
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: TOKEN_MINT, isSigner: false, isWritable: true },
        { pubkey: tokenAccountPubkey, isSigner: false, isWritable: true },
        { pubkey: userWallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: mintData,
    }));
    
    // Sign and send
    transaction.sign(userWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    
    await confirmTransaction(signature);
    
    console.log('✅ Tokens minted successfully!');
    console.log(`📋 Transaction: ${signature}`);
    
    return {
      success: true,
      signature: signature,
      amount: amount,
      tokenAccount: tokenAccount
    };
    
  } catch (error) {
    console.error('❌ Minting failed:', error.message);
    throw error;
  }
}

// Utility: Transaction confirmation
async function confirmTransaction(signature, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await connection.getSignatureStatus(signature);
      if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
        return status.value;
      }
      if (status?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }
      console.log(`⏳ Waiting for confirmation... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Transaction confirmation timeout');
}

// ==========================================
// LAUNCHPAD FLOW SIMULATOR
// ==========================================

async function launchpadFlow(userAddress, amount) {
  try {
    console.log('🚀 GorbChain Launchpad Flow Started');
    console.log('===================================');
    
    // Load mint authority wallet
    const mintAuthority = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'))));
    
    console.log(`👤 User Address: ${userAddress}`);
    console.log(`💰 Mint Amount: ${amount} GSUP`);
    console.log(`🔑 Mint Authority: ${mintAuthority.publicKey.toString()}`);
    console.log('');
    
    // Step 1: Check if user already has a token account
    console.log('🔍 Checking existing token accounts...');
    const existingAccount = await checkTokenAccountExists(new PublicKey(userAddress));
    console.log(`🏦 Expected Token Account: ${existingAccount.address}`);
    console.log(`📊 Account Exists: ${existingAccount.exists}`);
    console.log(`💰 Current Balance: ${existingAccount.balance} GSUP`);
    console.log('');
    
    let tokenAccount;
    
    if (!existingAccount.exists) {
      // Step 2: Create token account (ATA-like)
      const createResult = await createTokenAccount(mintAuthority, userAddress);
      if (!createResult.success) {
        throw new Error('Failed to create token account');
      }
      tokenAccount = createResult.tokenAccount;
      console.log('');
    } else {
      tokenAccount = existingAccount.address;
      console.log('✅ Using existing token account');
      console.log('');
    }
    
    // Step 3: Mint tokens
    const mintResult = await mintToTokenAccount(mintAuthority, tokenAccount, amount);
    
    // Final result
    console.log('');
    console.log('🎉 LAUNCHPAD FLOW COMPLETED!');
    console.log('============================');
    console.log(`✅ User: ${userAddress}`);
    console.log(`✅ Token Account: ${tokenAccount}`);
    console.log(`✅ Amount Minted: ${amount} GSUP`);
    console.log(`✅ Mint Transaction: ${mintResult.signature}`);
    console.log(`✅ Explorer: https://explorer.gorbchain.xyz/tx/${mintResult.signature}`);
    
    // Check final balance
    const finalBalance = await getTokenBalance(tokenAccount);
    console.log(`✅ Final Balance: ${finalBalance} GSUP`);
    
    return {
      success: true,
      userAddress,
      tokenAccount,
      amount,
      mintTransaction: mintResult.signature,
      finalBalance
    };
    
  } catch (error) {
    console.error('💥 Launchpad flow failed:', error.message);
    throw error;
  }
}

// ==========================================
// COMMAND LINE INTERFACE
// ==========================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('🚀 GorbChain Launchpad Flow Simulator');
    console.log('=====================================');
    console.log('');
    console.log('📖 USAGE:');
    console.log('  node gorbchain-launchpad-flow.js <user-address> <amount>');
    console.log('');
    console.log('📝 EXAMPLES:');
    console.log('  node gorbchain-launchpad-flow.js 5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ 100');
    console.log('  node gorbchain-launchpad-flow.js 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM 250');
    console.log('');
    console.log('🔧 This simulates the standard launchpad flow:');
    console.log('  1. Check/Create token account (ATA-like)');
    console.log('  2. Mint tokens to that account');
    console.log('');
    console.log('⚠️  Requirements:');
    console.log('  - wallet-keypair.json with mint authority');
    console.log('  - SOL balance on GorbChain for fees');
    console.log('');
    process.exit(1);
  }
  
  const [userAddress, amountStr] = args;
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Amount must be a positive number');
    process.exit(1);
  }
  
  try {
    await launchpadFlow(userAddress, amount);
  } catch (error) {
    console.error('💥 Flow failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  launchpadFlow,
  createTokenAccount,
  mintToTokenAccount,
  checkTokenAccountExists,
  getGorbChainTokenAddress,
  getTokenBalance
}; 