import {readFileSync,writeFileSync} from 'node:fs';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
const original=jpeg.decode(readFileSync('public/payment-qr.jpeg'),{useTArray:true});
const decoded=jsQR(new Uint8ClampedArray(original.data),original.width,original.height,{inversionAttempts:'attemptBoth'});
if(!decoded)throw new Error('Original QR could not be decoded. No replacement written.');
const uri=new URL(decoded.data);
if(uri.protocol!=='upi:'||uri.hostname!=='pay'||!uri.searchParams.get('pa'))throw new Error('Unexpected QR payload. No replacement written.');
// Preserve the exact complete payment payload, including the real payee name.
const png=await QRCode.toBuffer(decoded.data,{type:'png',errorCorrectionLevel:'H',margin:4,scale:12,color:{dark:'#000000',light:'#ffffff'}});
const pixels=PNG.sync.read(png);
const verified=jsQR(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height);
assert.equal(verified?.data,decoded.data,'Regenerated QR must decode to exactly the original payment payload');
writeFileSync('public/payment-qr-clean.png',png);
console.log('Original and logo-free QR decode to the identical UPI payload. Payment destination unchanged.');
