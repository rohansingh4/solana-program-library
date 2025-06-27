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

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// Program IDs
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const CUSTOM_ATA_PROGRAM_ID = new PublicKey('4yJEEgLC3iWcz8Qpym7AAW8XFuoUUUMrCQnecrJQdnXc');

// Token-2022 account size
const TOKEN_2022_ACCOUNT_SIZE = 165;

// Your existing GDEMO token details
const GDEMO_MINT = '6MN2kWzHayVLLwXj54dHE2sxWoBFGVvN8rGZeKXPbePD';
const YOUR_CURRENT_TOKEN_ACCOUNT = '25xMApU1yc4XbmeoAhpw2Unu2udPBs33j4tWSjEaeWRS';

// Load wallet
function loadKeypair() {
  const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Calculate ATA address
function findAssociatedTokenAddress(walletAddress, tokenMintAddress) {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      CUSTOM_TOKEN_2022_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    CUSTOM_ATA_PROGRAM_ID
  )[0];
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

// Get token balance from token account
async function getTokenBalance(tokenAccount, decimals = 6) {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(tokenAccount));
    if (!accountInfo || accountInfo.data.length < 72) return 0;
    
    const amount = accountInfo.data.readBigUInt64LE(64);
    return Number(amount) / Math.pow(10, decimals);
  } catch (error) {
    return 0;
  }
}

async function createAtaAndTransferGdemo() {
  try {
    const wallet = loadKeypair();
    const mintAddress = new PublicKey(GDEMO_MINT);
    const currentTokenAccount = new PublicKey(YOUR_CURRENT_TOKEN_ACCOUNT);
    
    console.log('🏦 Creating GDEMO Associated Token Account (ATA)');
    console.log('==============================================');
    console.log(`💼 Your Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🪙 GDEMO Mint: ${mintAddress.toString()}`);
    console.log(`📦 Current Token Account: ${currentTokenAccount.toString()}`);
    console.log('');
    
    // Calculate ATA address
    const ataAddress = findAssociatedTokenAddress(wallet.publicKey, mintAddress);
    console.log(`🎯 Your GDEMO ATA Address: ${ataAddress.toString()}`);
    console.log('');
    
    // Check if ATA already exists
    const ataAccountInfo = await connection.getAccountInfo(ataAddress);
    if (ataAccountInfo) {
      console.log('✅ ATA already exists! Checking balance...');
      const ataBalance = await getTokenBalance(ataAddress.toString());
      console.log(`💰 Current ATA Balance: ${ataBalance} GDEMO`);
      console.log('');
    }
    
    // Check current token account balance
    const currentBalance = await getTokenBalance(currentTokenAccount.toString());
    console.log(`💰 Current Token Account Balance: ${currentBalance} GDEMO`);
    
    if (currentBalance === 0) {
      console.log('⚠️ No tokens to transfer!');
      return;
    }
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    console.log('');
    console.log('🔧 Creating transaction...');
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });
    
    // Step 1: Create ATA if it doesn't exist
    if (!ataAccountInfo) {
      console.log('🔧 Step 1: Creating Associated Token Account...');
      
      // Get rent exemption amount
      const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);
      
      // Create ATA account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: ataAddress,
          space: TOKEN_2022_ACCOUNT_SIZE,
          lamports: lamports,
          programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
        })
      );
      
      // Initialize ATA
      const initAccountData = Buffer.alloc(1 + 32);
      initAccountData[0] = 18; // InitializeAccount3 instruction
      wallet.publicKey.toBuffer().copy(initAccountData, 1);
      
      transaction.add(new TransactionInstruction({
        keys: [
          { pubkey: ataAddress, isSigner: false, isWritable: true },
          { pubkey: mintAddress, isSigner: false, isWritable: false },
          { pubkey: wallet.publicKey, isSigner: false, isWritable: false },
        ],
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
        data: initAccountData,
      }));
    } else {
      console.log('✅ Step 1: ATA already exists, skipping creation...');
    }
    
    // Step 2: Transfer all tokens from current account to ATA
    console.log('🔧 Step 2: Transferring all GDEMO tokens to ATA...');
    const transferAmount = currentBalance * Math.pow(10, 6); // 6 decimals for GDEMO
    
    const transferData = Buffer.alloc(9);
    transferData[0] = 3; // Transfer instruction
    transferData.writeBigUInt64LE(BigInt(transferAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: currentTokenAccount, isSigner: false, isWritable: true }, // Source
        { pubkey: ataAddress, isSigner: false, isWritable: true }, // Destination
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // Owner
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: transferData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet);
    
    // Send transaction
    console.log('📤 Sending ATA creation and transfer transaction...');
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
    console.log('✅ SUCCESS! GDEMO ATA Created and Tokens Transferred!');
    console.log('=' .repeat(80));
    console.log(`🎯 Token: GorbChain Demo Token (GDEMO)`);
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount Transferred: ${currentBalance} GDEMO`);
    console.log(`👤 Owner: ${wallet.publicKey.toString()}`);
    console.log(`🏦 Your ATA Address: ${ataAddress.toString()}`);
    console.log(`📦 From Account: ${currentTokenAccount.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔧 ATA Program: ${CUSTOM_ATA_PROGRAM_ID.toString()}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log('=' .repeat(80));
    
    // Verify balances
    console.log('🔍 Verifying final balances...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalAtaBalance = await getTokenBalance(ataAddress.toString());
    const finalCurrentBalance = await getTokenBalance(currentTokenAccount.toString());
    
    console.log(`✅ ATA Balance: ${finalAtaBalance} GDEMO`);
    console.log(`📦 Old Account Balance: ${finalCurrentBalance} GDEMO`);
    
    // Save ATA info
    const ataInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      owner: wallet.publicKey.toString(),
      ataAddress: ataAddress.toString(),
      oldTokenAccount: currentTokenAccount.toString(),
      mintAddress: mintAddress.toString(),
      transferredAmount: currentBalance,
      finalAtaBalance: finalAtaBalance,
      finalOldBalance: finalCurrentBalance,
      decimals: 6,
      timestamp: new Date().toISOString(),
      method: 'ata-creation-and-transfer',
      tokenSymbol: 'GDEMO',
      tokenName: 'GorbChain Demo Token',
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      ataProgram: CUSTOM_ATA_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      notes: 'All GDEMO tokens transferred to Associated Token Account'
    };
    
    const filename = `gdemo-ata-transfer-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(ataInfo, null, 2));
    console.log(`💾 ATA transfer info saved to ${filename}`);
    
    console.log('');
    console.log('🎊 GDEMO TOKENS NOW IN YOUR ATA! 🎊');
    console.log(`🏦 Your GDEMO ATA: ${ataAddress.toString()}`);
    console.log(`💰 ATA Balance: ${finalAtaBalance} GDEMO`);
    console.log(`✨ Now your GDEMO tokens are in a standard Associated Token Account!`);
    
    return {
      success: true,
      ataAddress: ataAddress.toString(),
      transferredAmount: currentBalance,
      finalBalance: finalAtaBalance,
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus
    };
    
  } catch (error) {
    console.error('❌ ATA creation and transfer failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🏦 GDEMO Token: Create ATA and Transfer All Tokens');
    console.log('=================================================');
    console.log('Creating Associated Token Account and transferring all GDEMO tokens...');
    console.log('');
    
    const result = await createAtaAndTransferGdemo();
    
    console.log('');
    console.log('🎉 PROCESS COMPLETED SUCCESSFULLY!');
    console.log('==================================');
    console.log(`✅ ATA Address: ${result.ataAddress}`);
    console.log(`✅ Transferred: ${result.transferredAmount} GDEMO`);
    console.log(`✅ Final Balance: ${result.finalBalance} GDEMO`);
    console.log(`✅ Transaction: ${result.signature}`);
    console.log(`✅ Status: ${result.confirmationStatus}`);
    console.log('');
    console.log('🎯 BENEFITS OF ATA:');
    console.log('✅ Standardized address derived from your wallet');
    console.log('✅ More predictable and easier to find');
    console.log('✅ Compatible with most wallet interfaces');
    console.log('✅ Industry standard for token accounts');
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createAtaAndTransferGdemo, findAssociatedTokenAddress }; 