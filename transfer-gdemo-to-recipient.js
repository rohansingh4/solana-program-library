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

// Your GDEMO token details
const GDEMO_MINT = '6MN2kWzHayVLLwXj54dHE2sxWoBFGVvN8rGZeKXPbePD';
const YOUR_GDEMO_ACCOUNT = '3jDUFDoro4TzysCYCrdn7rYN1i1XjWAbxagNzzyvFrGx'; // Your primary GDEMO account

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

async function transferGdemoTokens(recipientWallet, amountToTransfer) {
  try {
    const wallet = loadKeypair();
    const mintAddress = new PublicKey(GDEMO_MINT);
    const yourTokenAccount = new PublicKey(YOUR_GDEMO_ACCOUNT);
    const recipientWalletPubkey = new PublicKey(recipientWallet);
    
    console.log('📤 Transferring GDEMO Tokens to Recipient');
    console.log('=========================================');
    console.log(`💼 Your Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🎯 Recipient Wallet: ${recipientWalletPubkey.toString()}`);
    console.log(`🪙 GDEMO Mint: ${mintAddress.toString()}`);
    console.log(`🏦 Your Token Account: ${yourTokenAccount.toString()}`);
    console.log(`💰 Amount to Transfer: ${amountToTransfer} GDEMO`);
    console.log('');
    
    // Check your current balance
    const yourBalance = await getTokenBalance(yourTokenAccount.toString());
    console.log(`💰 Your Current GDEMO Balance: ${yourBalance} GDEMO`);
    
    if (yourBalance < amountToTransfer) {
      throw new Error(`Insufficient GDEMO tokens! You have ${yourBalance} but trying to send ${amountToTransfer}`);
    }
    
    if (yourBalance === 0) {
      throw new Error('No GDEMO tokens to transfer!');
    }
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Your SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create a token account for the recipient
    const recipientTokenAccountKeypair = Keypair.generate();
    console.log(`🏦 Creating Token Account for Recipient: ${recipientTokenAccountKeypair.publicKey.toString()}`);
    console.log('');
    
    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });
    
    // Step 1: Create token account for recipient
    console.log('🔧 Step 1: Creating token account for recipient...');
    
    // Get rent exemption amount
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);
    console.log(`💰 Token account rent: ${lamports / LAMPORTS_PER_SOL} SOL`);
    
    // Create recipient's token account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: recipientTokenAccountKeypair.publicKey,
        space: TOKEN_2022_ACCOUNT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );
    
    // Initialize recipient's token account (recipient owns it)
    const initAccountData = Buffer.alloc(1 + 32);
    initAccountData[0] = 18; // InitializeAccount3 instruction
    recipientWalletPubkey.toBuffer().copy(initAccountData, 1); // Recipient is the owner
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: recipientTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: recipientWalletPubkey, isSigner: false, isWritable: false }, // Recipient is the owner
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: initAccountData,
    }));
    
    // Step 2: Transfer tokens from your account to recipient's account
    console.log('🔧 Step 2: Transferring GDEMO tokens to recipient...');
    const transferAmount = amountToTransfer * Math.pow(10, 6); // 6 decimals for GDEMO
    
    const transferData = Buffer.alloc(9);
    transferData[0] = 3; // Transfer instruction
    transferData.writeBigUInt64LE(BigInt(transferAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: yourTokenAccount, isSigner: false, isWritable: true }, // Your account (source)
        { pubkey: recipientTokenAccountKeypair.publicKey, isSigner: false, isWritable: true }, // Recipient account (destination)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // You are the owner/authority
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: transferData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, recipientTokenAccountKeypair);
    
    // Send transaction
    console.log('📤 Sending GDEMO transfer transaction...');
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
    console.log('✅ SUCCESS! GDEMO Tokens Transferred!');
    console.log('=' .repeat(80));
    console.log(`🎯 Token: GorbChain Demo Token (GDEMO)`);
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount Transferred: ${amountToTransfer} GDEMO`);
    console.log(`👤 From: ${wallet.publicKey.toString()}`);
    console.log(`🎯 To: ${recipientWalletPubkey.toString()}`);
    console.log(`🏦 Your Token Account: ${yourTokenAccount.toString()}`);
    console.log(`🏦 Recipient Token Account: ${recipientTokenAccountKeypair.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log('=' .repeat(80));
    
    // Verify balances
    console.log('🔍 Verifying final balances...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const yourFinalBalance = await getTokenBalance(yourTokenAccount.toString());
    const recipientFinalBalance = await getTokenBalance(recipientTokenAccountKeypair.publicKey.toString());
    
    console.log(`✅ Your Remaining Balance: ${yourFinalBalance} GDEMO`);
    console.log(`✅ Recipient Balance: ${recipientFinalBalance} GDEMO`);
    
    // Save transfer info
    const transferInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      sender: wallet.publicKey.toString(),
      recipient: recipientWalletPubkey.toString(),
      senderTokenAccount: yourTokenAccount.toString(),
      recipientTokenAccount: recipientTokenAccountKeypair.publicKey.toString(),
      recipientTokenAccountKeypair: Array.from(recipientTokenAccountKeypair.secretKey),
      mintAddress: mintAddress.toString(),
      transferredAmount: amountToTransfer,
      senderFinalBalance: yourFinalBalance,
      recipientFinalBalance: recipientFinalBalance,
      decimals: 6,
      timestamp: new Date().toISOString(),
      method: 'gdemo-transfer-to-recipient',
      tokenSymbol: 'GDEMO',
      tokenName: 'GorbChain Demo Token',
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      notes: `Transferred ${amountToTransfer} GDEMO tokens to ${recipientWalletPubkey.toString()}`
    };
    
    const filename = `gdemo-transfer-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(transferInfo, null, 2));
    console.log(`💾 Transfer info saved to ${filename}`);
    
    console.log('');
    console.log('🎊 GDEMO TRANSFER COMPLETED! 🎊');
    console.log(`📤 Sent: ${amountToTransfer} GDEMO`);
    console.log(`👤 From: ${wallet.publicKey.toString()}`);
    console.log(`🎯 To: ${recipientWalletPubkey.toString()}`);
    console.log(`🏦 Recipient's Token Account: ${recipientTokenAccountKeypair.publicKey.toString()}`);
    console.log(`💰 Your Remaining: ${yourFinalBalance} GDEMO`);
    console.log(`💰 Recipient Received: ${recipientFinalBalance} GDEMO`);
    
    return {
      success: true,
      signature: signature,
      recipientTokenAccount: recipientTokenAccountKeypair.publicKey.toString(),
      transferredAmount: amountToTransfer,
      yourRemainingBalance: yourFinalBalance,
      recipientBalance: recipientFinalBalance,
      confirmationStatus: confirmationStatus.confirmationStatus
    };
    
  } catch (error) {
    console.error('❌ GDEMO transfer failed:', error.message);
    throw error;
  }
}

// Main execution with CLI interface
async function main() {
  try {
    console.log('📤 GDEMO Token Transfer Tool');
    console.log('============================');
    console.log('Transfer GDEMO tokens from your account to another wallet');
    console.log('');
    
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('❌ Usage: node transfer-gdemo-to-recipient.js <recipient_wallet> <amount>');
      console.log('');
      console.log('📋 Examples:');
      console.log('   node transfer-gdemo-to-recipient.js 5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ 100');
      console.log('   node transfer-gdemo-to-recipient.js 7aT3Pcyqfp1WShBYfdQkEJQzvShuo1aVaDVWrXqAdP5r 500');
      console.log('');
      console.log('💡 Your current GDEMO account: 3jDUFDoro4TzysCYCrdn7rYN1i1XjWAbxagNzzyvFrGx');
      console.log('💡 Your wallet: Gmhpm85fByXJ3UQH7LqJkibW2bGLz5Diatute2YNM7ny');
      process.exit(1);
    }
    
    const recipientWallet = args[0];
    const amount = parseFloat(args[1]);
    
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    
    console.log(`🎯 Recipient: ${recipientWallet}`);
    console.log(`💰 Amount: ${amount} GDEMO`);
    console.log('');
    
    // Validate recipient wallet
    try {
      new PublicKey(recipientWallet);
    } catch (error) {
      throw new Error('Invalid recipient wallet address');
    }
    
    const result = await transferGdemoTokens(recipientWallet, amount);
    
    console.log('');
    console.log('🎉 TRANSFER COMPLETED SUCCESSFULLY!');
    console.log('===================================');
    console.log(`✅ Recipient Token Account: ${result.recipientTokenAccount}`);
    console.log(`✅ Amount Sent: ${result.transferredAmount} GDEMO`);
    console.log(`✅ Your Remaining: ${result.yourRemainingBalance} GDEMO`);
    console.log(`✅ Recipient Received: ${result.recipientBalance} GDEMO`);
    console.log(`✅ Transaction: ${result.signature}`);
    console.log(`✅ Status: ${result.confirmationStatus}`);
    
  } catch (error) {
    console.error('\n💥 Transfer failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { transferGdemoTokens }; 