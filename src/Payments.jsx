import React,{useEffect,useState} from 'react';
import {Wallet,ArrowRight,ShieldCheck,RefreshCw,Clock3} from 'lucide-react';
import {api} from './api';
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n/100);
const statusLabel={pending:'Awaiting owner approval',approving:'Credit in progress',approved:'Credited',rejected:'Rejected'};

export function RechargeForm({payment,onSubmitted}){
 const [amount,setAmount]=useState('1000'),[step,setStep]=useState(1),[utr,setUtr]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [requestId]=useState(()=>crypto.randomUUID());
 async function submit(e){e.preventDefault();setError('');
  const value=Number(amount)*100;
  if(!Number.isSafeInteger(value)||value<10000||value>10000000){setError('Enter ₹100 to ₹1,00,000.');return;}
  if(step===1){setStep(2);return;}
  setBusy(true);try{await api('/payments/claims',{amount:value,utr:utr.trim(),requestId});onSubmitted();}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="recharge-form"><span className="plan-icon"><Wallet/></span><p className="eyebrow payment-step">WALLET RECHARGE · STEP {step} OF 2</p><h2>{step===1?'Add money':'Pay with UPI'}</h2>
 {step===1?<><p className="muted">Choose your amount, scan the merchant QR, then submit your UTR for owner approval.</p><label>Amount (₹)<input type="number" min="100" max="100000" step="1" required autoFocus value={amount} onChange={e=>setAmount(e.target.value)}/></label><div className="amount-options">{[500,1000,2500,5000].map(a=><button type="button" key={a} className={Number(amount)===a?'chosen':''} onClick={()=>setAmount(String(a))}>₹{a.toLocaleString('en-IN')}</button>)}</div></>:<>
 <div className="payment-total"><span>Pay exactly</span><strong>{money(Number(amount)*100)}</strong><button type="button" className="text-button" disabled={busy} onClick={()=>{setStep(1);setError('');}}>Change amount</button></div>
 <div className="qr-panel"><img className="clean-payment-qr" src={payment.image} alt="UPI payment QR for recipient SHAKIR HUSAIN" width="780" height="780"/><a href={payment.image} download="Piano-Wealth-payment-QR.png">Save QR to pay on this phone</a></div>
 <div className="recipient-detail"><b>{payment.brand}</b><span>QR recipient: {payment.beneficiary}</span><p>Your UPI app may show the registered recipient above. Check the recipient and amount before paying.</p></div>
 <ol className="payment-instructions"><li>Scan this QR or select the saved QR in your UPI app.</li><li>Pay {money(Number(amount)*100)} and wait for a successful payment.</li><li>Copy the 12-digit UTR from that payment and enter it below.</li></ol>
 <label>Payment UTR / transaction reference<input inputMode="numeric" pattern="[0-9]{12}" minLength="12" maxLength="12" placeholder="12-digit UPI reference" autoComplete="off" required value={utr} onChange={e=>setUtr(e.target.value.replace(/\D/g,''))}/></label>
 </>}
 {error&&<p className="error" role="alert">{error}</p>}<button className="button full" disabled={busy||!payment}>{busy?'Submitting…':step===1?'Continue to payment':'Submit UTR for verification'}<ArrowRight size={17}/></button><p className="small muted centered">{step===1?'Your plan starts only after you buy it.':'Already paid? Do not pay again while review is pending.'}</p></form>;
}

export function RechargeHistory({refreshKey}){
 const [claims,setClaims]=useState([]),[error,setError]=useState('');
 async function refresh(){try{const d=await api('/payments/claims');setClaims(d.claims);setError('');}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[refreshKey]);
 return <section className="withdrawal-history"><div className="section-row"><h2>UPI recharges</h2><button className="icon-button" aria-label="Refresh recharges" onClick={refresh}><RefreshCw size={18}/></button></div>{error&&<p className="error" role="alert">{error}</p>}{claims.length?claims.map(c=><article className="withdrawal-item" key={c.id}><div><b>{money(c.amount)}</b><p>UTR {c.utr}</p><span>{new Date(c.createdAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</span>{c.reviewNote&&<p>{c.reviewNote}</p>}</div><span className={'payout-status '+c.status}>{statusLabel[c.status]}</span></article>):<p className="muted small">Your submitted UTRs and payment review status will appear here.</p>}</section>;
}

export function OwnerReview(){
 const [claims,setClaims]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){try{const d=await api('/owner/recharges');setClaims(d.claims);setError('');}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();},[]);
 return <><div className="page-heading"><div><p className="eyebrow">OWNER WORKSPACE</p><h1>Payment review.</h1><p>Review each customer’s UTR and amount, then approve or reject the recharge.</p></div><button className="button outline" onClick={refresh}><RefreshCw size={18}/>Refresh</button></div><div className="info"><ShieldCheck size={20}/><span>Your approval credits the customer's wallet. Review the payment evidence before approving; a unique UTR alone does not prove payment.</span></div>{error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}<div className="review-grid">{claims.map(c=><ReviewCard key={c.id} claim={c} onDone={async decision=>{setNotice(decision==='approve'?'Payment approved. Wallet credit recorded.':'Payment rejected. No wallet credit.');await refresh();}}/>)}</div>{!claims.length&&!error&&<div className="empty"><Clock3/><h2>No payments awaiting review.</h2></div>}</>;
}
function ReviewCard({claim:c,onDone}){
 const [password,setPassword]=useState(''),[confirmed,setConfirmed]=useState(false),[decision,setDecision]=useState('approve'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{await api(`/owner/recharges/${c.id}/review`,{password,ownerConfirmed:confirmed,decision});setPassword('');await onDone(decision);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <form className="review-card" onSubmit={submit}><div className="section-row"><h2>{money(c.amount)}</h2><span className="payout-status">{statusLabel[c.status]}</span></div><p><b>{c.account?.name||'Account unavailable'}</b><br/>{c.account?.email}</p><p className="review-utr">Submitted UTR: <b>{c.utr}</b></p><p className="small muted">{new Date(c.createdAt).toLocaleString('en-IN')} · {c.id}</p><label>Review decision<select value={decision} onChange={e=>setDecision(e.target.value)}><option value="approve">Approve recharge</option><option value="reject">Reject submission</option></select></label>{decision==='approve'&&<label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>I approve this recharge and authorize crediting the stated amount to this customer’s wallet.</label>}<label>Owner password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="button full" disabled={busy}>{busy?'Processing…':decision==='approve'?'Approve and credit wallet':'Reject without credit'}</button></form>;
}
