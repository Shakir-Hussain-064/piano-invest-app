import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {applyPayoutState,refundStatuses} from '../shared/domain.js';
export function encryptBank(bank,key){
 if(!/^[a-f0-9]{64}$/i.test(key||''))throw new Error('BANK_DATA_KEY must be a 32-byte hexadecimal key.');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(bank),'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64')).join('.');
}
export function decryptBank(encoded,key){const [iv,tag,data]=encoded.split('.').map(s=>Buffer.from(s,'base64'));const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));}
export const payoutsConfigured=env=>!!(env.RAZORPAYX_KEY_ID&&env.RAZORPAYX_KEY_SECRET&&env.RAZORPAYX_ACCOUNT_NUMBER&&env.RAZORPAYX_WEBHOOK_SECRET&&/^[a-f0-9]{64}$/i.test(env.BANK_DATA_KEY||''));
export function createPayoutService({loadUser,mutate,env=process.env,fetchImpl=fetch}){
 async function call(endpoint,body,idempotency){
  if(!payoutsConfigured(env))throw new Error('Bank payouts are not configured.');
  const r=await fetchImpl(`https://api.razorpay.com/v1/${endpoint}`,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(`${env.RAZORPAYX_KEY_ID}:${env.RAZORPAYX_KEY_SECRET}`).toString('base64'),'Content-Type':'application/json',...(idempotency?{'X-Payout-Idempotency':idempotency}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error(`Payout provider returned HTTP ${r.status}. Funds remain reserved until confirmed.`);
  return r.json();
 }
 async function reconcile(userId,requestId){
  let u=await loadUser(userId),w=u.withdrawals.find(w=>w.id===requestId);
  if(!w||w.provider!=='razorpayx'||w.refunded||refundStatuses.includes(w.status))return;
  if(!w.fundAccountId){
   const bank=decryptBank(w.bankEncrypted,env.BANK_DATA_KEY);
   const contact=await call('contacts',{name:bank.name,email:u.email,type:'customer',reference_id:w.id});
   const fund=await call('fund_accounts',{contact_id:contact.id,account_type:'bank_account',bank_account:{name:bank.name,ifsc:bank.ifsc,account_number:bank.accountNumber}});
   u=await mutate(userId,u=>{const current=u.withdrawals.find(x=>x.id===requestId);if(!current.fundAccountId){current.fundAccountId=fund.id;current.contactId=contact.id;}});
   w=u.withdrawals.find(x=>x.id===requestId);
  }
  if(!w.payoutBody){
   u=await mutate(userId,u=>{const current=u.withdrawals.find(x=>x.id===requestId);current.payoutBody ||= {account_number:env.RAZORPAYX_ACCOUNT_NUMBER,fund_account_id:current.fundAccountId,amount:current.amount,currency:'INR',mode:'IMPS',purpose:'payout',queue_if_low_balance:true,reference_id:current.id,narration:'Piano withdrawal'};});
   w=u.withdrawals.find(x=>x.id===requestId);
  }
  // Persisted request body + stable UUID survive a timeout, process crash and retry.
  const payout=w.payoutId?await call(`payouts/${w.payoutId}`):await call('payouts',w.payoutBody,w.id);
  await mutate(userId,u=>applyPayoutState(u,requestId,payout));
  return payout;
 }
 async function acceptWebhook(userId,requestId,payoutId){
  const payout=await call(`payouts/${payoutId}`);
  await mutate(userId,u=>applyPayoutState(u,requestId,payout));
 }
 return {reconcile,acceptWebhook};
}
