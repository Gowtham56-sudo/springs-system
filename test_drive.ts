import { config } from 'dotenv'; 
config({ path: './local-uploader/.env' }); 
import { connectMongo, getDb } from './backend/mongodb/client'; 
import { getFileStreamFromDrive } from './backend/google-drive/client'; 

async function run() { 
  await connectMongo(); 
  const db = await getDb(); 
  const p = await db.collection('photos').findOne({ thumbnailFileId: { $exists: true } }); 
  if (!p) return console.log('no photo'); 
  console.log('testing photo id:', p._id, 'thumbnail:', p.thumbnailFileId); 
  try { 
    const { stream, mimeType } = await getFileStreamFromDrive(p.thumbnailFileId); 
    console.log('Got stream:', !!stream, 'mimeType:', mimeType); 
    let bytes = 0;
    stream.on('data', (chunk) => bytes += chunk.length);
    stream.on('end', () => console.log('Success! Total bytes:', bytes));
    stream.on('error', (err) => console.error('Stream error:', err));
  } catch(e) { 
    console.error('Error fetching file:', e); 
  } 
} 
run().then(() => { setTimeout(() => process.exit(0), 5000); });
