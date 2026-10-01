import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plans,freshAccount,buy,settle,withdraw,DAY} from '../shared/domain.js';
import {creditClaim} from '../server/recharges.js';
const start=Date.parse('2026-09-19T18:20:00Z');
test('60-day catalog: standard 12× and four VIP plans at 18×',()=>{
 assert.deepEqual(plans.filter(p=>p.vip).map(p=>p.price),[1000000,2500000,3000000,4000000]);
 for(const p of plans){assert.equal(p.days,60);assert.equal(p.total,p.price*(p.vip?18:12));assert.equal(p.daily*p.days,p.total);}
 assert.equal(plans.find(p=>p.id==='piano-500').daily,10000);
});
test('₹500 plan credits ₹100 at IST midnight and caps at ₹6000 after 60 credits',()=>{
 const u=freshAccount('test@gmail.com','Test');u.wallet=50000;buy(u,'piano-500',start,'buy-1');
 assert.equal(u.wallet,0);assert.equal(settle(u,start),false);
 const midnight=Date.parse('2026-09-19T18:30:00Z');settle(u,midnight-1);assert.equal(u.wallet,0);
 settle(u,midnight);assert.equal(u.wallet,10000);settle(u,midnight);assert.equal(u.wallet,10000);
 settle(u,midnight+58*DAY);assert.equal(u.wallet,590000);settle(u,midnight+59*DAY);assert.equal(u.wallet,600000);
 assert.equal(u.totalEarned,600000);assert.equal(u.investments[0].paidDays,60);settle(u,midnight+100*DAY);assert.equal(u.wallet,600000);
});
test('Existing purchased snapshots retain their original duration and cap',()=>{
 const u=freshAccount('a@gmail.com','A');u.wallet=50000;buy(u,'piano-500',start);
 Object.assign(u.investments[0],{days:15,daily:10000,total:150000});settle(u,start+100*DAY);
 assert.equal(u.wallet,150000);assert.equal(u.investments[0].paidDays,15);
});
test('Insufficient balance and unknown plan never debit; purchase replay is idempotent',()=>{
 const u=freshAccount('a@gmail.com','A');u.wallet=40000;assert.throws(()=>buy(u,'piano-500'),/too low/);assert.throws(()=>buy(u,'bad'),/not found/);assert.equal(u.wallet,40000);
 u.wallet=100000;buy(u,'piano-500',start,'same');buy(u,'piano-500',start,'same');assert.equal(u.wallet,50000);assert.equal(u.investments.length,1);
});
test('Withdrawal minimum, reservation and duplicate protection',()=>{
 const u=freshAccount('a@gmail.com','A');u.wallet=100000;const bank={name:'Test',accountNumber:'12345678901',ifsc:'HDFC0001234'};
 for(const amount of [50000,99999])assert.throws(()=>withdraw(u,amount,bank),/Minimum/);assert.equal(u.wallet,100000);assert.equal(u.withdrawals.length,0);withdraw(u,100000,bank,start,'req1');withdraw(u,100000,bank,start,'req1');assert.equal(u.wallet,0);assert.equal(u.withdrawals.length,1);assert.throws(()=>withdraw(u,100000,bank),/Insufficient/);
});
test('VIP ₹40000 credits ₹12000 per day, capped at ₹720000',()=>{
 const u=freshAccount('a@gmail.com','A');u.wallet=4000000;buy(u,'vip-40000',start);settle(u,start+DAY);assert.equal(u.wallet,1200000);
 settle(u,start+100*DAY);assert.equal(u.wallet,72000000);assert.equal(u.investments[0].paidDays,60);
});
test('QR claims require recorded approval and correct account; retries never double credit',()=>{
 const u={...freshAccount('a@gmail.com','A'),_id:'user1'};
 const c={id:'claim1',userId:'user1',amount:50000,utr:'123456789012',status:'pending'};
 assert.throws(()=>creditClaim(u,c),/not been reviewed/);c.status='approving';assert.throws(()=>creditClaim(u,c),/not been reviewed/);
 c.reviewedBy='owner1';c.reviewedAt=new Date();assert.throws(()=>creditClaim(u,{...c,userId:'user2'}),/mismatch/);
 assert.throws(()=>creditClaim(u,{...c,amount:NaN}),/Invalid/);assert.equal(u.wallet,0);
 assert.equal(creditClaim(u,c),true);assert.equal(creditClaim(u,c),false);assert.equal(u.wallet,50000);assert.equal(u.transactions.length,1);
});
