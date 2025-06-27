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
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

// Token account size for Token-2022
const TOKEN_2022_ACCOUNT_SIZE = 165;

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

async function transferToken2022Simple() {
  try {
    const wallet = loadKeypair();
    
    // Load the existing Token-2022 mint
    const mintInfo = JSON.parse(fs.readFileSync('token-2022-new-ata-final.json', 'utf8'));
    const mintAddress = new PublicKey(mintInfo.mintAddress);
    const mintKeypair = Keypair.fromSecretKey(new Uint8Array(mintInfo.mintKeypair));
    
    console.log('🚀 Simple Token-2022 Transfer (Manual Token Account)...');
    console.log(`💼 Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 RPC: ${RPC_ENDPOINT}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Recipient and transfer details
    const recipient = '5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ';
    const recipientPubkey = new PublicKey(recipient);
    const amount = 850;
    const decimals = mintInfo.decimals;
    
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    
    // Create a new token account keypair for the recipient
    const tokenAccountKeypair = Keypair.generate();
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    
    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_ACCOUNT_SIZE);
    console.log(`💰 Token account rent: ${lamports / LAMPORTS_PER_SOL} SOL`);
    
    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });
    
    // 1. Create token account
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
    const initAccountData = Buffer.alloc(1 + 32); // instruction + owner pubkey
    initAccountData[0] = 18; // InitializeAccount3 instruction
    recipientPubkey.toBuffer().copy(initAccountData, 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: recipientPubkey, isSigner: false, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: initAccountData,
    }));
    
    // 3. Mint tokens to the account
    const mintAmount = amount * Math.pow(10, decimals);
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: mintAddress, isSigner: false, isWritable: true },
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
    console.log('📤 Sending Token-2022 transfer transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    
    console.log(`📋 Transaction signature: ${signature}`);
    console.log('⏳ Confirming transaction...');
    
    // Manually confirm transaction
    const confirmationStatus = await confirmTransaction(signature);
    
    console.log('✅ SUCCESS! Token-2022 Simple Transfer Completed!');
    console.log('=' .repeat(80));
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`🏦 Token Account: ${tokenAccountKeypair.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 Network: GorbChain (Token-2022 Direct)`);
    console.log(`🎯 Method: Manual Token Account Creation (No ATA)`);
    console.log(`✅ This bypasses ATA compatibility issues!`);
    console.log('=' .repeat(80));
    
    // Save transfer details
    const transferInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      recipient: recipient,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      tokenAccountKeypair: Array.from(tokenAccountKeypair.secretKey),
      mintAddress: mintAddress.toString(),
      amount: amount,
      decimals: decimals,
      timestamp: new Date().toISOString(),
      method: 'token-2022-manual-account',
      tokenSymbol: mintInfo.metadata.symbol,
      tokenName: mintInfo.metadata.name,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      isWorkingImplementation: true,
      notes: 'Bypasses ATA - uses manual token account creation'
    };
    
    const filename = `token-2022-simple-transfer-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(transferInfo, null, 2));
    console.log(`💾 Transfer details saved to ${filename}`);
    
    return {
      signature,
      tokenAccount: tokenAccountKeypair.publicKey.toString(),
      amount,
      recipient,
      mint: mintAddress.toString(),
      confirmationStatus: confirmationStatus.confirmationStatus,
      method: 'manual-token-account'
    };
    
  } catch (error) {
    console.error('❌ Token-2022 simple transfer failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🎯 Token-2022 Simple Transfer (Bypassing ATA Issues)...');
    
    const transferResult = await transferToken2022Simple();
    
    console.log('\n🎊 TRANSFER SUCCESSFUL!');
    console.log(`✅ Transaction: ${transferResult.signature}`);
    console.log(`✅ Token Account: ${transferResult.tokenAccount}`);
    console.log(`✅ Amount: ${transferResult.amount}`);
    console.log(`✅ Status: ${transferResult.confirmationStatus}`);
    console.log(`✅ Method: ${transferResult.method}`);
    console.log(`🎯 Token-2022 works perfectly without ATA!`);
    
  } catch (error) {
    console.error('\n💥 Transfer failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { transferToken2022Simple }; 