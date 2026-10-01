import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env')){console.log('.env already exists; no values changed.');}
else{
 const content=`NODE_ENV=development
HOST=127.0.0.1
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/piano
SESSION_SECRET=${randomBytes(48).toString('hex')}
APP_ORIGIN=http://localhost:3001
BANK_DATA_KEY=${randomBytes(32).toString('hex')}
`;
 writeFileSync('.env',content,{mode:0o600});
 console.log('Created .env with private session/encryption keys. Configure MongoDB, HTTPS origin in this file. QR recharges use owner receipt review.');
}
