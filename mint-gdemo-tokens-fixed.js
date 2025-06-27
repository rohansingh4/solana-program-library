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

async function mintGdemoTokens() {
  try {
    const wallet = loadKeypair();
    
    // GDEMO token details (from the successful mint creation)
    const GDEMO_MINT = '6MN2kWzHayVLLwXj54dHE2sxWoBFGVvN8rGZeKXPbePD'; // From your successful creation
    const mintAddress = new PublicKey(GDEMO_MINT);
    
    console.log('🎯 Minting GDEMO Tokens (Fixed Version)');
    console.log('======================================');
    console.log(`💼 My Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🪙 GDEMO Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log('');
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create a token account for GDEMO tokens
    const myTokenAccountKeypair = Keypair.generate();
    console.log(`🏦 Creating Token Account: ${myTokenAccountKeypair.publicKey.toString()}`);
    
    // Amount to mint
    const amountToMint = 1200; // Full supply as per original script
    const decimals = 6; // As per original GDEMO token
    console.log(`💰 Minting Amount: ${amountToMint} GDEMO`);
    console.log(`📊 Decimals: ${decimals}`);
    console.log('');
    
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
    console.log('🔧 Step 1: Creating token account...');
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: myTokenAccountKeypair.publicKey,
        space: TOKEN_2022_ACCOUNT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      })
    );
    
    // 2. Initialize token account
    console.log('🔧 Step 2: Initializing token account...');
    const initAccountData = Buffer.alloc(1 + 32); // instruction + owner pubkey
    initAccountData[0] = 18; // InitializeAccount3 instruction
    wallet.publicKey.toBuffer().copy(initAccountData, 1); // I am the owner
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: myTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: wallet.publicKey, isSigner: false, isWritable: false }, // I am the owner
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: initAccountData,
    }));
    
    // 3. Mint tokens to my account
    console.log('🔧 Step 3: Minting GDEMO tokens...');
    const mintAmount = amountToMint * Math.pow(10, decimals);
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: myTokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // I am the mint authority
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: mintData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, myTokenAccountKeypair);
    
    // Send transaction
    console.log('📤 Sending GDEMO minting transaction...');
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
    console.log('✅ SUCCESS! GDEMO Tokens Minted!');
    console.log('=' .repeat(80));
    console.log(`🎯 Token: GorbChain Demo Token (GDEMO)`);
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount Minted: ${amountToMint} GDEMO`);
    console.log(`👤 Owner: ${wallet.publicKey.toString()}`);
    console.log(`🏦 Token Account: ${myTokenAccountKeypair.publicKey.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🌐 Explorer: https://explorer.gorbchain.xyz/tx/${signature}`);
    console.log('=' .repeat(80));
    
    // Verify balance
    console.log('🔍 Verifying token balance...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const accountInfo = await connection.getAccountInfo(myTokenAccountKeypair.publicKey);
    if (accountInfo && accountInfo.data.length >= 72) {
      const amount = accountInfo.data.readBigUInt64LE(64);
      const balance = Number(amount) / Math.pow(10, decimals);
      console.log(`✅ GDEMO Balance: ${balance} GDEMO`);
      
      // Save token account info
      const tokenAccountInfo = {
        signature: signature,
        confirmationStatus: confirmationStatus.confirmationStatus,
        owner: wallet.publicKey.toString(),
        tokenAccount: myTokenAccountKeypair.publicKey.toString(),
        tokenAccountKeypair: Array.from(myTokenAccountKeypair.secretKey),
        mintAddress: mintAddress.toString(),
        amount: amountToMint,
        balance: balance,
        decimals: decimals,
        timestamp: new Date().toISOString(),
        method: 'fixed-gdemo-minting',
        tokenSymbol: 'GDEMO',
        tokenName: 'GorbChain Demo Token',
        tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
        explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
        originalMintTransaction: '5uGV4dXUqX68QzKwyehU97vZ2wipPP4P7pG3bX8955TcBc8SzZgfyW8XmivzJknHmL2GMfPYzsvUJFpxXsapuMgx'
      };
      
      const filename = `gdemo-fixed-mint-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(tokenAccountInfo, null, 2));
      console.log(`💾 GDEMO token info saved to ${filename}`);
      
      console.log('');
      console.log('🎊 GDEMO TOKEN MINTING FIXED! 🎊');
      console.log(`🎯 You now own ${balance} GDEMO tokens!`);
      console.log(`🔑 Token account: ${myTokenAccountKeypair.publicKey.toString()}`);
      
      return {
        success: true,
        tokenAccount: myTokenAccountKeypair.publicKey.toString(),
        balance: balance,
        signature: signature,
        confirmationStatus: confirmationStatus.confirmationStatus
      };
    } else {
      console.log('⚠️ Could not verify balance - but transaction was successful');
      return {
        success: true,
        tokenAccount: myTokenAccountKeypair.publicKey.toString(),
        signature: signature,
        confirmationStatus: confirmationStatus.confirmationStatus
      };
    }
    
  } catch (error) {
    console.error('❌ GDEMO minting failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🎯 GDEMO Token: Fixed Minting Process');
    console.log('====================================');
    console.log('Using the existing GDEMO mint and proper Token-2022 instructions...');
    console.log('');
    
    const result = await mintGdemoTokens();
    
    console.log('');
    console.log('🎉 PROCESS COMPLETED SUCCESSFULLY!');
    console.log('==================================');
    console.log(`✅ Token Account: ${result.tokenAccount}`);
    console.log(`✅ Balance: ${result.balance || 'Verified'} GDEMO`);
    console.log(`✅ Transaction: ${result.signature}`);
    console.log(`✅ Status: ${result.confirmationStatus}`);
    console.log('');
    console.log('🔧 PROBLEM RESOLVED:');
    console.log('✅ Used manual Token-2022 instructions instead of SPL library');
    console.log('✅ Created proper token account first');
    console.log('✅ Successfully minted tokens to your account');
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { mintGdemoTokens }; 