import {
  createNFTMetadataInstruction,
} from '../helpers/instructions';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import {
  getNFTDataKey,
} from '../helpers/accounts';
import * as anchor from '@project-serum/anchor';
import {
  NFTdata,
  CreateNFTMetadataArgs,
  METADATA_SCHEMA,
} from '../helpers/schema';
import { serialize } from 'borsh';
import { getProgramAccounts } from './fetchAll';
import {
  Keypair,
  Connection,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import log from 'loglevel';

export const createNewNFT = async (
  connection: Connection,
  nftProgramAddress: string,
  walletKeypair: Keypair,
  nftData: {
    name: string,
    uri: string,
    price: number,
    ownerNftAddress: PublicKey,
  }
): Promise<{
  nftdataAccount: PublicKey;
} | void> => {
  // Validate heroData
  if (
    !nftData.name ||
    !nftData.uri ||
    isNaN(nftData.price) ||
    !nftData.ownerNftAddress
  ) {
    log.error('Invalid nftData', nftData);
    return;
  }

  log.info(nftData);
  // Create wallet from keypair
  const wallet = new anchor.Wallet(walletKeypair);
  if (!wallet?.publicKey) return;

  const programId = new PublicKey(nftProgramAddress);
  
  const fetchData = await getProgramAccounts(
    connection,
    nftProgramAddress,
    {},
  );

  let newNFTId = fetchData.length + 1;
  log.info(`New NFT Id: ${newNFTId}`);

  const instructions: TransactionInstruction[] = [];
  const signers: anchor.web3.Keypair[] = [/*mint, */walletKeypair];

  // Create metadata
  const nftdataAccount = await getNFTDataKey(newNFTId, programId);
  log.info(`Generated nft account: ${nftdataAccount}`);
  const ownerNftPubkey = new PublicKey(nftData.ownerNftAddress);
  const pubkeyArray = new Uint8Array(ownerNftPubkey.toBuffer());
  const data = new NFTdata({
    id: newNFTId,
    name: nftData.name,
    uri: nftData.uri,
    lastPrice: 0,
    listedPrice: nftData.price,
    ownerNftAddress: pubkeyArray,
  });

  log.info(data);
  let txnData = Buffer.from(
    serialize(
      METADATA_SCHEMA,
      new CreateNFTMetadataArgs({ data, id: newNFTId }),
    ),
  );

  instructions.push(
    createNFTMetadataInstruction(
      nftdataAccount,
      wallet.publicKey,
      txnData,
      programId,
    ),
  );

  const res = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeypair,
    instructions,
    signers,
  );

  try {
    await connection.confirmTransaction(res.txid, 'max');
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  await connection.getParsedConfirmedTransaction(res.txid, 'confirmed');
  log.info('Test NFT created', res.txid);
  return { nftdataAccount };
};
