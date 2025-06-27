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
// GORBCHAIN TOKEN-2022 CONFIGURATION
// ==========================================

// GorbChain RPC (NOT Solana mainnet/devnet)
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';

// CUSTOM Program IDs (NOT standard Solana programs)
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const CUSTOM_ATA_PROGRAM_ID = new PublicKey('BWBbPGpceCtFCUuMFjYUYpHEnagcT58bNi9c44VJ4rkW');

// Existing Token Mint (GorbChain Supreme Token - GSUP)
const TOKEN_MINT = new PublicKey('BNGkFwWsBZ71K5S9s5oqLeTfj55ghvHgPQRYCxd64eNU');

// Token-2022 account size
const TOKEN_2022_ACCOUNT_SIZE = 165;

// ==========================================
// SETUP INSTRUCTIONS FOR USERS
// ==========================================

console.log('🌟 GorbChain Token-2022 Minting Guide');
console.log('=====================================');
console.log('');
console.log('📋 REQUIREMENTS:');
console.log('1. You need a wallet with SOL on GorbChain (not regular Solana)');
console.log('2. You need to connect to GorbChain RPC, not Solana RPC');
console.log('3. You must use CUSTOM program IDs, not standard Solana programs');
console.log('');
console.log('🔧 CONFIGURATION:');
console.log(`   RPC: ${RPC_ENDPOINT}`);
console.log(`   Token-2022 Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
console.log(`   ATA Program: ${CUSTOM_ATA_PROGRAM_ID.toString()}`);
console.log(`   Token Mint: ${TOKEN_MINT.toString()}`);
console.log('');
console.log('⚠️  WARNING: Do NOT use standard @solana/spl-token functions!');
console.log('   They will try to use standard Solana program IDs which');
console.log('   are not deployed on GorbChain.');
console.log('');

// ==========================================
// CONNECTION SETUP
// ==========================================

const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Load wallet keypair
function loadWallet(keypairPath = 'wallet-keypair.json') {
  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error(`❌ Error loading wallet from ${keypairPath}:`, error.message);
    console.log('💡 Make sure your wallet keypair file exists and is valid JSON');
    process.exit(1);
  }
}

// Manual transaction confirmation
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
// MAIN MINTING FUNCTION
// ==========================================

async function mintGorbChainTokens(recipientAddress, amount) {
  try {
    console.log('🚀 Starting GorbChain Token-2022 Minting...');
    
    // Load wallet
    const wallet = loadWallet();
    console.log(`💼 Wallet: ${wallet.publicKey.toString()}`);
    
    // Validate recipient
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (error) {
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    
    console.log(`🎯 Recipient: ${recipientAddress}`);
    console.log(`💰 Amount: ${amount} GSUP`);
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }
    
    // Create a new token account for the recipient
    const tokenAccountKeypair = Keypair.generate();
    console.log(`🏦 New Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    
    // Get rent exemption amount
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);
    console.log(`💰 Token account rent: ${lamports / LAMPORTS_PER_SOL} SOL`);
    
    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    // Create transaction
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });
    
    // 1. Create token account
    console.log('🔧 Adding create account instruction...');
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: tokenAccountKeypair.publicKey,
        space: TOKEN_2022_ACCOUNT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );
    
    // 2. Initialize token account (InitializeAccount3)
    console.log('🔧 Adding initialize account instruction...');
    const initAccountData = Buffer.alloc(1 + 32); // instruction + owner pubkey
    initAccountData[0] = 18; // InitializeAccount3 instruction
    recipientPubkey.toBuffer().copy(initAccountData, 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: TOKEN_MINT, isSigner: false, isWritable: false },
        { pubkey: recipientPubkey, isSigner: false, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: initAccountData,
    }));
    
    // 3. Mint tokens to the account
    console.log('🔧 Adding mint tokens instruction...');
    const decimals = 9; // GSUP has 9 decimals
    const mintAmount = amount * Math.pow(10, decimals);
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: TOKEN_MINT, isSigner: false, isWritable: true },
        { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: mintData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, tokenAccountKeypair);
    
    // Send transaction
    console.log('📤 Sending transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    
    console.log(`📋 Transaction signature: ${signature}`);
    console.log('⏳ Confirming transaction...');
    
    // Confirm transaction
    const confirmationStatus = await confirmTransaction(signature);
    
    console.log('');
    console.log('✅ SUCCESS! GorbChain Token-2022 Minting Completed!');
    console.log('=' .repeat(80));
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount: ${amount} GSUP`);
    console.log(`🎯 Recipient: ${recipientAddress}`);
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${TOKEN_MINT.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log('=' .repeat(80));
    
    // Save result
    const result = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      recipient: recipientAddress,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      tokenAccountKeypair: Array.from(tokenAccountKeypair.secretKey),
      mintAddress: TOKEN_MINT.toString(),
      amount: amount,
      decimals: decimals,
      timestamp: new Date().toISOString(),
      method: 'gorbchain-token2022-manual',
      tokenSymbol: 'GSUP',
      tokenName: 'GorbChain Supreme Token',
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      network: 'GorbChain'
    };
    
    const filename = `gorbchain-mint-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`💾 Result saved to ${filename}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Minting failed:', error.message);
    throw error;
  }
}

// ==========================================
// COMMAND LINE USAGE
// ==========================================

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('');
    console.log('📖 USAGE:');
    console.log('  node mint-to-gorbchain-token2022-guide.js <recipient-address> <amount>');
    console.log('');
    console.log('📝 EXAMPLES:');
    console.log('  node mint-to-gorbchain-token2022-guide.js 5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ 100');
    console.log('  node mint-to-gorbchain-token2022-guide.js 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM 250');
    console.log('');
    console.log('⚠️  REQUIREMENTS:');
    console.log('  1. You need a wallet-keypair.json file with SOL on GorbChain');
    console.log('  2. The recipient address must be a valid Solana public key');
    console.log('  3. You must be connected to GorbChain, not regular Solana');
    console.log('');
    process.exit(1);
  }
  
  const [recipientAddress, amountStr] = args;
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Amount must be a positive number');
    process.exit(1);
  }
  
  try {
    await mintGorbChainTokens(recipientAddress, amount);
    console.log('');
    console.log('🎊 Minting completed successfully!');
  } catch (error) {
    console.error('💥 Minting failed:', error.message);
    process.exit(1);
  }
}

// ==========================================
// EXPORT FOR PROGRAMMATIC USE
// ==========================================

module.exports = { 
  mintGorbChainTokens,
  CUSTOM_TOKEN_2022_PROGRAM_ID,
  CUSTOM_ATA_PROGRAM_ID,
  TOKEN_MINT,
  RPC_ENDPOINT
};

// Run if called directly
if (require.main === module) {
  main();
} 