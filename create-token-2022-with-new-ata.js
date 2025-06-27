const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SystemProgram,
} = require('@solana/web3.js');

const {
  createInitializeMintInstruction,
} = require('@solana/spl-token');

const fs = require('fs');

// GorbChain Configuration - HTTP only
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// Program IDs - Using NEW Token-2022 compatible ATA program
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const NEW_ATA_PROGRAM_ID = new PublicKey('BWBbPGpceCtFCUuMFjYUYpHEnagcT58bNi9c44VJ4rkW'); // NEW!
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const RENT_PROGRAM_ID = new PublicKey('SysvarRent111111111111111111111111111111111');

// Token-2022 mint size
const TOKEN_2022_MINT_SIZE = 82;

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

// Derive ATA address using NEW ATA program
function getAssociatedTokenAddress(mint, owner) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), CUSTOM_TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    NEW_ATA_PROGRAM_ID
  );
  return address;
}

// Create ATA instruction using NEW ATA program - CORRECTED FORMAT
function createAssociatedTokenAccountInstruction(payer, associatedToken, owner, mint) {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },        // 0. [writeable,signer] Funding account
      { pubkey: associatedToken, isSigner: false, isWritable: true }, // 1. [writeable] Associated token account
      { pubkey: owner, isSigner: false, isWritable: false },      // 2. [] Wallet address
      { pubkey: mint, isSigner: false, isWritable: false },       // 3. [] Token mint
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false }, // 4. [] System program
      { pubkey: CUSTOM_TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // 5. [] SPL Token program
    ],
    programId: NEW_ATA_PROGRAM_ID,
    data: Buffer.from([0]), // Create instruction = 0
  });
}

async function createToken2022WithNewATA() {
  try {
    const wallet = loadKeypair();
    
    console.log('🚀 Creating Token-2022 with NEW Token-2022 Compatible ATA...');
    console.log(`💼 Using wallet: ${wallet.publicKey.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔗 NEW ATA Program: ${NEW_ATA_PROGRAM_ID.toString()} (Token-2022 Compatible)`);
    console.log(`🌐 RPC: ${RPC_ENDPOINT}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🪙 New Token mint: ${mintKeypair.publicKey.toString()}`);

    // Token metadata
    const tokenMetadata = {
      name: "GorbChain Supreme Token",
      symbol: "GSUP",
      description: "The supreme token for GorbChain with proper Token-2022 compatible ATA support",
      decimals: 9,
      totalSupply: 1000000,
      creator: "GorbChain Foundation",
      category: "Supreme",
      features: ["Token-2022 Compatible ATA", "Proper Implementation", "GorbChain Native"],
      website: "https://gorbchain.xyz",
      twitter: "@gorbchain",
      telegram: "t.me/gorbchain",
      createdAt: new Date().toISOString(),
      network: "GorbChain",
      version: "2022-proper-ata-final",
      ataSupported: true,
      ataProgramId: NEW_ATA_PROGRAM_ID.toString()
    };

    console.log('📋 Token Metadata:');
    console.log(`   🪙 Name: ${tokenMetadata.name}`);
    console.log(`   🏷️ Symbol: ${tokenMetadata.symbol}`);
    console.log(`   🔢 Decimals: ${tokenMetadata.decimals}`);
    console.log(`   💰 Total Supply: ${tokenMetadata.totalSupply.toLocaleString()}`);
    console.log(`   🔗 ATA: NEW Token-2022 Compatible Program`);

    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_MINT_SIZE);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    // Create transaction
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });

    transaction.add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: TOKEN_2022_MINT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize mint
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenMetadata.decimals,
        wallet.publicKey,
        wallet.publicKey,
        CUSTOM_TOKEN_2022_PROGRAM_ID
      )
    );

    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet, mintKeypair);

    // Send transaction manually
    console.log('📤 Sending mint creation transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log(`📋 Transaction signature: ${signature}`);
    console.log('⏳ Confirming transaction...');

    // Manually confirm transaction
    const confirmationStatus = await confirmTransaction(signature);

    console.log('✅ Token mint created successfully!');
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    
    // Save mint information
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: wallet.publicKey.toString(),
      decimals: tokenMetadata.decimals,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      ataProgramId: NEW_ATA_PROGRAM_ID.toString(),
      signature: signature,
      metadata: tokenMetadata,
      createdAt: new Date().toISOString(),
      type: 'token-2022-new-ata-final'
    };

    fs.writeFileSync('token-2022-new-ata-final.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 Token info saved to token-2022-new-ata-final.json');

    return mintInfo;

  } catch (error) {
    console.error('❌ Error creating token:', error.message);
    throw error;
  }
}

async function transferWithNewATA(mintInfo, recipient, amount) {
  try {
    const wallet = loadKeypair();
    const recipientPubkey = new PublicKey(recipient);
    const mintAddress = new PublicKey(mintInfo.mintAddress);
    
    console.log('\n🚀 Transferring with NEW Token-2022 Compatible ATA...');
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    
    // Calculate ATA address
    const ataAddress = getAssociatedTokenAddress(mintAddress, recipientPubkey);
    console.log(`🏦 ATA Address: ${ataAddress.toString()}`);
    
    // Get recent blockhash
    console.log('🔍 Getting recent blockhash...');
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    });
    
    // Check if ATA exists
    console.log('🔍 Checking if ATA exists...');
    const ataAccount = await connection.getAccountInfo(ataAddress);
    if (!ataAccount) {
      console.log('🔧 Creating ATA with NEW Token-2022 compatible program...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ataAddress,
          recipientPubkey,
          mintAddress
        )
      );
    } else {
      console.log('✅ ATA already exists');
    }
    
    // Mint tokens to ATA
    const mintAmount = amount * Math.pow(10, mintInfo.decimals);
    const mintData = Buffer.alloc(9);
    mintData[0] = 7; // MintTo instruction
    mintData.writeBigUInt64LE(BigInt(mintAmount), 1);
    
    transaction.add(new TransactionInstruction({
      keys: [
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: ataAddress, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      data: mintData,
    }));
    
    // Sign transaction
    console.log('✍️ Signing transaction...');
    transaction.sign(wallet);
    
    // Send transaction manually
    console.log('📤 Sending NEW ATA transfer transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    
    console.log(`📋 Transaction signature: ${signature}`);
    console.log('⏳ Confirming transaction...');
    
    // Manually confirm transaction
    const confirmationStatus = await confirmTransaction(signature);
    
    console.log('✅ SUCCESS! NEW Token-2022 Compatible ATA transfer completed!');
    console.log('=' .repeat(70));
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`📊 Status: ${confirmationStatus.confirmationStatus}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`🏦 ATA Address: ${ataAddress.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔗 ATA Program: ${NEW_ATA_PROGRAM_ID.toString()} (NEW Token-2022 Compatible)`);
    console.log(`🌐 Network: GorbChain (Proper Token-2022 + ATA)`);
    console.log(`🎯 THIS IS THE CORRECT TOKEN-2022 + ATA IMPLEMENTATION!`);
    console.log('=' .repeat(70));
    
    // Save transfer details
    const transferInfo = {
      signature: signature,
      confirmationStatus: confirmationStatus.confirmationStatus,
      recipient: recipient,
      ataAddress: ataAddress.toString(),
      mintAddress: mintAddress.toString(),
      amount: amount,
      decimals: mintInfo.decimals,
      timestamp: new Date().toISOString(),
      method: 'token-2022-proper-ata-final',
      tokenSymbol: mintInfo.metadata.symbol,
      tokenName: mintInfo.metadata.name,
      ataProgramId: NEW_ATA_PROGRAM_ID.toString(),
      explorerUrl: `https://explorer.gorbchain.xyz/tx/${signature}`,
      isProperImplementation: true
    };
    
    const filename = `proper-token-2022-ata-transfer-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(transferInfo, null, 2));
    console.log(`💾 Transfer details saved to ${filename}`);
    
    return {
      signature,
      ataAddress: ataAddress.toString(),
      amount,
      recipient,
      mint: mintAddress.toString(),
      confirmationStatus: confirmationStatus.confirmationStatus,
      isProperImplementation: true
    };
    
  } catch (error) {
    console.error('❌ NEW ATA transfer failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🎯 Creating Token-2022 with PROPER ATA Support (FINAL IMPLEMENTATION)...');
    console.log(`🔗 Using NEW Token-2022 Compatible ATA: ${NEW_ATA_PROGRAM_ID.toString()}`);
    
    // Step 1: Create the token
    const mintInfo = await createToken2022WithNewATA();
    
    // Step 2: Transfer with proper ATA
    const recipient = '5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ';
    const amount = 750;
    
    console.log('\n⏳ Waiting 3 seconds before transfer...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const transferResult = await transferWithNewATA(mintInfo, recipient, amount);
    
    console.log('\n🎊 COMPLETE SUCCESS WITH PROPER TOKEN-2022 + ATA!');
    console.log(`✅ Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`✅ Mint: ${mintInfo.mintAddress}`);
    console.log(`✅ ATA: ${transferResult.ataAddress}`);
    console.log(`✅ Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log(`✅ Method: PROPER Token-2022 + ATA Implementation`);
    console.log(`✅ Status: ${transferResult.confirmationStatus}`);
    console.log(`✅ ATA Program: ${NEW_ATA_PROGRAM_ID.toString()}`);
    console.log(`🎯 This is the CORRECT and PROPER way to use Token-2022 with ATA!`);
    
  } catch (error) {
    console.error('\n💥 Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  createToken2022WithNewATA, 
  transferWithNewATA,
  getAssociatedTokenAddress,
  NEW_ATA_PROGRAM_ID,
  CUSTOM_TOKEN_2022_PROGRAM_ID
}; 