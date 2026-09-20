import {plans,freshAccount,settle,buy,withdraw,transaction} from '../shared/domain';
export const staticDemo=import.meta.env.VITE_STATIC_DEMO==='true';
let csrf='';
let session=localStorage.getItem('piano-session');
const read=()=>JSON.parse(localStorage.getItem('piano-accounts')||'{}');
const write=a=>localStorage.setItem('piano-accounts',JSON.stringify(a));
let captcha='';
async function hash(password,salt){const encoder=new TextEncoder();const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function api(route,body){
 if(!staticDemo){const res=await fetch('/api'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});let data;try{data=await res.json();}catch{throw new Error('Server unavailable. Start the MERN backend and try again.');}if(!res.ok)throw new Error(data.error||'Request failed.');if(data.csrf)csrf=data.csrf;return data;}
 const accounts=read();
 if(route==='/config')return {demoPayments:true,testMode:true,razorpayConfigured:false,plans};
 if(route==='/captcha'){const a=2+Math.floor(Math.random()*8),b=2+Math.floor(Math.random()*8);captcha=String(a+b);return {question:`${a} + ${b}`};}
 if(route==='/signup'){
  if(body.captcha!==captcha)throw new Error('Incorrect captcha. Please try again.');captcha='';
  const email=body.email.toLowerCase().trim();if(!/^[^@\s]+@gmail\.com$/.test(email))throw new Error('Please use a valid Gmail address.');if(body.password.length<8)throw new Error('Use at least 8 characters for your password.');
  if(accounts[email])throw new Error('This Gmail address is already registered.');if(body.referral&&!Object.values(accounts).some(a=>a.referralCode===body.referral.toUpperCase()))throw new Error('Referral code not found.');
  const salt=crypto.randomUUID();accounts[email]={...freshAccount(email,body.name),salt,passwordHash:await hash(body.password,salt),referredBy:body.referral};write(accounts);return {ok:true};
 }
 if(route==='/login'){const email=body.email.toLowerCase().trim();const u=accounts[email];if(!u||await hash(body.password,u.salt)!==u.passwordHash)throw new Error('Email or password is incorrect.');session=email;localStorage.setItem('piano-session',email);}
 if(route==='/demo'){session='explorer@piano.demo';accounts[session] ||=freshAccount(session,'Alex');localStorage.setItem('piano-session',session);}
 if(route==='/logout'){session=null;localStorage.removeItem('piano-session');return {ok:true};}
 const u=accounts[session];if(!u)throw new Error('Please log in.');settle(u);
 if(route==='/plans/buy')buy(u,body.planId,Date.now(),body.requestId);
 if(route==='/wallet/withdraw'){if(body.confirmAccount!==body.bank.accountNumber)throw new Error('Bank account numbers do not match.');withdraw(u,body.amount,body.bank,Date.now(),body.requestId);u.withdrawals.find(w=>w.id===body.requestId).provider='demo';};
 if(route==='/wallet/demo-recharge'){if(!Number.isSafeInteger(body.amount)||body.amount<10000||body.amount>10000000)throw new Error('Enter an amount between ₹100 and ₹1,00,000.');if(!u.transactions.some(t=>t.id===body.requestId)){u.wallet+=body.amount;transaction(u,'recharge',body.amount,'Demo wallet recharge',Date.now(),body.requestId);}}
 write(accounts);const {passwordHash,salt,...user}=u;return {user};
}
