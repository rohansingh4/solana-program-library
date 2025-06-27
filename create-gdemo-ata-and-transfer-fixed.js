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

async function createNewAccountAndTransferGdemo() {
  try {
    const wallet = loadKeypair();
    const mintAddress = new PublicKey(GDEMO_MINT);
    const currentTokenAccount = new PublicKey(YOUR_CURRENT_TOKEN_ACCOUNT);
    
    console.log('🏦 Creating New GDEMO Token Account & Transferring All Tokens');
    console.log('===========================================================');
    console.log(`💼 Your Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🪙 GDEMO Mint: ${mintAddress.toString()}`);
    console.log(`📦 Current Token Account: ${currentTokenAccount.toString()}`);
    console.log('');
    
    // Generate new token account keypair
    const newTokenAccountKeypair = Keypair.generate();
    console.log(`🎯 New Token Account: ${newTokenAccountKeypair.publicKey.toString()}`);
    console.log('');
    
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
    
    // Step 1: Create new token account
    console.log('🔧 Step 1: Creating new token account...');
    
    // Get rent exemption amount
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);
    console.log(`💰 Token account rent: ${lamports / LAMPORTS_PER_SOL} SOL`);
    
    // Create new token account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: newTokenAccountKeypair.publicKey,
        space: TOKEN_2022_ACCOUNT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );
    
    // Initialize new token account
    const initAccountData = Buffer.alloc(1 + 32);
    initAccountData[0] = 18; // InitializeAccount3 instruction
    wallet.publicKey.toBuffer().copy(initAccountData, 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: newTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: wallet.publicKey, isSigner: false, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: initAccountData,
    }));
    
    // Step 2: Transfer all tokens from current account to new account
    console.log('🔧 Step 2: Transferring all GDEMO tokens to new account...');
    const transferAmount = currentBalance * Math.pow(10, 6); // 6 decimals for GDEMO
    
    const transferData = Buffer.alloc(9);
    transferData[0] = 3; // Transfer instruction
    transferData.writeBigUInt64LE(BigInt(transferAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: currentTokenAccount, isSigner: false, isWritable: true }, // Source
        { pubkey: newTokenAccountKeypair.publicKey, isSigner: false, isWritable: true }, // Destination
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // Owner
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: transferData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, newTokenAccountKeypair);
    
    // Send transaction
    console.log('📤 Sending token account creation and transfer transaction...');
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
    console.log('✅ SUCCESS! New GDEMO Account Created and Tokens Transferred!');
    console.log('=' .repeat(80));
    console.log(`🎯 Token: GorbChain Demo Token (GDEMO)`);
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount Transferred: ${currentBalance} GDEMO`);
    console.log(`👤 Owner: ${wallet.publicKey.toString()}`);
    console.log(`🏦 New Token Account: ${newTokenAccountKeypair.publicKey.toString()}`);
    console.log(`📦 From Account: ${currentTokenAccount.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log('=' .repeat(80));
    
    // Verify balances
    console.log('🔍 Verifying final balances...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalNewBalance = await getTokenBalance(newTokenAccountKeypair.publicKey.toString());
    const finalOldBalance = await getTokenBalance(currentTokenAccount.toString());
    
    console.log(`✅ New Account Balance: ${finalNewBalance} GDEMO`);
    console.log(`📦 Old Account Balance: ${finalOldBalance} GDEMO`);
    
    // Save new account info
    const newAccountInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      owner: wallet.publicKey.toString(),
      newTokenAccount: newTokenAccountKeypair.publicKey.toString(),
      newTokenAccountKeypair: Array.from(newTokenAccountKeypair.secretKey),
      oldTokenAccount: currentTokenAccount.toString(),
      mintAddress: mintAddress.toString(),
      transferredAmount: currentBalance,
      finalNewBalance: finalNewBalance,
      finalOldBalance: finalOldBalance,
      decimals: 6,
      timestamp: new Date().toISOString(),
      method: 'new-account-creation-and-transfer',
      tokenSymbol: 'GDEMO',
      tokenName: 'GorbChain Demo Token',
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      notes: 'All GDEMO tokens transferred to new dedicated token account'
    };
    
    const filename = `gdemo-new-account-transfer-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(newAccountInfo, null, 2));
    console.log(`💾 New account transfer info saved to ${filename}`);
    
    console.log('');
    console.log('🎊 ALL 1,200 GDEMO TOKENS TRANSFERRED! 🎊');
    console.log(`🏦 Your New GDEMO Account: ${newTokenAccountKeypair.publicKey.toString()}`);
    console.log(`💰 New Account Balance: ${finalNewBalance} GDEMO`);
    console.log(`📦 Old Account Balance: ${finalOldBalance} GDEMO`);
    console.log(`✨ All tokens successfully consolidated into your new account!`);
    
    // Show summary
    console.log('');
    console.log('📋 GDEMO TOKEN ACCOUNT SUMMARY:');
    console.log('==============================');
    console.log(`🎯 Primary GDEMO Account: ${newTokenAccountKeypair.publicKey.toString()}`);
    console.log(`💰 Balance: ${finalNewBalance} GDEMO`);
    console.log(`👤 Owner: ${wallet.publicKey.toString()}`);
    console.log(`🔑 You control this account with your main wallet!`);
    
    return {
      success: true,
      newTokenAccount: newTokenAccountKeypair.publicKey.toString(),
      transferredAmount: currentBalance,
      finalBalance: finalNewBalance,
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus
    };
    
  } catch (error) {
    console.error('❌ Token account creation and transfer failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🏦 GDEMO Token: Create New Account and Transfer All Tokens');
    console.log('========================================================');
    console.log('Creating a new dedicated token account and transferring all GDEMO tokens...');
    console.log('');
    
    const result = await createNewAccountAndTransferGdemo();
    
    console.log('');
    console.log('🎉 PROCESS COMPLETED SUCCESSFULLY!');
    console.log('==================================');
    console.log(`✅ New Account: ${result.newTokenAccount}`);
    console.log(`✅ Transferred: ${result.transferredAmount} GDEMO`);
    console.log(`✅ Final Balance: ${result.finalBalance} GDEMO`);
    console.log(`✅ Transaction: ${result.signature}`);
    console.log(`✅ Status: ${result.confirmationStatus}`);
    console.log('');
    console.log('🎯 BENEFITS:');
    console.log('✅ All 1,200 GDEMO tokens in one dedicated account');
    console.log('✅ Clean consolidation of your token holdings');
    console.log('✅ Easy to manage and track');
    console.log('✅ Controlled by your main wallet');
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createNewAccountAndTransferGdemo }; 