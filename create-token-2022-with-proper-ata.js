const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} = require('@solana/web3.js');

const {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} = require('@solana/spl-token');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { 
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// Program IDs - Let's try with STANDARD Solana ATA program
const CUSTOM_TOKEN_2022_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const STANDARD_ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'); // Standard Solana ATA
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const RENT_PROGRAM_ID = new PublicKey('SysvarRent111111111111111111111111111111111');

// Token-2022 mint size
const TOKEN_2022_MINT_SIZE = 82;

// Load wallet
function loadKeypair() {
  const keypairData = JSON.parse(fs.readFileSync('wallet-keypair.json', 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Derive ATA address using STANDARD ATA program
function getAssociatedTokenAddress(mint, owner) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), CUSTOM_TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    STANDARD_ATA_PROGRAM_ID
  );
  return address;
}

// Create ATA instruction using STANDARD ATA program
function createAssociatedTokenAccountInstruction(
  payer,
  associatedToken,
  owner,
  mint
) {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: CUSTOM_TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: RENT_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: STANDARD_ATA_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

async function createToken2022WithProperATA() {
  try {
    const wallet = loadKeypair();
    
    console.log('🚀 Creating Token-2022 with PROPER ATA Support...');
    console.log(`💼 Using wallet: ${wallet.publicKey.toString()}`);
    console.log(`🔧 Token Program: ${CUSTOM_TOKEN_2022_PROGRAM_ID.toString()}`);
    console.log(`🔗 ATA Program: ${STANDARD_ATA_PROGRAM_ID.toString()} (Standard Solana)`);
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`🪙 New Token mint: ${mintKeypair.publicKey.toString()}`);

    // New token metadata
    const tokenMetadata = {
      name: "GorbChain Premium Token",
      symbol: "GPREM",
      description: "A premium token for GorbChain ecosystem with proper ATA support using Token-2022",
      decimals: 9,
      totalSupply: 1000000,
      creator: "GorbChain Foundation",
      category: "Premium",
      features: ["Proper ATA", "Token-2022", "Standard Compatible"],
      website: "https://gorbchain.xyz",
      twitter: "@gorbchain",
      telegram: "t.me/gorbchain",
      createdAt: new Date().toISOString(),
      network: "GorbChain",
      version: "2022-proper-ata",
      ataSupported: true,
      ataProgramId: STANDARD_ATA_PROGRAM_ID.toString()
    };

    console.log('📋 Token Metadata:');
    console.log(`   🪙 Name: ${tokenMetadata.name}`);
    console.log(`   🏷️ Symbol: ${tokenMetadata.symbol}`);
    console.log(`   🔢 Decimals: ${tokenMetadata.decimals}`);
    console.log(`   💰 Total Supply: ${tokenMetadata.totalSupply.toLocaleString()}`);
    console.log(`   🔗 ATA: Standard Solana ATA Program`);

    // Get minimum balance for rent exemption
    const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_2022_MINT_SIZE);
    console.log(`💰 Rent exemption: ${lamports / LAMPORTS_PER_SOL} SOL`);

    // Create transaction
    const transaction = new Transaction().add(
      // Create mint account
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: TOKEN_2022_MINT_SIZE,
        lamports: lamports,
        programId: CUSTOM_TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize mint with Token-2022 program
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        tokenMetadata.decimals,
        wallet.publicKey, // mint authority
        wallet.publicKey, // freeze authority
        CUSTOM_TOKEN_2022_PROGRAM_ID
      )
    );

    console.log('📤 Sending mint creation transaction...');
    
    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet, mintKeypair],
      { commitment: 'confirmed' }
    );

    console.log('✅ Token mint created successfully!');
    console.log(`🔍 Transaction: ${signature}`);
    
    // Save mint information
    const mintInfo = {
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Array.from(mintKeypair.secretKey),
      mintAuthority: wallet.publicKey.toString(),
      decimals: tokenMetadata.decimals,
      tokenProgramId: CUSTOM_TOKEN_2022_PROGRAM_ID.toString(),
      ataProgramId: STANDARD_ATA_PROGRAM_ID.toString(),
      signature: signature,
      metadata: tokenMetadata,
      createdAt: new Date().toISOString(),
      type: 'token-2022-proper-ata'
    };

    fs.writeFileSync('proper-ata-token-info.json', JSON.stringify(mintInfo, null, 2));
    console.log('💾 Token info saved to proper-ata-token-info.json');

    return mintInfo;

  } catch (error) {
    console.error('❌ Error creating token:', error.message);
    throw error;
  }
}

async function transferWithProperATA(mintInfo, recipient, amount) {
  try {
    const wallet = loadKeypair();
    const recipientPubkey = new PublicKey(recipient);
    const mintAddress = new PublicKey(mintInfo.mintAddress);
    
    console.log('\n🚀 Transferring with PROPER ATA...');
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    
    // Calculate ATA address
    const ataAddress = getAssociatedTokenAddress(mintAddress, recipientPubkey);
    console.log(`🏦 ATA Address: ${ataAddress.toString()}`);
    
    const transaction = new Transaction();
    
    // Check if ATA exists
    console.log('🔍 Checking if ATA exists...');
    const ataAccount = await connection.getAccountInfo(ataAddress);
    if (!ataAccount) {
      console.log('🔧 Creating ATA with standard program...');
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
    
    console.log('📤 Sending ATA transfer transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ SUCCESS! Proper ATA transfer completed!');
    console.log('=' .repeat(60));
    console.log(`🎉 Transaction: ${signature}`);
    console.log(`💰 Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log(`🎯 Recipient: ${recipient}`);
    console.log(`🏦 ATA Address: ${ataAddress.toString()}`);
    console.log(`🪙 Token Mint: ${mintAddress.toString()}`);
    console.log(`🔗 ATA Program: ${STANDARD_ATA_PROGRAM_ID.toString()}`);
    console.log(`🌐 Network: GorbChain (Proper ATA)`);
    console.log('=' .repeat(60));
    
    return {
      signature,
      ataAddress: ataAddress.toString(),
      amount,
      recipient,
      mint: mintAddress.toString()
    };
    
  } catch (error) {
    console.error('❌ ATA transfer failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🎯 Creating Token-2022 with PROPER ATA Support...');
    
    // Step 1: Create the token
    const mintInfo = await createToken2022WithProperATA();
    
    // Step 2: Transfer with proper ATA
    const recipient = '5RcfMNZFw6JeoCR3RPURWvJeLN7bgPVcEHW5wTeX8dTQ';
    const amount = 500;
    
    console.log('\n⏳ Waiting 3 seconds before transfer...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const transferResult = await transferWithProperATA(mintInfo, recipient, amount);
    
    console.log('\n🎊 COMPLETE SUCCESS!');
    console.log(`✅ Token: ${mintInfo.metadata.name} (${mintInfo.metadata.symbol})`);
    console.log(`✅ Mint: ${mintInfo.mintAddress}`);
    console.log(`✅ ATA: ${transferResult.ataAddress}`);
    console.log(`✅ Amount: ${amount} ${mintInfo.metadata.symbol}`);
    console.log(`✅ Method: PROPER ATA with Standard Solana ATA Program`);
    
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
  createToken2022WithProperATA, 
  transferWithProperATA,
  getAssociatedTokenAddress 
}; 