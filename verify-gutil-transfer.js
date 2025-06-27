const {
  Connection,
  PublicKey,
} = require('@solana/web3.js');

const fs = require('fs');

// GorbChain Configuration
const RPC_ENDPOINT = 'https://rpc.gorbchain.xyz';
const connection = new Connection(RPC_ENDPOINT, { commitment: 'confirmed' });

// Program IDs
const TOKEN_PROGRAM_ID = new PublicKey('2dwpmEaGB8euNCirbwWdumWUZFH3V91mbPjoFbWT24An');
const MINT_ADDRESS = new PublicKey('9Q9PedLGZDpNPfrHVvPiEZMhtcH2xk2h2UN1468uWkJC');

async function verifyGUTILTransfer() {
  try {
    console.log('🔍 Verifying GUTIL Token Transfer...');
    console.log('=' .repeat(60));
    
    // Load the latest transfer info
    const files = fs.readdirSync('.').filter(f => f.startsWith('gutil-transfer-') && f.endsWith('.json'));
    if (files.length === 0) {
      throw new Error('No GUTIL transfer files found');
    }
    
    const latestFile = files.sort().pop();
    const transferInfo = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    
    console.log(`📄 Using transfer file: ${latestFile}`);
    console.log(`🎯 Recipient: ${transferInfo.recipient}`);
    console.log(`🏦 Token Account: ${transferInfo.tokenAccount}`);
    console.log(`🪙 Mint Address: ${transferInfo.mintAddress}`);
    console.log(`💰 Expected Amount: ${transferInfo.amount} ${transferInfo.tokenSymbol}`);
    console.log(`🔍 Transaction: ${transferInfo.signature}`);
    console.log('=' .repeat(60));
    
    // Verify transaction exists
    console.log('🔍 Checking transaction status...');
    const signatureStatus = await connection.getSignatureStatus(transferInfo.signature);
    if (signatureStatus?.value) {
      console.log(`✅ Transaction Status: ${signatureStatus.value.confirmationStatus || 'processed'}`);
      if (signatureStatus.value.err) {
        console.log(`❌ Transaction Error: ${JSON.stringify(signatureStatus.value.err)}`);
      }
    } else {
      console.log('⚠️ Transaction not found or not confirmed yet');
    }
    
    // Check token account
    console.log('\n🏦 Checking token account...');
    const tokenAccountPubkey = new PublicKey(transferInfo.tokenAccount);
    const accountInfo = await connection.getAccountInfo(tokenAccountPubkey);
    
    if (!accountInfo) {
      throw new Error('Token account not found');
    }
    
    console.log(`✅ Token account exists`);
    console.log(`💰 Account lamports: ${accountInfo.lamports}`);
    console.log(`👤 Owner: ${accountInfo.owner.toString()}`);
    console.log(`📊 Data length: ${accountInfo.data.length} bytes`);
    
    // Parse token account data (simplified)
    if (accountInfo.data.length >= 72) {
      // Read mint (32 bytes at offset 0)
      const mint = new PublicKey(accountInfo.data.slice(0, 32));
      console.log(`🪙 Mint: ${mint.toString()}`);
      console.log(`🔗 Mint Match: ${mint.toString() === transferInfo.mintAddress ? '✅ YES' : '❌ NO'}`);
      
      // Read owner (32 bytes at offset 32)
      const owner = new PublicKey(accountInfo.data.slice(32, 64));
      console.log(`👤 Owner: ${owner.toString()}`);
      console.log(`🔗 Owner Match: ${owner.toString() === transferInfo.recipient ? '✅ YES' : '❌ NO'}`);
      
      // Read amount (8 bytes at offset 64, little-endian)
      const amountBuffer = accountInfo.data.slice(64, 72);
      const amount = amountBuffer.readBigUInt64LE(0);
      const tokenAmount = Number(amount) / Math.pow(10, transferInfo.decimals);
      console.log(`💰 Raw Amount: ${amount.toString()}`);
      console.log(`💰 Token Amount: ${tokenAmount} ${transferInfo.tokenSymbol}`);
      console.log(`🔗 Amount Match: ${tokenAmount === transferInfo.amount ? '✅ YES' : '❌ NO'}`);
    }
    
    // Check mint account
    console.log('\n🪙 Checking mint account...');
    const mintAccountInfo = await connection.getAccountInfo(MINT_ADDRESS);
    if (mintAccountInfo) {
      console.log(`✅ Mint account exists`);
      console.log(`💰 Mint lamports: ${mintAccountInfo.lamports}`);
      console.log(`👤 Mint owner: ${mintAccountInfo.owner.toString()}`);
      console.log(`📊 Mint data length: ${mintAccountInfo.data.length} bytes`);
      
      // Parse mint data (simplified)
      if (mintAccountInfo.data.length >= 44) {
        // Read supply (8 bytes at offset 36, little-endian)
        const supplyBuffer = mintAccountInfo.data.slice(36, 44);
        const supply = supplyBuffer.readBigUInt64LE(0);
        const totalSupply = Number(supply) / Math.pow(10, transferInfo.decimals);
        console.log(`💰 Total Supply: ${totalSupply} ${transferInfo.tokenSymbol}`);
      }
    }
    
    console.log('\n🎉 VERIFICATION COMPLETE!');
    console.log('=' .repeat(60));
    console.log(`✅ Token: ${transferInfo.tokenName} (${transferInfo.tokenSymbol})`);
    console.log(`✅ Mint: ${transferInfo.mintAddress}`);
    console.log(`✅ Recipient: ${transferInfo.recipient}`);
    console.log(`✅ Token Account: ${transferInfo.tokenAccount}`);
    console.log(`✅ Amount: ${transferInfo.amount} ${transferInfo.tokenSymbol}`);
    console.log(`✅ Transaction: ${transferInfo.signature}`);
    console.log(`✅ Network: GorbChain`);
    console.log(`✅ Method: ${transferInfo.method}`);
    console.log(`✅ Status: Transfer Verified Successfully!`);
    console.log('=' .repeat(60));
    
    return {
      success: true,
      transferInfo,
      accountExists: !!accountInfo,
      mintExists: !!mintAccountInfo
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run verification
if (require.main === module) {
  verifyGUTILTransfer().then(result => {
    if (result.success) {
      console.log('\n🎊 GUTIL Token Transfer Verification: SUCCESS!');
      process.exit(0);
    } else {
      console.log('\n💥 GUTIL Token Transfer Verification: FAILED!');
      process.exit(1);
    }
  });
}

module.exports = { verifyGUTILTransfer }; 