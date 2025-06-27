const {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
});

// Custom Program IDs for GorbChain
const CUSTOM_TOKEN_PROGRAM_ID = new PublicKey('8drSBwhdQQTQs68pAddfWyXPv8CA4JhFAY2QRAxwLmSS');

async function verifyTokenAccount() {
  try {
    console.log('🔍 Verifying Token Account on GorbChain...');
    
    // Load token account info
    const accountData = JSON.parse(fs.readFileSync('token-account-info.json', 'utf8'));
    const tokenAccount = new PublicKey(accountData.tokenAccount);
    const owner = new PublicKey(accountData.owner);
    const mint = new PublicKey(accountData.mint);
    
    console.log(`🏦 Token Account: ${tokenAccount.toString()}`);
    console.log(`👤 Owner: ${owner.toString()}`);
    console.log(`🪙 Mint: ${mint.toString()}`);
    console.log(`📊 Expected Amount: ${accountData.amount} tokens`);
    console.log(`🔗 Creation Transaction: ${accountData.signature}`);
    
    console.log('\n' + '=' .repeat(60));
    
    // Check if the account exists
    console.log('🔍 Checking account existence...');
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    
    if (!accountInfo) {
      console.log('❌ Token account does not exist!');
      return;
    }
    
    console.log('✅ Token account exists!');
    console.log(`💰 Account Lamports: ${accountInfo.lamports / LAMPORTS_PER_SOL} SOL`);
    console.log(`👨‍💻 Account Owner: ${accountInfo.owner.toString()}`);
    console.log(`📊 Account Data Length: ${accountInfo.data.length} bytes`);
    console.log(`🔒 Account Executable: ${accountInfo.executable}`);
    
    // Check if it's owned by our token program
    if (accountInfo.owner.equals(CUSTOM_TOKEN_PROGRAM_ID)) {
      console.log('✅ Account is owned by our custom token program!');
    } else {
      console.log(`❌ Account is owned by ${accountInfo.owner.toString()} (expected ${CUSTOM_TOKEN_PROGRAM_ID.toString()})`);
    }
    
    // Parse token account data manually
    console.log('\n🔍 Parsing token account data...');
    if (accountInfo.data.length >= 165) { // Standard token account size
      const data = accountInfo.data;
      
      // Parse the token account structure
      // Mint (32 bytes) + Owner (32 bytes) + Amount (8 bytes) + ...
      const mintFromData = new PublicKey(data.slice(0, 32));
      const ownerFromData = new PublicKey(data.slice(32, 64));
      
      // Amount is stored as little-endian 64-bit integer
      const amountBytes = data.slice(64, 72);
      let amount = 0n;
      for (let i = 0; i < 8; i++) {
        amount += BigInt(amountBytes[i]) << (BigInt(i) * 8n);
      }
      
      console.log(`🪙 Mint from data: ${mintFromData.toString()}`);
      console.log(`👤 Owner from data: ${ownerFromData.toString()}`);
      console.log(`💰 Raw amount: ${amount.toString()}`);
      console.log(`💰 Token amount: ${Number(amount) / Math.pow(10, 9)} tokens`);
      
      // Verify the data matches what we expect
      if (mintFromData.equals(mint)) {
        console.log('✅ Mint address matches!');
      } else {
        console.log('❌ Mint address mismatch!');
      }
      
      if (ownerFromData.equals(owner)) {
        console.log('✅ Owner address matches!');
      } else {
        console.log('❌ Owner address mismatch!');
      }
      
      if (Number(amount) > 0) {
        console.log('✅ Account has token balance!');
      } else {
        console.log('❌ Account has zero balance!');
      }
      
    } else {
      console.log('❌ Account data is too small to be a token account');
    }
    
    // Try to get the transaction details
    console.log('\n🔍 Checking transaction details...');
    try {
      const txInfo = await connection.getTransaction(accountData.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (txInfo) {
        console.log('✅ Transaction found!');
        console.log(`📅 Block Time: ${new Date(txInfo.blockTime * 1000).toISOString()}`);
        console.log(`🔍 Slot: ${txInfo.slot}`);
        console.log(`💸 Fee: ${txInfo.meta.fee / LAMPORTS_PER_SOL} SOL`);
        
        if (txInfo.meta.err) {
          console.log(`❌ Transaction Error: ${JSON.stringify(txInfo.meta.err)}`);
        } else {
          console.log('✅ Transaction successful!');
        }
      } else {
        console.log('❌ Transaction not found');
      }
    } catch (txError) {
      console.log(`❌ Error fetching transaction: ${txError.message}`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Verification completed!');
    
  } catch (error) {
    console.error('❌ Error verifying token account:', error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  verifyTokenAccount()
    .then(() => {
      console.log('\n✅ Verification completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error.message);
      process.exit(1);
    });
}

module.exports = { verifyTokenAccount }; 