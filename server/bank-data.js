import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function encryptBank(bank,key){
 if(!/^[a-f0-9]{64}$/i.test(key||''))throw new Error('BANK_DATA_KEY must be a 32-byte hexadecimal key.');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(bank),'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64')).join('.');
}
export function decryptBank(encoded,key){const [iv,tag,data]=encoded.split('.').map(s=>Buffer.from(s,'base64'));const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));}
