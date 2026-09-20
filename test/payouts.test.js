import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshAccount,withdraw,applyPayoutState} from '../shared/domain.js';
import {encryptBank,decryptBank,createPayoutService} from '../server/payouts.js';
const bank={name:'Test User',accountNumber:'123456789012',ifsc:'HDFC0001234'};
const key='ab'.repeat(32);
function account(){const u=freshAccount('test@example.com','Test');u.wallet=100000;withdraw(u,50000,bank,Date.now(),'withdraw-test');const w=u.withdrawals[0];w.fundAccountId='fa_test';return u;}
const payout=(status)=>({id:'pout_test',amount:50000,currency:'INR',reference_id:'withdraw-test',fund_account_id:'fa_test',status,utr:'TESTUTR'});
test('Full bank number is encrypted and never stored in public withdrawal fields',()=>{const encoded=encryptBank(bank,key);assert.ok(!encoded.includes(bank.accountNumber));assert.deepEqual(decryptBank(encoded,key),bank);assert.throws(()=>decryptBank(encoded,'cd'.repeat(32)));const u=account();assert.ok(!JSON.stringify(u).includes(bank.accountNumber));assert.equal(u.withdrawals[0].bank.last4,'9012');});
test('Processed payouts do not debit twice; a later reversal refunds once',()=>{const u=account();applyPayoutState(u,'withdraw-test',payout('processing'));applyPayoutState(u,'withdraw-test',payout('processed'));applyPayoutState(u,'withdraw-test',payout('pending'));assert.equal(u.withdrawals[0].status,'processed');assert.equal(u.wallet,50000);applyPayoutState(u,'withdraw-test',payout('reversed'));applyPayoutState(u,'withdraw-test',payout('reversed'));applyPayoutState(u,'withdraw-test',payout('processed'));assert.equal(u.wallet,100000);assert.equal(u.transactions.filter(t=>t.type==='refund').length,1);assert.equal(u.withdrawals[0].status,'reversed');});
test('Unknown or mismatched payouts cannot refund user funds',()=>{const u=account();assert.throws(()=>applyPayoutState(u,'withdraw-test',{...payout('failed'),amount:60000}));assert.throws(()=>applyPayoutState(u,'withdraw-test',{...payout('failed'),fund_account_id:'fa_other'}));assert.equal(u.wallet,50000);});
test('Uncertain network result retries the identical payout body and idempotency key',async()=>{
 const u=account(),w=u.withdrawals[0];w.provider='razorpayx';w.bankEncrypted=encryptBank(bank,key);let calls=[];
 const service=createPayoutService({loadUser:async()=>u,mutate:async(id,fn)=>{fn(u);return u;},env:{RAZORPAYX_KEY_ID:'rzp_test_fake',RAZORPAYX_KEY_SECRET:'fake',RAZORPAYX_ACCOUNT_NUMBER:'source-account',RAZORPAYX_WEBHOOK_SECRET:'fake',BANK_DATA_KEY:key},fetchImpl:async(url,options)=>{calls.push({url,options});if(calls.length===1)throw new Error('Network timeout');return {ok:true,json:async()=>payout('processed')};}});
 await assert.rejects(service.reconcile('u','withdraw-test'),/timeout/);assert.equal(u.wallet,50000);await service.reconcile('u','withdraw-test');assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.headers['X-Payout-Idempotency'],'withdraw-test');assert.equal(calls[1].options.headers['X-Payout-Idempotency'],'withdraw-test');assert.equal(w.status,'processed');assert.equal(u.wallet,50000);
});
