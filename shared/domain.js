export const DAY = 86400000;
export const OFFSET = 19800000;
export const istDay = (time = Date.now()) => Math.floor((time + OFFSET) / DAY);
export const plans = [500,1000,2500,5000,10000].map((price,i)=>({id:`piano-${price}`,name:['Prelude','Harmony','Melody','Symphony','Maestro'][i],price:price*100,daily:price*10,total:price*200,days:20,vip:false})).concat([
  {id:'vip-5000',name:'Virtuoso',price:500000,daily:75000,total:1500000,days:20,vip:true},
  {id:'vip-10000',name:'Grand Maestro',price:1000000,daily:150000,total:3000000,days:20,vip:true}
]);
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
  if(!Number.isSafeInteger(amount)||amount<50000)throw new Error('Minimum withdrawal is ₹500.');
  if(amount>user.wallet)throw new Error('Insufficient wallet balance.');
  validateBank(bank);
  user.wallet-=amount;user.withdrawals.unshift({id:requestId,amount,bank:{name:bank.name,ifsc:bank.ifsc,last4:bank.accountNumber.slice(-4)},status:'pending',at:now,refunded:false});
  transaction(user,'withdrawal',-amount,`Bank withdrawal · account ending ${bank.accountNumber.slice(-4)}`,now,requestId);
}
export function validateBank(bank){
 if(!bank||typeof bank.name!=='string'||bank.name.trim().length<2||bank.name.length>100)throw new Error('Enter the account holder name.');
 if(!/^\d{9,18}$/.test(bank.accountNumber))throw new Error('Enter a bank account number with 9–18 digits.');
 if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc))throw new Error('Enter a valid 11-character IFSC code.');
}
export const refundStatuses=['failed','reversed','cancelled','rejected'];
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
 const t=user.transactions.find(t=>t.id===w.id);if(t)t.note=`Bank withdrawal · ${w.status} · ending ${w.bank.last4}`;
}
export function creditOrder(user,orderId,payment){
  const order=user.orders.find(o=>o.id===orderId);if(!order)throw new Error('Recharge order not found.');
  if(payment.order_id!==order.id||payment.amount!==order.amount||payment.currency!=='INR'||payment.status!=='captured')throw new Error('Payment is not captured or does not match this order.');
  if(order.credited)return false;
  order.credited=true;order.paymentId=payment.id;user.wallet+=order.amount;
  transaction(user,'recharge',order.amount,'Razorpay recharge confirmed',Date.now(),`payment-${order.id}`);return true;
}
