export const MIN_WITHDRAWAL=100000; // Integer paise: ₹1,000.
export const DAY = 86400000;
export const OFFSET = 19800000;
export const istDay = (time = Date.now()) => Math.floor((time + OFFSET) / DAY);
export const plans = [500,1000,2500,5000,10000].map((price,i)=>({id:`piano-${price}`,name:['Prelude','Harmony','Melody','Symphony','Maestro'][i],price:price*100,daily:price*20,total:price*1200,days:60,vip:false})).concat(
  [10000,25000,30000,40000].map((price,i)=>({id:`vip-${price}`,name:['Virtuoso','Grand Maestro','Concerto','Opus'][i],price:price*100,daily:price*30,total:price*1800,days:60,vip:true}))
);
export function freshAccount(email,name){return {email,name,referralCode:'PN'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase(),wallet:0,totalEarned:0,investments:[],transactions:[],withdrawals:[],orders:[]};}
export function transaction(user,type,amount,note,now=Date.now(),id=crypto.randomUUID()) {user.transactions.unshift({id,type,amount,note,at:now});}
export function settle(user,now=Date.now()) {
  let changed=false;
  for(const p of user.investments){
    const elapsed=Math.max(0,Math.min(p.days,istDay(now)-p.startDay));
    const due=elapsed-p.paidDays;
    if(due<=0)continue;
    const amount=Math.min(due*p.daily,p.total-p.earned);
    if(amount<=0)continue;
    p.paidDays=elapsed;p.earned+=amount;user.wallet+=amount;user.totalEarned+=amount;
    transaction(user,'earning',amount,`${p.name} · ${due} daily credit${due>1?'s':''}`,now,`earn-${p.id}-${elapsed}`);changed=true;
  }
  return changed;
}
export function buy(user,planId,now=Date.now(),requestId=crypto.randomUUID()){
  if(user.transactions.some(t=>t.id===requestId))return;
  const p=plans.find(p=>p.id===planId);if(!p)throw new Error('Plan not found.');
  if(user.wallet<p.price)throw new Error('Your wallet balance is too low. Add money first.');
  user.wallet-=p.price;user.investments.push({...p,planId:p.id,id:crypto.randomUUID(),startDay:istDay(now),startedAt:now,earned:0,paidDays:0});
  transaction(user,'purchase',-p.price,`${p.name} plan activated`,now,requestId);
}
export function withdraw(user,amount,bank,now=Date.now(),requestId=crypto.randomUUID()){
  if(user.transactions.some(t=>t.id===requestId))return;
  if(!Number.isSafeInteger(amount)||amount<MIN_WITHDRAWAL)throw new Error('Minimum withdrawal is ₹1,000.');
  if(amount>user.wallet)throw new Error('Insufficient wallet balance.');
  validateBank(bank);
  const method=bank.method==='upi'?'upi':'bank';
  const destination=method==='upi'?{name:bank.name,upiMasked:bank.upi.slice(0,2)+'***@'+bank.upi.split('@')[1]}:{name:bank.name,ifsc:bank.ifsc,last4:bank.accountNumber.slice(-4)};
  user.wallet-=amount;user.withdrawals.unshift({id:requestId,amount,method,bank:destination,status:'pending',at:now,refunded:false});
  transaction(user,'withdrawal',-amount,`${method==='upi'?'UPI':'Bank'} withdrawal requested`,now,requestId);
}
export function validateBank(bank){
 if(!bank||typeof bank.name!=='string'||bank.name.trim().length<2||bank.name.length>100)throw new Error('Enter the account holder name.');
 if(bank.method==='upi'){if(typeof bank.upi!=='string'||!/^[-a-zA-Z0-9._]{2,256}@[a-zA-Z]{2,64}$/.test(bank.upi))throw new Error('Enter a valid UPI ID.');return;}
 if(!/^\d{9,18}$/.test(bank.accountNumber))throw new Error('Enter a bank account number with 9–18 digits.');
 if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc))throw new Error('Enter a valid 11-character IFSC code.');
}
export const refundStatuses=['failed','reversed','cancelled','rejected'];
export function reviewWithdrawal(user,id,decision,ownerId,note,now=Date.now()){
 const w=user.withdrawals.find(w=>w.id===id);if(!w)throw new Error('Withdrawal not found.');
 if(decision==='initiate'&&w.ownerApprovedAt)return;
 if(decision==='reject'&&w.status==='rejected'&&w.refunded)return;
 if(w.ownerApprovedAt||w.payoutId||w.payoutBody||w.refunded||!['awaiting_owner','pending'].includes(w.status))throw new Error('This withdrawal is already being processed or is closed.');
 w.reviewedBy=String(ownerId);w.reviewedAt=now;w.reviewNote=note;
 if(decision==='initiate'){w.ownerApprovedAt=now;w.status='pending';}
 else if(decision==='reject'){w.status='rejected';w.refunded=true;user.wallet+=w.amount;transaction(user,'refund',w.amount,'Withdrawal rejected · balance restored',now,`refund-${w.id}`);}
 else throw new Error('Invalid withdrawal decision.');
 const t=user.transactions.find(t=>t.id===id);if(t)t.note=decision==='initiate'?'Withdrawal authorized by owner · queued':'Withdrawal rejected by owner';
}
export function applyPayoutState(user,requestId,payout,now=Date.now()){
 const w=user.withdrawals.find(w=>w.id===requestId);if(!w)throw new Error('Withdrawal not found.');
 if(payout.amount!==w.amount||payout.currency!=='INR'||payout.reference_id!==w.id||payout.fund_account_id!==w.fundAccountId)throw new Error('Payout does not match the reserved withdrawal.');
 if(w.payoutId&&w.payoutId!==payout.id)throw new Error('Payout ID mismatch.');
 w.payoutId=payout.id;
 if(w.refunded)return;
 if(w.status==='processed'&&!refundStatuses.includes(payout.status))return;
 if(!['pending','queued','scheduled','processing','processed',...refundStatuses].includes(payout.status))throw new Error('Unknown payout status.');
 w.status=payout.status;w.utr=payout.utr||w.utr;w.updatedAt=now;
 if(refundStatuses.includes(payout.status)){
  w.refunded=true;user.wallet+=w.amount;
  transaction(user,'refund',w.amount,`Withdrawal ${payout.status} · balance restored`,now,`refund-${w.id}`);
 }
 const t=user.transactions.find(t=>t.id===w.id);if(t)t.note=`${w.method==='upi'?'UPI':'Bank'} withdrawal · ${w.status} · ${w.bank.upiMasked||'ending '+w.bank.last4}`;
}
