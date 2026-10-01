import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshAccount,withdraw,applyPayoutState,reviewWithdrawal} from '../shared/domain.js';
import {encryptBank,decryptBank} from '../server/bank-data.js';
const bank={name:'Test User',accountNumber:'123456789012',ifsc:'HDFC0001234'};
const key='ab'.repeat(32);
function account(){const u=freshAccount('test@example.com','Test');u.wallet=200000;withdraw(u,100000,bank,Date.now(),'withdraw-test');const w=u.withdrawals[0];w.fundAccountId='fa_test';w.ownerApprovedAt=Date.now();return u;}
const payout=(status)=>({id:'pout_test',amount:100000,currency:'INR',reference_id:'withdraw-test',fund_account_id:'fa_test',status,utr:'TESTUTR'});
test('Owner rejection refunds once; authorization is idempotent and prevents rejection',()=>{
 const u=account(),w=u.withdrawals[0];delete w.ownerApprovedAt;w.status='awaiting_owner';
 reviewWithdrawal(u,w.id,'reject','owner','Receipt review');reviewWithdrawal(u,w.id,'reject','owner','Repeat rejection');
 assert.equal(u.wallet,200000);assert.equal(u.transactions.filter(t=>t.id==='refund-'+w.id).length,1);
 assert.throws(()=>reviewWithdrawal(u,w.id,'initiate','owner','Too late'),/closed/);
 const v=account(),x=v.withdrawals[0];delete x.ownerApprovedAt;x.status='awaiting_owner';
 reviewWithdrawal(v,x.id,'initiate','owner','Verified destination',100);reviewWithdrawal(v,x.id,'initiate','owner','Retry',200);
 assert.equal(x.ownerApprovedAt,100);assert.equal(x.status,'pending');assert.equal(v.wallet,100000);
 assert.throws(()=>reviewWithdrawal(v,x.id,'reject','owner','Too late'),/processed/);
});
test('UPI withdrawals validate and mask the recipient address',()=>{const u=freshAccount('test@example.com','Test');u.wallet=200000;assert.throws(()=>withdraw(u,100000,{method:'upi',name:'Test',upi:'invalid'}),/UPI/);withdraw(u,100000,{method:'upi',name:'Test',upi:'recipient@bank'},Date.now(),'withdraw-upi');assert.equal(u.withdrawals[0].method,'upi');assert.equal(u.withdrawals[0].bank.upiMasked,'re***@bank');assert.ok(!JSON.stringify(u).includes('recipient@bank'));});
test('Full bank number is encrypted and never stored in public withdrawal fields',()=>{const encoded=encryptBank(bank,key);assert.ok(!encoded.includes(bank.accountNumber));assert.deepEqual(decryptBank(encoded,key),bank);assert.throws(()=>decryptBank(encoded,'cd'.repeat(32)));const u=account();assert.ok(!JSON.stringify(u).includes(bank.accountNumber));assert.equal(u.withdrawals[0].bank.last4,'9012');});
test('Processed payouts do not debit twice; a later reversal refunds once',()=>{const u=account();applyPayoutState(u,'withdraw-test',payout('processing'));applyPayoutState(u,'withdraw-test',payout('processed'));applyPayoutState(u,'withdraw-test',payout('pending'));assert.equal(u.withdrawals[0].status,'processed');assert.equal(u.wallet,100000);applyPayoutState(u,'withdraw-test',payout('reversed'));applyPayoutState(u,'withdraw-test',payout('reversed'));applyPayoutState(u,'withdraw-test',payout('processed'));assert.equal(u.wallet,200000);assert.equal(u.transactions.filter(t=>t.type==='refund').length,1);assert.equal(u.withdrawals[0].status,'reversed');});
test('Unknown or mismatched payouts cannot refund user funds',()=>{const u=account();assert.throws(()=>applyPayoutState(u,'withdraw-test',{...payout('failed'),amount:120000}));assert.throws(()=>applyPayoutState(u,'withdraw-test',{...payout('failed'),fund_account_id:'fa_other'}));assert.equal(u.wallet,100000);});
