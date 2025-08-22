

import { StatusBar, StyleSheet, useColorScheme, View, Button, Text, Linking } from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import MetaKeep from 'metakeep-react-native-sdk';
import React from 'react';
import { Buffer } from 'buffer';
import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';

// Your Solana app id here
const METAKEEP_APP_ID = '';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

let sdk: MetaKeep | null = null;

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [walletInfo, setWalletInfo] = React.useState<any | null>(null);
  const [lastLog, setLastLog] = React.useState<string>('');
  const [lastSignature, setLastSignature] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sdk) {
      try {
        sdk = new MetaKeep(METAKEEP_APP_ID);
        setLastLog('MetaKeep SDK initialized');
      } catch (e: any) {
        setLastLog(`SDK init error: ${e?.message || String(e)}`);
      }
    }
  }, []);

  const getWallet = async () => {
    try {
      if (!sdk) throw new Error('SDK not initialized');
      setLastLog('Requesting wallet...');
      const response: any = await sdk.getWallet();
      setWalletInfo(response.wallet);
      setLastLog(` Wallet connected!\nAddress: ${response.wallet.solAddress}`);
    } catch (err: any) {
      setLastLog(` Wallet error: ${err?.status || err?.message || String(err)}`);
    }
  };

  const toHex = (bytes: Uint8Array) => '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const openSolscan = async (signature: string) => {
    const solscanUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;
    try {
      await Linking.openURL(solscanUrl);
    } catch (e) {
      console.log('Could not open Solscan:', e);
    }
  };

  const signAndSend1SOL = async () => {
    try {
      if (!sdk) throw new Error('SDK not initialized');
      if (!walletInfo?.solAddress) throw new Error('Connect wallet first');

      setLastLog('Building transaction...');

      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const feePayer = new PublicKey(walletInfo.solAddress);
      const recipient = new PublicKey('BCf7PuGsv2yQFRJ9GATZafg4L4LrV6vkfYwmS3jVREvM');

      const { blockhash } = await connection.getLatestBlockhash();

      const transferIx = SystemProgram.transfer({
        fromPubkey: feePayer,
        toPubkey: recipient,
        lamports: 1_000_000, // 0.001 SOL
      });

      const computeIxs = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
      ];

      const messageV0 = new TransactionMessage({
        payerKey: feePayer,
        recentBlockhash: blockhash,
        instructions: [...computeIxs, transferIx],
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);

      // Serialized transaction message in hex format.
      // This is the data that needs to be signed
      const serializedTransactionMessage = toHex(tx.message.serialize());

      setLastLog('Requesting signature...');
      await new Promise(r => setTimeout(r, 0));
      const signResp: any = await sdk.signTransaction(
        { serializedTransactionMessage },
        'transfer 1 SOL',
      );

      const signatureHex: string = signResp.signature;
      const signature = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');

      tx.addSignature(feePayer, signature);

      const rawTx = Buffer.from(tx.serialize());
      setLastLog('Broadcasting transaction...');
      const sig = await connection.sendRawTransaction(rawTx, { skipPreflight: true });
      setLastSignature(sig);
      setLastLog(` Sent! Signature: ${sig}`);
      
      // Open Solscan in browser
      // await openSolscan(sig); // Removed auto-opening
    } catch (err: any) {
      setLastLog(` Error: ${err?.status || err?.message || String(err)}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SVM Transaction Demo</Text>
        <Text style={styles.subtitle}>MetaKeep Wallet Only</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Button
            title={walletInfo ? " Wallet Connected" : " Connect Wallet"}
            onPress={getWallet}
            disabled={!!walletInfo}
          />

          {walletInfo && (
            <View style={styles.walletInfo}>
              <Text style={styles.walletAddress} selectable>
                {walletInfo.solAddress}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Button title="Sign & Send 0.001 SOL" onPress={signAndSend1SOL} disabled={!walletInfo} />
        </View>

        {lastSignature && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Explorer</Text>
            <Text
              style={styles.signatureLink}
              onPress={() => openSolscan(lastSignature!)}
            >
              View on Solscan
            </Text>
          </View>
        )}

        <View style={styles.logContainer}>
          <Text style={styles.logText} selectable>
            {lastLog || 'Ready to connect wallet'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  walletInfo: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  walletAddress: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#007AFF',
    textAlign: 'center',
    lineHeight: 20,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  logContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    minHeight: 200,
  },
  logText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 22,
  },
  signatureLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111',
  },
});

export default App;
